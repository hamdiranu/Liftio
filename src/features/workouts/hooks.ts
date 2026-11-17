import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/store';
import { rangeStart } from '@/lib/dates';
import { queryKeys } from '@/lib/query';
import { syncNow } from '@/services/sync';
import type { DateRange, WorkoutTemplate } from '@/types';
import {
  deleteTemplate,
  deleteWorkout,
  getExerciseHistory,
  getPreviousSets,
  getTemplate,
  getWorkout,
  listPersonalRecords,
  listWorkouts,
  recomputePersonalRecords,
  saveTemplate,
} from './repository';
import { ensureTemplates } from './sample-data';

export function useWorkoutHistory(limit?: number) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.workoutList(userId, `recent:${limit ?? 'all'}`),
    queryFn: () => listWorkouts(userId, { limit }),
  });
}

export function useWorkoutsInRange(range: DateRange) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.workoutList(userId, `range:${range}`),
    queryFn: () => listWorkouts(userId, { from: rangeStart(range) }),
  });
}

export function useWorkout(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.workout(id ?? ''),
    queryFn: () => getWorkout(id!),
    enabled: Boolean(id),
  });
}

export function usePersonalRecords() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.records(userId),
    queryFn: () => listPersonalRecords(userId),
  });
}

export function useExerciseHistory(exerciseId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.exerciseHistory(userId, exerciseId ?? ''),
    queryFn: () => getExerciseHistory(userId, exerciseId!),
    enabled: Boolean(exerciseId),
  });
}

export function usePreviousSets(exerciseId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: [...queryKeys.exerciseHistory(userId, exerciseId ?? ''), 'previous'],
    queryFn: () => getPreviousSets(userId, exerciseId!),
    enabled: Boolean(exerciseId),
    staleTime: Infinity,
  });
}

export function useTemplates() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.templates(userId),
    queryFn: () => ensureTemplates(userId),
  });
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.template(id ?? ''),
    queryFn: () => getTemplate(id!),
    enabled: Boolean(id),
  });
}

export function useSaveTemplate() {
  const qc = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: (template: WorkoutTemplate) => saveTemplate(template),
    onSuccess: (_data, template) => {
      qc.invalidateQueries({ queryKey: queryKeys.templates(userId) });
      qc.invalidateQueries({ queryKey: queryKeys.template(template.id) });
      void syncNow(userId);
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: (id: string) => deleteTemplate(userId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.templates(userId) });
      void syncNow(userId);
    },
  });
}

export function useDeleteWorkout() {
  const qc = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (id: string) => {
      await deleteWorkout(userId, id);
      await recomputePersonalRecords(userId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workouts(userId) });
      void syncNow(userId);
    },
  });
}

/** Call after any write that changes workout history. */
export function useInvalidateWorkouts() {
  const qc = useQueryClient();
  const userId = useUserId();
  return () => qc.invalidateQueries({ queryKey: queryKeys.workouts(userId) });
}
