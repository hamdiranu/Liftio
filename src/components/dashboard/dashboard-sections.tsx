import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { BarChart } from '@/components/analytics/charts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GymHero } from '@/components/ui/exercise-image';
import {
  ArrowRight,
  Clock,
  CloudOff,
  Dumbbell,
  Flame,
  Play,
  RefreshCw,
  Sparkles,
  Trophy,
  Weight,
  Zap,
} from '@/components/ui/icons';
import { Avatar, Badge, Overline, StatTile } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ProgressRing } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useColors } from '@/constants/theme';
import { EXERCISE_BY_ID } from '@/features/exercises/catalog';
import type { WeekDayActivity } from '@/features/progress/analytics';
import { greetingFor } from '@/lib/dates';
import { formatCompact, formatDuration, formatNumber, kgToUnit } from '@/lib/format';
import { subscribeSync, type SyncState } from '@/services/sync';
import { useActiveWorkout } from '@/store/active-workout';
import { useSettings } from '@/store/settings';
import type { CoachInsight, WorkoutRecommendation } from '@/types';

export function DashboardHeader({ name, avatarUri }: { name: string; avatarUri?: string | null }) {
  const [sync, setSync] = useState<SyncState | null>(null);
  useEffect(() => subscribeSync(setSync), []);
  return (
    <View className="flex-row items-center justify-between pb-5 pt-2">
      <View className="flex-1">
        <Text variant="small" tone="secondary">
          {greetingFor()},
        </Text>
        <Text variant="title" numberOfLines={1}>
          {name.split(' ')[0]}
        </Text>
      </View>
      <View className="flex-row items-center gap-3">
        {sync?.status === 'offline' ? (
          <Badge label="Offline" tone="neutral" icon={CloudOff} />
        ) : sync?.status === 'syncing' ? (
          <Badge label="Syncing" tone="neutral" icon={RefreshCw} />
        ) : null}
        <PressableScale onPress={() => router.push('/profile')} accessibilityLabel="Open profile" haptic="selection">
          <Avatar name={name} uri={avatarUri} size={46} />
        </PressableScale>
      </View>
    </View>
  );
}

export function HeroSection({
  sessionsThisWeek,
  weeklyTarget,
  onQuickStart,
}: {
  sessionsThisWeek: number;
  weeklyTarget: number;
  onQuickStart: () => void;
}) {
  const progress = weeklyTarget ? sessionsThisWeek / weeklyTarget : 0;
  return (
    <GymHero height={236}>
      <View className="flex-row items-end justify-between">
        <View className="flex-1 pr-4">
          <Overline>This week</Overline>
          <Text variant="title" style={{ marginTop: 6 }}>
            Ready to get{'\n'}stronger?
          </Text>
          <Text variant="small" tone="secondary" style={{ marginTop: 6 }}>
            {sessionsThisWeek >= weeklyTarget
              ? 'Weekly goal smashed. Bonus sessions count too.'
              : `${weeklyTarget - sessionsThisWeek} more session${weeklyTarget - sessionsThisWeek === 1 ? '' : 's'} to hit your goal.`}
          </Text>
        </View>
        <ProgressRing value={progress} size={78} stroke={7}>
          <Text variant="heading" weight="extrabold">
            {sessionsThisWeek}
            <Text variant="small" tone="muted">
              /{weeklyTarget}
            </Text>
          </Text>
        </ProgressRing>
      </View>
      <View className="mt-4">
        <Button label="Quick start workout" icon={Zap} onPress={onQuickStart} fullWidth />
      </View>
    </GymHero>
  );
}

export function ResumeWorkoutCard() {
  const colors = useColors();
  const workout = useActiveWorkout((s) => s.workout);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!workout) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [workout]);
  if (!workout) return null;
  const done = workout.exercises.reduce((a, e) => a + e.sets.filter((s) => s.completed).length, 0);
  const total = workout.exercises.reduce((a, e) => a + e.sets.length, 0);
  return (
    <Card variant="accent" onPress={() => router.push('/workout/active')} accessibilityLabel={`Resume ${workout.name}`}>
      <View className="flex-row items-center gap-4">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-accent">
          <Play size={20} color={colors.accentInk} fill={colors.accentInk} />
        </View>
        <View className="flex-1">
          <Overline>Workout in progress</Overline>
          <Text variant="subheading" numberOfLines={1} style={{ marginTop: 2 }}>
            {workout.name}
          </Text>
          <Text variant="caption" tone="secondary">
            {formatDuration((now - new Date(workout.startedAt).getTime()) / 1000)} elapsed · {done}/{total} sets
          </Text>
        </View>
        <ArrowRight size={20} color={colors.accent} />
      </View>
    </Card>
  );
}

export function StatsGrid({
  streak,
  totalWorkouts,
  weekVolumeKg,
  weekCalories,
}: {
  streak: number;
  totalWorkouts: number;
  weekVolumeKg: number;
  weekCalories: number;
}) {
  const unit = useSettings((s) => s.unit);
  return (
    <View className="gap-3">
      <View className="flex-row gap-3">
        <StatTile label="Training streak" value={String(streak)} unit={streak === 1 ? 'day' : 'days'} icon={Flame} />
        <StatTile label="Total workouts" value={formatNumber(totalWorkouts)} icon={Trophy} />
      </View>
      <View className="flex-row gap-3">
        <StatTile label="Volume this week" value={formatCompact(Math.round(kgToUnit(weekVolumeKg, unit)))} unit={unit} icon={Weight} />
        <StatTile label="Calories (est.)" value={formatNumber(weekCalories)} unit="kcal" icon={Zap} />
      </View>
    </View>
  );
}

export function WeeklyActivityCard({ days, minutes }: { days: WeekDayActivity[]; minutes: number }) {
  const today = days.findIndex((d) => d.isToday);
  return (
    <Card>
      <View className="mb-2 flex-row items-center justify-between">
        <View>
          <Text variant="subheading">Weekly activity</Text>
          <Text variant="caption" tone="muted">
            {minutes} active minutes · {days.filter((d) => d.trained).length} training days
          </Text>
        </View>
        <Badge label="Minutes" tone="neutral" icon={Clock} />
      </View>
      <BarChart
        data={days.map((d) => ({ label: d.label, value: d.minutes, caption: d.isToday ? 'today' : undefined }))}
        height={150}
        highlightIndex={today >= 0 ? today : undefined}
        formatValue={(v) => `${Math.round(v)} min`}
        emptyLabel="No sessions yet this week"
      />
    </Card>
  );
}

export function TodayWorkoutCard({
  recommendation,
  loading,
  onStart,
}: {
  recommendation?: WorkoutRecommendation;
  loading?: boolean;
  onStart: (rec: WorkoutRecommendation) => void;
}) {
  const colors = useColors();
  if (loading || !recommendation) {
    return (
      <Card>
        <Skeleton width="40%" height={12} />
        <Skeleton width="70%" height={22} className="mt-3" />
        <Skeleton height={44} className="mt-4" />
      </Card>
    );
  }
  const names = recommendation.exercises.map((e) => EXERCISE_BY_ID[e.exerciseId]?.name).filter(Boolean);
  const sets = recommendation.exercises.reduce((a, e) => a + e.sets, 0);
  return (
    <Card variant="glow">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Overline>Today’s workout</Overline>
          <Text variant="heading" style={{ marginTop: 6 }}>
            {recommendation.title}
          </Text>
          <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
            {recommendation.focus}
          </Text>
        </View>
        <View className="h-11 w-11 items-center justify-center rounded-full border border-accent/30 bg-accent/10">
          <Dumbbell size={20} color={colors.accent} />
        </View>
      </View>
      <View className="mt-4 flex-row gap-2">
        <Badge label={`${recommendation.estimatedMinutes} min`} tone="neutral" icon={Clock} />
        <Badge label={`${recommendation.exercises.length} exercises`} tone="neutral" />
        <Badge label={`${sets} sets`} tone="neutral" />
      </View>
      <Text variant="small" tone="secondary" style={{ marginTop: 12 }} numberOfLines={2}>
        {names.slice(0, 4).join(' · ')}
        {names.length > 4 ? ` +${names.length - 4} more` : ''}
      </Text>
      <View className="mt-4">
        <Button label="Start this workout" icon={Play} onPress={() => onStart(recommendation)} fullWidth />
      </View>
    </Card>
  );
}

export function CoachTipCard({ insight }: { insight?: CoachInsight }) {
  const colors = useColors();
  if (!insight) return null;
  return (
    <Card onPress={() => router.push('/coach')} accessibilityLabel={`Coach tip: ${insight.title}`}>
      <View className="flex-row gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-accent/15">
          <Sparkles size={18} color={colors.accent} />
        </View>
        <View className="flex-1">
          <Overline>AI coach tip</Overline>
          <Text variant="subheading" style={{ marginTop: 4 }}>
            {insight.title}
          </Text>
          <Text variant="small" tone="secondary" style={{ marginTop: 2 }}>
            {insight.body}
          </Text>
        </View>
      </View>
    </Card>
  );
}
