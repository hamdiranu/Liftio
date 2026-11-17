import { getDb, nowIso } from '@/services/db';
import { enqueueSync } from '@/services/sync-queue';
import { computePersonalRecords } from './stats';
import type {
  PersonalRecord,
  SetType,
  TemplateExercise,
  Workout,
  WorkoutExercise,
  WorkoutSet,
  WorkoutTemplate,
} from '@/types';

type WorkoutRow = {
  id: string;
  user_id: string;
  name: string;
  status: Workout['status'];
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  notes: string;
  template_id: string | null;
  is_sample: number;
};

type ExerciseRow = {
  id: string;
  workout_id: string;
  exercise_id: string;
  position: number;
  notes: string;
  rest_seconds: number;
};

type SetRow = {
  id: string;
  workout_exercise_id: string;
  position: number;
  set_type: SetType;
  weight_kg: number | null;
  reps: number | null;
  duration_seconds: number | null;
  completed: number;
  completed_at: string | null;
};

type TemplateRow = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  focus: string;
  estimated_minutes: number;
  exercises: string;
  created_at: string;
  updated_at: string;
};

function placeholders(count: number) {
  return Array.from({ length: count }, () => '?').join(',');
}

async function hydrate(rows: WorkoutRow[]): Promise<Workout[]> {
  if (rows.length === 0) return [];
  const db = await getDb();
  const ids = rows.map((r) => r.id);
  const exerciseRows = await db.getAllAsync<ExerciseRow>(
    `SELECT * FROM workout_exercises WHERE workout_id IN (${placeholders(ids.length)}) ORDER BY position`,
    ids,
  );
  const exerciseIds = exerciseRows.map((r) => r.id);
  const setRows = exerciseIds.length
    ? await db.getAllAsync<SetRow>(
        `SELECT * FROM workout_sets WHERE workout_exercise_id IN (${placeholders(exerciseIds.length)}) ORDER BY position`,
        exerciseIds,
      )
    : [];

  const setsByExercise = new Map<string, WorkoutSet[]>();
  for (const s of setRows) {
    const list = setsByExercise.get(s.workout_exercise_id) ?? [];
    list.push({
      id: s.id,
      index: s.position,
      type: s.set_type,
      weightKg: s.weight_kg,
      reps: s.reps,
      durationSeconds: s.duration_seconds,
      completed: s.completed === 1,
      completedAt: s.completed_at,
    });
    setsByExercise.set(s.workout_exercise_id, list);
  }

  const exercisesByWorkout = new Map<string, WorkoutExercise[]>();
  for (const e of exerciseRows) {
    const list = exercisesByWorkout.get(e.workout_id) ?? [];
    list.push({
      id: e.id,
      exerciseId: e.exercise_id,
      order: e.position,
      notes: e.notes,
      restSeconds: e.rest_seconds,
      sets: setsByExercise.get(e.id) ?? [],
    });
    exercisesByWorkout.set(e.workout_id, list);
  }

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    status: r.status,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    durationSeconds: r.duration_seconds,
    notes: r.notes,
    templateId: r.template_id,
    isSample: r.is_sample === 1,
    exercises: exercisesByWorkout.get(r.id) ?? [],
  }));
}

export async function listWorkouts(
  userId: string,
  options: { from?: Date | null; limit?: number } = {},
): Promise<Workout[]> {
  const db = await getDb();
  const params: (string | number)[] = [userId];
  let sql = `SELECT * FROM workouts WHERE user_id = ? AND status = 'completed'`;
  if (options.from) {
    sql += ' AND started_at >= ?';
    params.push(options.from.toISOString());
  }
  sql += ' ORDER BY started_at DESC';
  if (options.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }
  const rows = await db.getAllAsync<WorkoutRow>(sql, params);
  return hydrate(rows);
}

export async function getWorkout(id: string): Promise<Workout | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<WorkoutRow>('SELECT * FROM workouts WHERE id = ?', [id]);
  if (!row) return null;
  const [workout] = await hydrate([row]);
  return workout ?? null;
}

/** Writes a workout and all its exercises/sets atomically, replacing any previous version. */
export async function saveWorkout(workout: Workout, options: { sync?: boolean } = {}) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT OR REPLACE INTO workouts
        (id, user_id, name, status, started_at, ended_at, duration_seconds, notes, template_id, is_sample, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        workout.id,
        workout.userId,
        workout.name,
        workout.status,
        workout.startedAt,
        workout.endedAt,
        workout.durationSeconds,
        workout.notes,
        workout.templateId,
        workout.isSample ? 1 : 0,
        nowIso(),
      ],
    );
    await db.runAsync('DELETE FROM workout_exercises WHERE workout_id = ?', [workout.id]);
    for (const [position, exercise] of workout.exercises.entries()) {
      await db.runAsync(
        `INSERT INTO workout_exercises (id, workout_id, exercise_id, position, notes, rest_seconds)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [exercise.id, workout.id, exercise.exerciseId, position, exercise.notes, exercise.restSeconds],
      );
      for (const [setPosition, set] of exercise.sets.entries()) {
        await db.runAsync(
          `INSERT INTO workout_sets
            (id, workout_exercise_id, position, set_type, weight_kg, reps, duration_seconds, completed, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            set.id,
            exercise.id,
            setPosition,
            set.type,
            set.weightKg,
            set.reps,
            set.durationSeconds,
            set.completed ? 1 : 0,
            set.completedAt,
          ],
        );
      }
    }
  });
  if (options.sync !== false && !workout.isSample) {
    await enqueueSync(workout.userId, 'workout', workout.id, 'upsert');
  }
}

export async function deleteWorkout(userId: string, id: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM workouts WHERE id = ? AND user_id = ?', [id, userId]);
  await enqueueSync(userId, 'workout', id, 'delete');
}

export async function countWorkouts(userId: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM workouts WHERE user_id = ? AND status = 'completed'`,
    [userId],
  );
  return row?.n ?? 0;
}

export async function hasSampleData(userId: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM workouts WHERE user_id = ? AND is_sample = 1',
    [userId],
  );
  return (row?.n ?? 0) > 0;
}

export async function clearSampleData(userId: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM workouts WHERE user_id = ? AND is_sample = 1', [userId]);
  await recomputePersonalRecords(userId);
}

/** Completed sets for one exercise across workouts, newest first. */
export async function getExerciseHistory(userId: string, exerciseId: string, limit = 20) {
  const db = await getDb();
  const rows = await db.getAllAsync<WorkoutRow>(
    `SELECT DISTINCT w.* FROM workouts w
       JOIN workout_exercises we ON we.workout_id = w.id
      WHERE w.user_id = ? AND w.status = 'completed' AND we.exercise_id = ?
      ORDER BY w.started_at DESC LIMIT ?`,
    [userId, exerciseId, limit],
  );
  const workouts = await hydrate(rows);
  return workouts.map((w) => ({
    workoutId: w.id,
    workoutName: w.name,
    date: w.startedAt,
    sets: w.exercises
      .filter((e) => e.exerciseId === exerciseId)
      .flatMap((e) => e.sets)
      .filter((s) => s.completed),
  }));
}

/** Last completed sets for an exercise — used for "previous" values in the active workout. */
export async function getPreviousSets(userId: string, exerciseId: string) {
  const [latest] = await getExerciseHistory(userId, exerciseId, 1);
  return latest?.sets ?? [];
}

// ───────────────────────────── Personal records

type RecordRow = {
  id: string;
  user_id: string;
  exercise_id: string;
  record_type: PersonalRecord['type'];
  value: number;
  reps: number | null;
  workout_id: string;
  achieved_at: string;
};

export async function listPersonalRecords(userId: string): Promise<PersonalRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RecordRow>(
    'SELECT * FROM personal_records WHERE user_id = ? ORDER BY achieved_at DESC',
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    exerciseId: r.exercise_id,
    type: r.record_type,
    value: r.value,
    reps: r.reps,
    workoutId: r.workout_id,
    achievedAt: r.achieved_at,
  }));
}

export async function replacePersonalRecords(userId: string, records: PersonalRecord[]) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM personal_records WHERE user_id = ?', [userId]);
    for (const r of records) {
      await db.runAsync(
        `INSERT INTO personal_records (id, user_id, exercise_id, record_type, value, reps, workout_id, achieved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.id, userId, r.exerciseId, r.type, r.value, r.reps, r.workoutId, r.achievedAt],
      );
    }
  });
}

export async function recomputePersonalRecords(userId: string) {
  const workouts = await listWorkouts(userId);
  const records = computePersonalRecords(userId, workouts);
  await replacePersonalRecords(userId, records);
  return records;
}

// ───────────────────────────── Templates

function rowToTemplate(r: TemplateRow): WorkoutTemplate {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    description: r.description,
    focus: JSON.parse(r.focus),
    estimatedMinutes: r.estimated_minutes,
    exercises: JSON.parse(r.exercises) as TemplateExercise[],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listTemplates(userId: string): Promise<WorkoutTemplate[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TemplateRow>(
    'SELECT * FROM workout_templates WHERE user_id = ? ORDER BY updated_at DESC, rowid DESC',
    [userId],
  );
  return rows.map(rowToTemplate);
}

export async function getTemplate(id: string): Promise<WorkoutTemplate | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<TemplateRow>('SELECT * FROM workout_templates WHERE id = ?', [id]);
  return row ? rowToTemplate(row) : null;
}

export async function saveTemplate(template: WorkoutTemplate) {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO workout_templates
      (id, user_id, name, description, focus, estimated_minutes, exercises, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      template.id,
      template.userId,
      template.name,
      template.description,
      JSON.stringify(template.focus),
      template.estimatedMinutes,
      JSON.stringify(template.exercises),
      template.createdAt,
      nowIso(),
    ],
  );
  await enqueueSync(template.userId, 'template', template.id, 'upsert');
}

export async function deleteTemplate(userId: string, id: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM workout_templates WHERE id = ? AND user_id = ?', [id, userId]);
  await enqueueSync(userId, 'template', id, 'delete');
}

/** Moves guest data to a signed-in account so nothing logged offline is lost. */
export async function reassignUserData(fromUserId: string, toUserId: string) {
  if (fromUserId === toUserId) return;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const table of ['workouts', 'workout_templates', 'personal_records', 'ai_conversations', 'sync_queue']) {
      await db.runAsync(`UPDATE ${table} SET user_id = ? WHERE user_id = ?`, [toUserId, fromUserId]);
    }
    await db.runAsync('UPDATE OR IGNORE favorites SET user_id = ? WHERE user_id = ?', [toUserId, fromUserId]);
  });
  const rows = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM workouts WHERE user_id = ? AND is_sample = 0',
    [toUserId],
  );
  for (const r of rows) await enqueueSync(toUserId, 'workout', r.id, 'upsert');
}
