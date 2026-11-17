import { router } from 'expo-router';
import { View } from 'react-native';

import { ExerciseImage } from '@/components/ui/exercise-image';
import { Trophy } from '@/components/ui/icons';
import { Badge } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { EXERCISE_BY_ID } from '@/features/exercises/catalog';
import { exerciseVolume } from '@/features/workouts/stats';
import { formatVolume, formatWeight } from '@/lib/format';
import { useSettings } from '@/store/settings';
import type { PersonalRecord, Workout } from '@/types';

/** Exercise-by-exercise list of a finished workout with every logged set. */
export function WorkoutBreakdown({ workout, records = [] }: { workout: Workout; records?: PersonalRecord[] }) {
  const unit = useSettings((s) => s.unit);
  return (
    <View className="gap-3">
      {workout.exercises.map((e) => {
        const meta = EXERCISE_BY_ID[e.exerciseId];
        const pr = records.filter((r) => r.exerciseId === e.exerciseId && r.workoutId === workout.id && r.type !== 'max_volume');
        return (
          <PressableScale
            key={e.id}
            scaleTo={0.99}
            onPress={() => router.push({ pathname: '/exercises/[id]', params: { id: e.exerciseId } })}
            accessibilityLabel={`${meta?.name ?? e.exerciseId}, ${e.sets.length} sets`}>
            <View className="gap-3 rounded-lg border border-line bg-card p-3">
              <View className="flex-row items-center gap-3">
                <ExerciseImage slug={e.exerciseId} muscleGroup={meta?.muscleGroup} style={{ width: 48, height: 48 }} radius={12} priority="low" />
                <View className="flex-1">
                  <Text variant="body" weight="semibold" numberOfLines={1}>
                    {meta?.name ?? e.exerciseId}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {e.sets.length} sets{meta?.isTimed ? '' : ` · ${formatVolume(exerciseVolume(e), unit)}`}
                  </Text>
                </View>
                {pr.length ? <Badge label="PR" icon={Trophy} /> : null}
              </View>
              <View className="flex-row flex-wrap gap-2">
                {e.sets.map((s) => (
                  <View key={s.id} className="rounded-md bg-surface px-3 py-1.5">
                    <Text variant="caption" weight="semibold">
                      {s.durationSeconds ? `${s.durationSeconds}s` : `${!s.weightKg && meta?.isBodyweight ? 'BW' : formatWeight(s.weightKg ?? 0, unit, false)} × ${s.reps ?? 0}`}
                    </Text>
                  </View>
                ))}
              </View>
              {e.notes ? (
                <Text variant="caption" tone="secondary">
                  {e.notes}
                </Text>
              ) : null}
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}
