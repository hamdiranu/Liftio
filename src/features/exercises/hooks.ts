import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/store';
import { queryKeys } from '@/lib/query';
import { syncNow } from '@/services/sync';
import { EXERCISE_BY_ID, EXERCISES } from './catalog';
import { listFavorites, setFavorite } from './favorites';
import { fetchExercises } from './repository';

export function useExercises() {
  return useQuery({
    queryKey: queryKeys.exercises,
    queryFn: fetchExercises,
    placeholderData: EXERCISES,
    staleTime: 60 * 60 * 1000,
  });
}

export function useExercise(id: string | undefined) {
  const { data } = useExercises();
  if (!id) return undefined;
  return data?.find((e) => e.id === id) ?? EXERCISE_BY_ID[id];
}

export function useFavorites() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.favorites(userId),
    queryFn: () => listFavorites(userId),
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  const userId = useUserId();
  const key = queryKeys.favorites(userId);
  return useMutation({
    mutationFn: ({ exerciseId, favorite }: { exerciseId: string; favorite: boolean }) =>
      setFavorite(userId, exerciseId, favorite),
    onMutate: async ({ exerciseId, favorite }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<string[]>(key) ?? [];
      qc.setQueryData<string[]>(key, favorite ? [exerciseId, ...previous] : previous.filter((id) => id !== exerciseId));
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(key, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      void syncNow(userId);
    },
  });
}
