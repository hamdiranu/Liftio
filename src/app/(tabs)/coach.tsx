import { router } from 'expo-router';
import { View } from 'react-native';

import { InsightCard, ReadinessRow, RecommendationCard } from '@/components/coach/coach-components';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GymHero } from '@/components/ui/exercise-image';
import {
  CalendarDays,
  ChartColumn,
  ChevronRight,
  Cloud,
  Dumbbell,
  MessageCircle,
  MessageSquarePlus,
  Pencil,
  Smartphone,
  Sparkles,
  type IconComponent,
} from '@/components/ui/icons';
import { Badge, Overline, SectionHeader } from '@/components/ui/misc';
import { FadeIn } from '@/components/ui/overlays';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ProgressRing } from '@/components/ui/progress';
import { Screen } from '@/components/ui/screen';
import { ErrorState, SkeletonCard } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useColors } from '@/constants/theme';
import { useCoachInsights, useConversations, useRecommendedWorkout } from '@/features/ai-coach/hooks';
import { getCoachProvider } from '@/features/ai-coach/service';
import { GOAL_LABELS, useProfile } from '@/features/profile/hooks';
import { relativeDay } from '@/lib/dates';
import { capitalize } from '@/lib/format';
import { useStartWorkout } from '@/hooks/use-start-workout';

export default function CoachScreen() {
  const colors = useColors();
  const insights = useCoachInsights();
  const recommendation = useRecommendedWorkout();
  const conversations = useConversations();
  const profile = useProfile();
  const startWorkout = useStartWorkout();
  const provider = getCoachProvider();
  const ctx = insights.ctx;
  const target = Math.max(1, profile.data?.preferredDays.length ?? 3);

  return (
    <Screen tabBar refreshing={insights.isRefetching} onRefresh={() => insights.refetch()}>
      <View className="gap-6 pt-2">
        <FadeIn>
          <GymHero image="coach" height={210} focus="top">
            <View className="flex-row items-center justify-between">
              <Overline>AI personal trainer</Overline>
              <Badge label={provider.id === 'edge' ? 'Cloud AI' : 'On-device'} tone="neutral" icon={provider.id === 'edge' ? Cloud : Smartphone} />
            </View>
            <Text variant="title" style={{ marginTop: 6 }}>
              Train with purpose.
            </Text>
            <Text variant="small" tone="secondary" style={{ marginTop: 4 }}>
              Plans, progression and recovery advice built from your own training.
            </Text>
            <View className="mt-4">
              <Button label="Ask your coach" icon={MessageCircle} fullWidth onPress={() => router.push('/coach/chat')} />
            </View>
          </GymHero>
        </FadeIn>

        {insights.error ? <ErrorState error={insights.error} onRetry={() => insights.refetch()} /> : null}

        {!ctx ? (
          <SkeletonCard lines={3} />
        ) : (
          <Card className="rounded-xl">
            <Text variant="subheading">Training consistency</Text>
            <View
              className="mt-3 flex-row items-center gap-3"
              accessible
              accessibilityLabel={`${ctx.sessionsThisWeek} of ${target} sessions this week. Streak ${ctx.streakDays} days. Average ${ctx.avgSessionsPerWeek} sessions per week. ${ctx.sessionsLast28} sessions in the last 28 days.`}>
              <ProgressRing value={ctx.sessionsThisWeek / target} size={78} stroke={7}>
                <Text weight="extrabold" style={{ fontSize: 28, lineHeight: 32, letterSpacing: -1 }}>
                  {ctx.sessionsThisWeek}
                  <Text variant="small" tone="muted">
                    /{target}
                  </Text>
                </Text>
              </ProgressRing>
              <View className="flex-1 flex-row items-center">
                <View className="flex-1 gap-2">
                  <View className="flex-row items-center gap-1.5">
                    <CalendarDays size={16} color={colors.textSecondary} />
                    <Text variant="body" weight="semibold">
                      {ctx.streakDays} {ctx.streakDays === 1 ? 'day' : 'days'}
                    </Text>
                  </View>
                  <Text variant="small" tone="secondary" numberOfLines={1}>
                    Average
                  </Text>
                  <Text variant="small" tone="secondary" numberOfLines={1}>
                    Last 28 days
                  </Text>
                </View>
                <View className="mx-2.5 w-px self-stretch bg-line-strong" />
                <View className="gap-4">
                  <ConsistencyStat icon={Dumbbell} value={String(ctx.avgSessionsPerWeek)} unit="/ week" />
                  <ConsistencyStat icon={ChartColumn} value={String(ctx.sessionsLast28)} unit="sessions" />
                </View>
              </View>
            </View>
          </Card>
        )}

        {recommendation.isLoading ? (
          <SkeletonCard lines={5} />
        ) : recommendation.data ? (
          <RecommendationCard workout={recommendation.data} onStart={() => void startWorkout({ kind: 'recommendation', recommendation: recommendation.data! })} />
        ) : null}

        <View>
          <SectionHeader title="Weekly insights" />
          {insights.isLoading ? (
            <View className="gap-3">
              <SkeletonCard lines={2} />
              <SkeletonCard lines={2} />
            </View>
          ) : (
            <View className="gap-3">
              {(insights.data ?? []).map((i, idx) => (
                <FadeIn key={i.id} delay={idx * 60}>
                  <InsightCard insight={i} />
                </FadeIn>
              ))}
            </View>
          )}
        </View>

        {ctx ? (
          <Card>
            <View className="mb-4 flex-row items-center justify-between">
              <Text variant="subheading">Recovery</Text>
              <Text variant="caption" tone="muted">
                Days since trained
              </Text>
            </View>
            <View className="gap-3">
              {ctx.recovery.map((r) => (
                <ReadinessRow key={r.group} label={capitalize(r.group)} daysSince={r.daysSince} />
              ))}
            </View>
          </Card>
        ) : null}

        <Card>
          <View className="flex-row items-center justify-between">
            <Text variant="subheading">Current goals</Text>
            <PressableScale onPress={() => router.push('/profile/edit')} accessibilityLabel="Edit goals" haptic="selection">
              <View className="flex-row items-center gap-1">
                <Pencil size={14} color={colors.accent} />
                <Text variant="small" tone="accent" weight="semibold">
                  Edit
                </Text>
              </View>
            </PressableScale>
          </View>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {(profile.data?.goals ?? []).map((g, i) => (
              <Badge key={g} label={GOAL_LABELS[g]} tone={i === 0 ? 'accent' : 'neutral'} />
            ))}
          </View>
          <Text variant="caption" tone="muted" style={{ marginTop: 10 }}>
            {profile.data?.preferredDays.length ?? 0} training days · {profile.data?.preferredDurationMinutes ?? 60} min sessions · {capitalize(profile.data?.experience ?? 'intermediate')}
          </Text>
        </Card>

        <View>
          <SectionHeader title="Conversations" actionLabel="New chat" onAction={() => router.push({ pathname: '/coach/chat', params: { new: '1' } })} />
          {conversations.data?.length ? (
            <View className="gap-2">
              {conversations.data.slice(0, 5).map((c) => (
                <PressableScale key={c.id} onPress={() => router.push({ pathname: '/coach/chat', params: { conversationId: c.id } })} scaleTo={0.98} accessibilityLabel={`Open conversation ${c.title}`}>
                  <View className="flex-row items-center gap-3 rounded-lg border border-line bg-card p-3.5">
                    <View className="h-9 w-9 items-center justify-center rounded-full bg-accent/15">
                      <Sparkles size={15} color={colors.accent} />
                    </View>
                    <View className="flex-1">
                      <Text variant="small" weight="semibold" numberOfLines={1}>
                        {c.title}
                      </Text>
                      <Text variant="caption" tone="muted">
                        {relativeDay(c.updatedAt)}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={colors.textMuted} />
                  </View>
                </PressableScale>
              ))}
            </View>
          ) : (
            <Button label="Start your first conversation" icon={MessageSquarePlus} variant="outline" fullWidth onPress={() => router.push('/coach/chat')} />
          )}
        </View>
      </View>
    </Screen>
  );
}

function ConsistencyStat({ icon: Icon, value, unit }: { icon: IconComponent; value: string; unit: string }) {
  const colors = useColors();
  return (
    <View className="flex-row items-center gap-2">
      <Icon size={18} color={colors.accent} strokeWidth={2.4} />
      <Text variant="body" weight="bold">
        {value}
        <Text variant="small" tone="secondary">
          {' '}
          {unit}
        </Text>
      </Text>
    </View>
  );
}
