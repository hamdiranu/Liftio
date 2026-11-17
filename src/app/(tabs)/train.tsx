import { router } from 'expo-router';
import { View } from 'react-native';

import { ResumeWorkoutCard } from '@/components/dashboard/dashboard-sections';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GymHero } from '@/components/ui/exercise-image';
import { Clock, Dumbbell, History, Layers, Pencil, Play, Plus, Search, Sparkles, Zap } from '@/components/ui/icons';
import { Badge, Overline, SectionHeader } from '@/components/ui/misc';
import { FadeIn } from '@/components/ui/overlays';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, SkeletonCard } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { EXERCISE_LIBRARY } from '@/constants/routes';
import { useColors } from '@/constants/theme';
import { useRecommendedWorkout } from '@/features/ai-coach/hooks';
import { EXERCISE_BY_ID } from '@/features/exercises/catalog';
import { useTemplates } from '@/features/workouts/hooks';
import { capitalize } from '@/lib/format';
import { useStartWorkout } from '@/hooks/use-start-workout';
import type { WorkoutTemplate } from '@/types';

function QuickAction({ icon: Icon, label, onPress }: { icon: typeof Zap; label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={{ flex: 1 }}>
      <View className="items-center gap-2 rounded-lg border border-line bg-card py-4">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-accent/15">
          <Icon size={20} color={colors.accent} />
        </View>
        <Text variant="caption" weight="semibold" align="center">
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

function TemplateCard({ template, onStart }: { template: WorkoutTemplate; onStart: () => void }) {
  const colors = useColors();
  const sets = template.exercises.reduce((a, e) => a + e.sets, 0);
  const names = template.exercises.map((e) => EXERCISE_BY_ID[e.exerciseId]?.name).filter(Boolean);
  return (
    <Card>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text variant="subheading">{template.name}</Text>
          {template.description ? (
            <Text variant="caption" tone="secondary" style={{ marginTop: 2 }} numberOfLines={2}>
              {template.description}
            </Text>
          ) : null}
        </View>
        <PressableScale
          onPress={() => router.push({ pathname: '/workout/builder', params: { id: template.id } })}
          accessibilityLabel={`Edit ${template.name}`}
          haptic="selection">
          <View className="h-9 w-9 items-center justify-center rounded-full border border-line-strong bg-elevated">
            <Pencil size={15} color={colors.textSecondary} />
          </View>
        </PressableScale>
      </View>
      <View className="mt-3 flex-row flex-wrap gap-2">
        <Badge label={`${template.estimatedMinutes} min`} tone="neutral" icon={Clock} />
        <Badge label={`${template.exercises.length} exercises`} tone="neutral" icon={Dumbbell} />
        <Badge label={`${sets} sets`} tone="neutral" icon={Layers} />
        {template.focus.slice(0, 2).map((f) => (
          <Badge key={f} label={capitalize(f)} />
        ))}
      </View>
      <Text variant="caption" tone="muted" style={{ marginTop: 10 }} numberOfLines={1}>
        {names.join(' · ')}
      </Text>
      <View className="mt-4">
        <Button label="Start" icon={Play} size="sm" fullWidth onPress={onStart} />
      </View>
    </Card>
  );
}

export default function TrainScreen() {
  const colors = useColors();
  const templates = useTemplates();
  const recommendation = useRecommendedWorkout();
  const startWorkout = useStartWorkout();

  return (
    <Screen tabBar refreshing={templates.isRefetching} onRefresh={() => templates.refetch()}>
      <View className="gap-6 pt-2">
        <FadeIn>
          <GymHero image="train" height={180}>
            <Overline>Train</Overline>
            <Text variant="title" style={{ marginTop: 6 }}>
              Build. Lift. Repeat.
            </Text>
            <Text variant="small" tone="secondary" style={{ marginTop: 4 }}>
              Start fresh, run a template or let your coach plan it.
            </Text>
          </GymHero>
        </FadeIn>

        <ResumeWorkoutCard />

        <View className="flex-row gap-3">
          <QuickAction icon={Zap} label="Empty workout" onPress={() => void startWorkout({ kind: 'empty' })} />
          <QuickAction icon={Search} label="Exercise library" onPress={() => router.push(EXERCISE_LIBRARY)} />
          <QuickAction icon={History} label="History" onPress={() => router.push('/workout/history')} />
        </View>

        {recommendation.data ? (
          <Card variant="glow">
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-accent/15">
                <Sparkles size={20} color={colors.accent} />
              </View>
              <View className="flex-1">
                <Overline>Coach pick</Overline>
                <Text variant="subheading" style={{ marginTop: 2 }}>
                  {recommendation.data.title}
                </Text>
                <Text variant="caption" tone="secondary">
                  {recommendation.data.focus} · {recommendation.data.estimatedMinutes} min
                </Text>
              </View>
            </View>
            <View className="mt-4 flex-row gap-3">
              <View className="flex-1">
                <Button label="Ask coach" variant="secondary" size="sm" fullWidth onPress={() => router.push('/coach/chat')} />
              </View>
              <View className="flex-1">
                <Button label="Start" icon={Play} size="sm" fullWidth onPress={() => void startWorkout({ kind: 'recommendation', recommendation: recommendation.data! })} />
              </View>
            </View>
          </Card>
        ) : null}

        <View>
          <SectionHeader title="Your workouts" actionLabel="New" onAction={() => router.push('/workout/builder')} />
          {templates.isLoading ? (
            <View className="gap-3">
              <SkeletonCard lines={3} />
              <SkeletonCard lines={3} />
            </View>
          ) : templates.error ? (
            <ErrorState error={templates.error} onRetry={() => templates.refetch()} />
          ) : !templates.data?.length ? (
            <EmptyState icon={Dumbbell} title="No saved workouts" body="Build a template once and start it in one tap." actionLabel="Create workout" onAction={() => router.push('/workout/builder')} />
          ) : (
            <View className="gap-3">
              {templates.data.map((t) => (
                <TemplateCard key={t.id} template={t} onStart={() => void startWorkout({ kind: 'template', template: t })} />
              ))}
              <Button label="Create a workout" icon={Plus} variant="outline" fullWidth onPress={() => router.push('/workout/builder')} />
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}
