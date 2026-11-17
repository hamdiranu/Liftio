import { router } from 'expo-router';
import { useMemo } from 'react';
import { SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/ui/ambient-background';
import { History } from '@/components/ui/icons';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState, ErrorState, SkeletonCard } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { WorkoutRow } from '@/components/workout/workout-row';
import { useWorkoutHistory } from '@/features/workouts/hooks';
import { workoutVolume } from '@/features/workouts/stats';
import { formatVolume } from '@/lib/format';
import { useStartWorkout } from '@/hooks/use-start-workout';
import { useSettings } from '@/store/settings';
import type { Workout } from '@/types';

export default function WorkoutHistoryScreen() {
  const insets = useSafeAreaInsets();
  const history = useWorkoutHistory();
  const unit = useSettings((s) => s.unit);
  const startWorkout = useStartWorkout();

  const sections = useMemo(() => {
    const byMonth = new Map<string, Workout[]>();
    for (const w of history.data ?? []) {
      const key = new Date(w.startedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      byMonth.set(key, [...(byMonth.get(key) ?? []), w]);
    }
    return [...byMonth.entries()].map(([title, data]) => ({
      title,
      data,
      volume: data.reduce((a, w) => a + workoutVolume(w), 0),
    }));
  }, [history.data]);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <AmbientBackground intensity="subtle" />
      <ScreenHeader title="Workout history" subtitle={history.data ? `${history.data.length} workouts` : undefined} />
      {history.isLoading ? (
        <View className="gap-3 px-5">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </View>
      ) : history.error ? (
        <View className="px-5">
          <ErrorState error={history.error} onRetry={() => history.refetch()} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(w) => w.id}
          stickySectionHeadersEnabled={false}
          refreshing={history.isRefetching}
          onRefresh={() => history.refetch()}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderSectionHeader={({ section }) => (
            <View className="mb-3 mt-4 flex-row items-baseline justify-between">
              <Text variant="subheading">{section.title}</Text>
              <Text variant="caption" tone="muted">
                {section.data.length} workouts · {formatVolume(section.volume, unit)}
              </Text>
            </View>
          )}
          renderItem={({ item }) => <WorkoutRow workout={item} onPress={() => router.push({ pathname: '/workout/[id]', params: { id: item.id } })} />}
          ListEmptyComponent={
            <EmptyState
              icon={History}
              title="No workouts yet"
              body="Your finished sessions will be listed here, month by month."
              actionLabel="Start a workout"
              onAction={() => void startWorkout({ kind: 'empty' })}
            />
          }
        />
      )}
    </View>
  );
}
