import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Clock, Flame, House, Layers, PartyPopper, Repeat, Trophy, Weight } from '@/components/ui/icons';
import { Overline, SectionHeader, StatTile } from '@/components/ui/misc';
import { tapHaptic } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { ErrorState, SkeletonCard } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { WorkoutBreakdown } from '@/components/workout/workout-breakdown';
import { useColors } from '@/constants/theme';
import { EXERCISE_BY_ID } from '@/features/exercises/catalog';
import { useProfile } from '@/features/profile/hooks';
import { usePersonalRecords, useWorkout } from '@/features/workouts/hooks';
import { summarizeWorkout } from '@/features/workouts/stats';
import { formatCompact, formatMinutes, formatNumber, formatWeight, kgToUnit } from '@/lib/format';
import { useSettings } from '@/store/settings';

const RECORD_LABEL = { max_weight: 'Heaviest weight', estimated_1rm: 'Best est. 1RM', max_reps: 'Most reps', max_volume: 'Best set volume' } as const;

export default function WorkoutSummaryScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const workout = useWorkout(id);
  const records = usePersonalRecords();
  const profile = useProfile();
  const unit = useSettings((s) => s.unit);

  useEffect(() => {
    tapHaptic('success');
  }, []);

  const newRecords = useMemo(
    () => (records.data ?? []).filter((r) => r.workoutId === id && r.type !== 'max_volume'),
    [records.data, id],
  );
  const stats = workout.data ? summarizeWorkout(workout.data, newRecords, profile.data?.weightKg ?? undefined) : null;

  return (
    <Screen
      ambient="strong"
      footer={
        <View className="flex-row gap-3 px-5 pt-3">
          <View className="flex-1">
            <Button label="History" icon={Repeat} variant="secondary" size="lg" fullWidth onPress={() => router.replace('/workout/history')} />
          </View>
          <View className="flex-1">
            <Button label="Done" icon={House} size="lg" fullWidth onPress={() => router.replace('/')} />
          </View>
        </View>
      }>
      {workout.isLoading ? (
        <View className="gap-4 pt-10">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={4} />
        </View>
      ) : workout.error || !workout.data || !stats ? (
        <View className="pt-10">
          <ErrorState error={workout.error ?? new Error('Workout not found.')} onRetry={() => workout.refetch()} />
        </View>
      ) : (
        <View className="gap-6 pt-6">
          <Animated.View entering={ZoomIn.springify().damping(12)} className="items-center">
            <View className="h-20 w-20 items-center justify-center rounded-full border border-accent/40 bg-accent/15">
              <PartyPopper size={36} color={colors.accent} />
            </View>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(120)} className="items-center">
            <Overline>Workout complete</Overline>
            <Text variant="title" align="center" style={{ marginTop: 6 }}>
              {workout.data.name}
            </Text>
            <Text variant="body" tone="secondary" align="center" style={{ marginTop: 4 }}>
              {newRecords.length ? `${newRecords.length} new personal record${newRecords.length === 1 ? '' : 's'}. Outstanding work.` : 'Another session in the bank. Consistency wins.'}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200)} className="gap-3">
            <View className="flex-row gap-3">
              <StatTile label="Duration" value={formatMinutes(stats.durationSeconds)} icon={Clock} />
              <StatTile label="Volume" value={formatCompact(Math.round(kgToUnit(stats.totalVolumeKg, unit)))} unit={unit} icon={Weight} />
            </View>
            <View className="flex-row gap-3">
              <StatTile label="Sets" value={String(stats.completedSets)} unit={`· ${formatNumber(stats.totalReps)} reps`} icon={Layers} />
              <StatTile label="Calories (est.)" value={formatNumber(stats.estimatedCalories)} unit="kcal" icon={Flame} />
            </View>
          </Animated.View>

          {newRecords.length ? (
            <Animated.View entering={FadeInDown.delay(260)}>
              <Card variant="accent">
                <View className="mb-3 flex-row items-center gap-2">
                  <Trophy size={18} color={colors.accent} />
                  <Text variant="subheading">Personal records</Text>
                </View>
                <View className="gap-2">
                  {newRecords.map((r) => (
                    <View key={r.id} className="flex-row items-center justify-between">
                      <Text variant="small" style={{ flex: 1 }} numberOfLines={1}>
                        {EXERCISE_BY_ID[r.exerciseId]?.name} · {RECORD_LABEL[r.type]}
                      </Text>
                      <Text variant="small" weight="bold" tone="accent">
                        {r.type === 'max_reps' ? (EXERCISE_BY_ID[r.exerciseId]?.isTimed ? `${r.value}s` : `${r.value} reps`) : formatWeight(r.value, unit)}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.delay(320)}>
            <SectionHeader title="Exercises" />
            <WorkoutBreakdown workout={workout.data} records={records.data} />
          </Animated.View>
        </View>
      )}
    </Screen>
  );
}
