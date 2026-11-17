import { useActiveWorkout } from '@/store/active-workout';
import type { Workout } from '@/types';
import { listPersonalRecords, recomputePersonalRecords, saveWorkout } from './repository';
import { findNewRecords } from './stats';

export class EmptyWorkoutError extends Error {
  constructor() {
    super('Complete at least one set before finishing.');
  }
}

/**
 * Persists the active session as a completed workout (only completed sets are kept),
 * refreshes personal records and clears the in-progress state.
 */
export async function finishActiveWorkout() {
  const { workout } = useActiveWorkout.getState();
  if (!workout) throw new Error('No workout in progress.');

  const exercises = workout.exercises
    .map((e) => ({ ...e, sets: e.sets.filter((s) => s.completed).map((s, index) => ({ ...s, index })) }))
    .filter((e) => e.sets.length > 0)
    .map((e, order) => ({ ...e, order }));
  if (exercises.length === 0) throw new EmptyWorkoutError();

  const endedAt = new Date();
  const final: Workout = {
    ...workout,
    status: 'completed',
    endedAt: endedAt.toISOString(),
    durationSeconds: Math.max(60, Math.round((endedAt.getTime() - new Date(workout.startedAt).getTime()) / 1000)),
    exercises,
  };

  const before = await listPersonalRecords(workout.userId);
  await saveWorkout(final);
  const after = await recomputePersonalRecords(workout.userId);
  const newRecords = findNewRecords(before, after, final.id);

  useActiveWorkout.getState().clear();
  return { workout: final, newRecords };
}
