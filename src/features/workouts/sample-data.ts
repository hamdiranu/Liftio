import { EXERCISE_BY_ID } from '@/features/exercises/catalog';
import { addDays, startOfDay } from '@/lib/dates';
import { seededRandom, uuid } from '@/lib/utils';
import { getDb, nowIso } from '@/services/db';
import type { Workout, WorkoutTemplate } from '@/types';
import { listTemplates, recomputePersonalRecords, saveTemplate, saveWorkout } from './repository';
import { BUILT_IN_TEMPLATES, targetReps, targetSeconds } from './templates';

/** Working weights (kg) at the start of the sample block; they progress over 12 weeks. */
const BASE_WEIGHTS: Record<string, number> = {
  'flat-barbell-bench-press': 70,
  'incline-dumbbell-press': 24,
  'cable-chest-fly': 15,
  'barbell-bent-over-row': 60,
  'dumbbell-shoulder-press': 20,
  'lat-pulldown': 55,
  'cable-tricep-pushdown': 25,
  'hammer-curl': 14,
  'lateral-raise': 8,
  'overhead-tricep-extension': 20,
  'pull-up': 0,
  'seated-cable-row': 55,
  'one-arm-dumbbell-row': 28,
  'reverse-pec-deck': 30,
  'barbell-bicep-curl': 30,
  'barbell-squat': 90,
  'romanian-deadlift': 80,
  'leg-press': 160,
  'leg-curl': 40,
  'calf-raises': 60,
  'plank': 0,
  'push-up': 0,
  'walking-lunges': 16,
  'cable-crunch': 35,
};

const ROTATION = ['push', 'pull', 'legs', 'upper-strength'];

export async function ensureTemplates(userId: string) {
  const existing = await listTemplates(userId);
  if (existing.length) return existing;
  const created: WorkoutTemplate[] = [];
  // Saved in reverse so the list (newest first) shows them in their defined order.
  for (const def of [...BUILT_IN_TEMPLATES].reverse()) {
    const t: WorkoutTemplate = {
      id: uuid(),
      userId,
      name: def.name,
      description: def.description,
      focus: def.focus,
      estimatedMinutes: def.estimatedMinutes,
      exercises: def.exercises,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      isBuiltIn: true,
    };
    await saveTemplate(t);
    created.push(t);
  }
  return created;
}

/**
 * Generates ~12 weeks of realistic training history (3–4 sessions a week with progressive
 * overload) so dashboards and charts have something meaningful in development and demo mode.
 * Sample workouts are flagged and never synced; they can be cleared from Settings.
 */
export async function seedSampleData(userId: string) {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM workouts WHERE user_id = ?',
    [userId],
  );
  if ((existing?.n ?? 0) > 0) return false;

  const rand = seededRandom(42);
  const today = startOfDay(new Date());
  const weeks = 12;
  let sessionIndex = 0;
  let sampleId = 0;

  for (let week = weeks - 1; week >= 0; week--) {
    // Mon / Wed / Fri plus a Saturday session most weeks.
    const dayOffsets = [0, 2, 4, ...(rand() > 0.35 ? [5] : [])];
    const weekStart = addDays(today, -week * 7 - ((today.getDay() + 6) % 7));
    for (const offset of dayOffsets) {
      const day = addDays(weekStart, offset);
      if (day > today || (week === 0 && day.getTime() === today.getTime())) continue;
      if (rand() < 0.08) continue; // occasional missed session

      const def = BUILT_IN_TEMPLATES.find((t) => t.key === ROTATION[sessionIndex % ROTATION.length])!;
      sessionIndex++;
      const progress = 1 + ((weeks - week) / weeks) * 0.12;
      const start = new Date(day);
      start.setHours(17 + Math.floor(rand() * 3), Math.floor(rand() * 60), 0, 0);
      let cursor = start.getTime() + 5 * 60 * 1000;

      const workout: Workout = {
        id: `sample-${++sampleId}`,
        userId,
        name: def.name,
        status: 'completed',
        startedAt: start.toISOString(),
        endedAt: null,
        durationSeconds: 0,
        notes: '',
        templateId: null,
        isSample: true,
        exercises: def.exercises.map((te, order) => {
          const meta = EXERCISE_BY_ID[te.exerciseId];
          const base = BASE_WEIGHTS[te.exerciseId] ?? 20;
          const weight = base > 0 ? Math.round((base * progress) / 2.5) * 2.5 : 0;
          return {
            id: `sample-${sampleId}-${order}`,
            exerciseId: te.exerciseId,
            order,
            notes: '',
            restSeconds: te.restSeconds,
            sets: Array.from({ length: te.sets }, (_, i) => {
              cursor += (meta?.isTimed ? 60 : 45) * 1000 + te.restSeconds * 1000;
              const reps = Math.max(3, targetReps(te.reps) + Math.round((rand() - 0.6) * 3) - (i === te.sets - 1 ? 1 : 0));
              return {
                id: `sample-${sampleId}-${order}-${i}`,
                index: i,
                type: 'working' as const,
                weightKg: meta?.isTimed ? null : weight,
                reps: meta?.isTimed ? null : reps,
                durationSeconds: meta?.isTimed ? targetSeconds(te.reps) - Math.round(rand() * 10) : null,
                completed: true,
                completedAt: new Date(cursor).toISOString(),
              };
            }),
          };
        }),
      };
      workout.durationSeconds = Math.round((cursor - start.getTime()) / 1000);
      workout.endedAt = new Date(cursor).toISOString();
      await saveWorkout(workout, { sync: false });
    }
  }
  await recomputePersonalRecords(userId);
  return true;
}
