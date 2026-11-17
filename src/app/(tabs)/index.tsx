import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import {
  CoachTipCard,
  DashboardHeader,
  HeroSection,
  ResumeWorkoutCard,
  StatsGrid,
  TodayWorkoutCard,
  WeeklyActivityCard,
} from '@/components/dashboard/dashboard-sections';
import { History } from '@/components/ui/icons';
import { SectionHeader } from '@/components/ui/misc';
import { FadeIn } from '@/components/ui/overlays';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, SkeletonCard } from '@/components/ui/states';
import { WorkoutRow } from '@/components/workout/workout-row';
import { useCoachInsights, useRecommendedWorkout } from '@/features/ai-coach/hooks';
import { useProfile } from '@/features/profile/hooks';
import { currentWeekActivity, overview, trainingStreak } from '@/features/progress/analytics';
import { useWorkoutHistory } from '@/features/workouts/hooks';
import { startOfWeek } from '@/lib/dates';
import { useStartWorkout } from '@/hooks/use-start-workout';

export default function HomeScreen() {
  const history = useWorkoutHistory();
  const profile = useProfile();
  const insights = useCoachInsights();
  const recommendation = useRecommendedWorkout();
  const startWorkout = useStartWorkout();

  const stats = useMemo(() => {
    const workouts = history.data ?? [];
    const weekStart = startOfWeek(new Date());
    const thisWeek = workouts.filter((w) => new Date(w.startedAt) >= weekStart);
    const week = overview(thisWeek, profile.data?.weightKg ?? undefined);
    const days = currentWeekActivity(workouts);
    return {
      thisWeek: thisWeek.length,
      streak: trainingStreak(workouts),
      total: workouts.length,
      weekVolume: week.volumeKg,
      weekCalories: week.calories,
      days,
      minutes: days.reduce((a, d) => a + d.minutes, 0),
      recent: workouts.slice(0, 3),
    };
  }, [history.data, profile.data?.weightKg]);

  const name = profile.data?.name ?? 'Athlete';
  const weeklyTarget = Math.max(1, profile.data?.preferredDays.length ?? 3);

  return (
    <Screen
      tabBar
      refreshing={history.isRefetching}
      onRefresh={() => {
        void history.refetch();
        void insights.refetch();
      }}>
      <DashboardHeader name={name} avatarUri={profile.data?.avatarUri} />

      {history.error ? (
        <ErrorState error={history.error} onRetry={() => history.refetch()} />
      ) : (
        <View className="gap-5">
          <FadeIn>
            <HeroSection
              sessionsThisWeek={stats.thisWeek}
              weeklyTarget={weeklyTarget}
              onQuickStart={() =>
                recommendation.data
                  ? void startWorkout({ kind: 'recommendation', recommendation: recommendation.data })
                  : void startWorkout({ kind: 'empty' })
              }
            />
          </FadeIn>

          <ResumeWorkoutCard />

          {history.isLoading ? (
            <SkeletonCard lines={4} />
          ) : (
            <FadeIn delay={60}>
              <StatsGrid streak={stats.streak} totalWorkouts={stats.total} weekVolumeKg={stats.weekVolume} weekCalories={stats.weekCalories} />
            </FadeIn>
          )}

          <FadeIn delay={120}>
            <WeeklyActivityCard days={stats.days} minutes={stats.minutes} />
          </FadeIn>

          <FadeIn delay={160}>
            <TodayWorkoutCard
              recommendation={recommendation.data}
              loading={recommendation.isLoading}
              onStart={(rec) => void startWorkout({ kind: 'recommendation', recommendation: rec })}
            />
          </FadeIn>

          <CoachTipCard insight={insights.data?.[0]} />

          <View>
            <SectionHeader title="Recent workouts" actionLabel="See all" onAction={() => router.push('/workout/history')} />
            {history.isLoading ? (
              <View className="gap-3">
                <SkeletonCard lines={2} />
                <SkeletonCard lines={2} />
              </View>
            ) : stats.recent.length === 0 ? (
              <EmptyState
                icon={History}
                title="No workouts yet"
                body="Finish your first session and it will show up here."
                actionLabel="Start a workout"
                onAction={() => void startWorkout({ kind: 'empty' })}
                compact
              />
            ) : (
              <View className="gap-3">
                {stats.recent.map((w) => (
                  <WorkoutRow key={w.id} workout={w} onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })} />
                ))}
              </View>
            )}
          </View>
        </View>
      )}
    </Screen>
  );
}
