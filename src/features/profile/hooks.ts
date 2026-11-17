import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/store';
import { queryKeys } from '@/lib/query';
import { syncNow } from '@/services/sync';
import type { Profile } from '@/types';
import { getProfile, saveProfile } from './repository';

export function useProfile() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.profile(userId),
    queryFn: () => getProfile(userId),
  });
}

export function useSaveProfile() {
  const qc = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: (profile: Profile) => saveProfile({ ...profile, id: userId }),
    onSuccess: (saved) => {
      qc.setQueryData(queryKeys.profile(userId), saved);
      qc.invalidateQueries({ queryKey: queryKeys.insights(userId) });
      void syncNow(userId);
    },
  });
}

export const GOAL_LABELS: Record<Profile['goals'][number], string> = {
  build_muscle: 'Build muscle',
  lose_fat: 'Lose fat',
  increase_strength: 'Increase strength',
  improve_endurance: 'Improve endurance',
  general_fitness: 'General fitness',
};

export const EXPERIENCE_LABELS: Record<Profile['experience'], string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export const TRAINING_PREFERENCES = [
  'Free weights',
  'Machines',
  'Cables',
  'Bodyweight',
  'Home gym',
  'Supersets',
  'Low impact',
  'Heavy compounds',
];
