import { router } from 'expo-router';

import { confirm } from '@/components/ui/overlays';
import { tapHaptic } from '@/components/ui/pressable-scale';
import { useUserId } from '@/features/auth/store';
import { useActiveWorkout } from '@/store/active-workout';
import type { WorkoutRecommendation, WorkoutTemplate } from '@/types';

type StartInput =
  | { kind: 'empty'; name?: string }
  | { kind: 'template'; template: WorkoutTemplate }
  | { kind: 'recommendation'; recommendation: WorkoutRecommendation }
  | { kind: 'exercises'; name: string; exerciseIds: string[] };

/** Starts a session, asking first if another one is still in progress. */
export function useStartWorkout() {
  const userId = useUserId();
  return async (input: StartInput) => {
    const store = useActiveWorkout.getState();
    if (store.workout) {
      const replace = await confirm({
        title: 'Workout in progress',
        message: `“${store.workout.name}” is still running. Discard it and start a new one?`,
        confirmLabel: 'Discard and start',
        cancelLabel: 'Keep current',
        destructive: true,
      });
      if (!replace) {
        router.push('/workout/active');
        return;
      }
    }
    switch (input.kind) {
      case 'empty':
        store.start({ userId, name: input.name ?? 'Quick workout' });
        break;
      case 'template':
        store.startFromTemplate(userId, input.template);
        break;
      case 'recommendation':
        store.startFromRecommendation(userId, input.recommendation);
        break;
      case 'exercises':
        store.start({ userId, name: input.name });
        useActiveWorkout.getState().addExercises(input.exerciseIds);
        break;
    }
    tapHaptic('success');
    router.push(input.kind === 'empty' ? '/workout/add-exercise?target=active' : '/workout/active');
  };
}
