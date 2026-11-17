import { EXERCISE_BY_ID } from '@/features/exercises/catalog';
import { estimateOneRepMax, uuid } from '@/lib/utils';
import type { PersonalRecord, Workout, WorkoutExercise, WorkoutSummaryStats } from '@/types';

export function setVolume(weightKg: number | null, reps: number | null) {
  return (weightKg ?? 0) * (reps ?? 0);
}

export function exerciseVolume(exercise: WorkoutExercise) {
  return exercise.sets.filter((s) => s.completed).reduce((acc, s) => acc + setVolume(s.weightKg, s.reps), 0);
}

export function workoutVolume(workout: Workout) {
  return workout.exercises.reduce((acc, e) => acc + exerciseVolume(e), 0);
}

export function completedSetCount(workout: Workout) {
  return workout.exercises.reduce((acc, e) => acc + e.sets.filter((s) => s.completed).length, 0);
}

/**
 * Rough calorie estimate from duration and work done (MET ≈ 5 for resistance training plus a
 * small volume term). Displayed as an estimate, never as a measurement.
 */
export function estimateCalories(durationSeconds: number, volumeKg: number, bodyWeightKg = 75) {
  const minutes = durationSeconds / 60;
  const base = (5 * 3.5 * bodyWeightKg * minutes) / 200;
  return Math.round(base + volumeKg * 0.004);
}

export function summarizeWorkout(
  workout: Workout,
  newRecords: PersonalRecord[] = [],
  bodyWeightKg?: number,
): WorkoutSummaryStats {
  const totalVolumeKg = workoutVolume(workout);
  const allSets = workout.exercises.flatMap((e) => e.sets);
  const completed = allSets.filter((s) => s.completed);
  return {
    totalVolumeKg,
    totalSets: allSets.length,
    completedSets: completed.length,
    totalReps: completed.reduce((acc, s) => acc + (s.reps ?? 0), 0),
    exerciseCount: workout.exercises.filter((e) => e.sets.some((s) => s.completed)).length,
    durationSeconds: workout.durationSeconds,
    estimatedCalories: estimateCalories(workout.durationSeconds, totalVolumeKg, bodyWeightKg),
    personalRecords: newRecords,
  };
}

/** Best estimated 1RM, heaviest weight and best single-set volume per exercise across history. */
export function computePersonalRecords(userId: string, workouts: Workout[]): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>();
  const consider = (record: Omit<PersonalRecord, 'id' | 'userId'>) => {
    const key = `${record.exerciseId}:${record.type}`;
    const current = best.get(key);
    if (!current || record.value > current.value + 1e-9) {
      best.set(key, { ...record, id: current?.id ?? uuid(), userId });
    }
  };

  const ordered = [...workouts]
    .filter((w) => w.status === 'completed')
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  for (const w of ordered) {
    for (const e of w.exercises) {
      const meta = EXERCISE_BY_ID[e.exerciseId];
      for (const s of e.sets) {
        if (!s.completed) continue;
        const achievedAt = s.completedAt ?? w.startedAt;
        if (meta?.isTimed) {
          if (s.durationSeconds) {
            consider({ exerciseId: e.exerciseId, type: 'max_reps', value: s.durationSeconds, reps: null, workoutId: w.id, achievedAt });
          }
          continue;
        }
        const reps = s.reps ?? 0;
        const weight = s.weightKg ?? 0;
        if (reps <= 0) continue;
        if (weight > 0) {
          consider({ exerciseId: e.exerciseId, type: 'max_weight', value: weight, reps, workoutId: w.id, achievedAt });
          consider({ exerciseId: e.exerciseId, type: 'estimated_1rm', value: estimateOneRepMax(weight, reps), reps, workoutId: w.id, achievedAt });
          consider({ exerciseId: e.exerciseId, type: 'max_volume', value: weight * reps, reps, workoutId: w.id, achievedAt });
        } else {
          consider({ exerciseId: e.exerciseId, type: 'max_reps', value: reps, reps, workoutId: w.id, achievedAt });
        }
      }
    }
  }
  return [...best.values()];
}

/** Records set by `workout` that beat everything before it. */
export function findNewRecords(previous: PersonalRecord[], next: PersonalRecord[], workoutId: string) {
  const prevByKey = new Map(previous.map((r) => [`${r.exerciseId}:${r.type}`, r]));
  return next.filter((r) => {
    if (r.workoutId !== workoutId) return false;
    if (r.type === 'max_volume') return false;
    const prev = prevByKey.get(`${r.exerciseId}:${r.type}`);
    return !prev || r.value > prev.value + 1e-9;
  });
}
