import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { ExerciseImage } from '@/components/ui/exercise-image';
import {
  BatteryCharging,
  CalendarDays,
  ChevronRight,
  Clock,
  Dumbbell,
  Flame,
  Play,
  Scale,
  Sparkles,
  Target,
  TrendingUp,
  type IconComponent,
} from '@/components/ui/icons';
import { Badge, Overline } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { useColors, withAlpha } from '@/constants/theme';
import { EXERCISE_BY_ID } from '@/features/exercises/catalog';
import { cn } from '@/lib/utils';
import type { ChatMessage, CoachInsight, WorkoutRecommendation } from '@/types';

const INSIGHT_ICON: Record<CoachInsight['icon'], IconComponent> = {
  trend: TrendingUp,
  recovery: BatteryCharging,
  target: Target,
  flame: Flame,
  balance: Scale,
  calendar: CalendarDays,
};

const TONE = {
  positive: { fg: 'success', bg: 'bg-success/10', border: 'border-success/25' },
  neutral: { fg: 'accentText', bg: 'bg-accent/10', border: 'border-accent/20' },
  warning: { fg: 'warning', bg: 'bg-warning/10', border: 'border-warning/25' },
} as const;

export function InsightCard({ insight }: { insight: CoachInsight }) {
  const colors = useColors();
  const Icon = INSIGHT_ICON[insight.icon];
  const tone = { ...TONE[insight.tone], fg: colors[TONE[insight.tone].fg] };
  return (
    <View className={cn('flex-row gap-3 rounded-lg border bg-card p-4', tone.border)}>
      <View className={cn('h-10 w-10 items-center justify-center rounded-full', tone.bg)}>
        <Icon size={18} color={tone.fg} />
      </View>
      <View className="flex-1">
        <Text variant="body" weight="semibold">
          {insight.title}
        </Text>
        <Text variant="small" tone="secondary" style={{ marginTop: 2 }}>
          {insight.body}
        </Text>
      </View>
    </View>
  );
}

/**
 * Recommended session: a photo header (the lead exercise) fading into the card, a large italic
 * title, tappable exercise rows with load cues, and the start button below the card.
 */
export function RecommendationCard({ workout, onStart, compact }: { workout: WorkoutRecommendation; onStart: () => void; compact?: boolean }) {
  const colors = useColors();
  const lead = workout.exercises.map((e) => EXERCISE_BY_ID[e.exerciseId]).find(Boolean);
  const showPhoto = !compact && Boolean(lead);
  return (
    <View className={compact ? 'gap-3' : 'gap-4'}>
      <View className="overflow-hidden rounded-xl border border-line-strong bg-card">
        {showPhoto && lead ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, width: '64%', height: 176 }}>
            <ExerciseImage slug={lead.slug} muscleGroup={lead.muscleGroup} style={{ flex: 1 }} radius={0} priority="normal" />
            {/* Fade the photo into the card on the left and bottom so the title stays readable. */}
            <LinearGradient
              colors={[colors.card, withAlpha(colors.card, 0.55), withAlpha(colors.card, 0)]}
              locations={[0, 0.35, 0.8]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={[withAlpha(colors.card, 0), colors.card]}
              locations={[0.45, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ) : null}
        {/* Warm wash drawn over the photo too, so photo and card blend without a seam. */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,138,54,0.20)', 'rgba(255,138,54,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.55, y: 0.45 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={{ padding: compact ? 14 : 20, paddingBottom: compact ? 12 : 18, minHeight: showPhoto ? 156 : undefined, justifyContent: 'flex-end' }}>
          <View className="flex-row items-center gap-2">
            <Sparkles size={compact ? 15 : 18} color={colors.accent} />
            <Overline>Recommended workout</Overline>
          </View>
          <Text
            weight="extraboldItalic"
            accessibilityRole="header"
            numberOfLines={2}
            style={{ fontSize: compact ? 26 : 38, lineHeight: compact ? 32 : 46, marginTop: 6, letterSpacing: -0.8 }}>
            {workout.title}
          </Text>
          <View className="mt-1.5 flex-row items-center gap-2">
            <Clock size={compact ? 14 : 16} color={colors.textSecondary} />
            <Text variant={compact ? 'small' : 'body'} tone="secondary">
              {workout.focus} • {workout.estimatedMinutes} min
            </Text>
          </View>
        </View>

        <View className="gap-2 px-2.5 pb-2.5">
          {workout.exercises.map((e, i) => {
            const meta = EXERCISE_BY_ID[e.exerciseId];
            if (!meta) return null;
            return (
              <PressableScale
                key={`${e.exerciseId}-${i}`}
                scaleTo={0.98}
                haptic="selection"
                onPress={() => router.push({ pathname: '/exercises/[id]', params: { id: meta.id } })}
                accessibilityLabel={`${meta.name}, ${e.sets} sets of ${e.reps}${e.note ? `. ${e.note}` : ''}`}>
                <View className="flex-row items-center gap-2.5 rounded-lg border border-line bg-elevated/60 p-2 pr-1.5" style={{ minHeight: compact ? 56 : 62 }}>
                  <ExerciseImage
                    slug={meta.slug}
                    muscleGroup={meta.muscleGroup}
                    style={{ width: compact ? 48 : 56, height: compact ? 38 : 44 }}
                    radius={10}
                    priority="low"
                  />
                  <View className="flex-1 gap-0.5">
                    <Text
                      variant={compact ? 'small' : 'body'}
                      weight="semibold"
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}>
                      {meta.name}
                    </Text>
                    {e.note ? (
                      <View className="flex-row items-start gap-1.5">
                        <Dumbbell size={12} color={colors.accent} strokeWidth={2.4} style={{ marginTop: 2 }} />
                        <Text variant="caption" tone="accent" numberOfLines={2} style={{ flexShrink: 1 }}>
                          {e.note}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View className="rounded-full border border-line bg-elevated px-2 py-1">
                    <Text variant="caption" weight="semibold" style={{ fontSize: 11.5 }}>
                      {e.sets}×{e.reps}
                    </Text>
                  </View>
                  <ChevronRight size={15} color={colors.textMuted} />
                </View>
              </PressableScale>
            );
          })}
        </View>
      </View>
      <Button label="Start this workout" icon={Play} size={compact ? 'md' : 'lg'} fullWidth onPress={onStart} />
    </View>
  );
}

export function ExerciseSuggestions({ ids }: { ids: string[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
      {ids.map((id) => {
        const meta = EXERCISE_BY_ID[id];
        if (!meta) return null;
        return (
          <PressableScale key={id} onPress={() => router.push({ pathname: '/exercises/[id]', params: { id } })} accessibilityLabel={`Open ${meta.name}`}>
            <View className="w-36 overflow-hidden rounded-lg border border-line bg-card">
              <ExerciseImage slug={meta.slug} muscleGroup={meta.muscleGroup} style={{ height: 84 }} radius={0} priority="low" />
              <View className="p-2.5">
                <Text variant="caption" weight="semibold" numberOfLines={2}>
                  {meta.name}
                </Text>
              </View>
            </View>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

function Dot({ delay }: { delay: number }) {
  const colors = useColors();
  const v = useSharedValue(0.3);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 320 }), withTiming(0.3, { duration: 320 })), -1));
  }, [delay, v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: (1 - v.value) * 3 }] }));
  return <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent }, style]} />;
}

export function TypingIndicator() {
  return (
    <View className="flex-row items-end gap-2" accessibilityLabel="Coach is typing">
      <CoachAvatar />
      <View className="flex-row gap-1.5 rounded-xl rounded-bl-sm border border-line bg-card px-4 py-3.5">
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </View>
    </View>
  );
}

export function CoachAvatar() {
  const colors = useColors();
  return (
    <View className="h-8 w-8 items-center justify-center rounded-full border border-accent/40 bg-accent/15">
      <Sparkles size={15} color={colors.accent} />
    </View>
  );
}

export function MessageBubble({
  message,
  onQuickAction,
  onStartWorkout,
  showActions,
}: {
  message: ChatMessage;
  onQuickAction: (text: string) => void;
  onStartWorkout: (w: WorkoutRecommendation) => void;
  showActions: boolean;
}) {
  if (message.role === 'user') {
    return (
      <View className="items-end">
        <View className="max-w-[85%] rounded-xl rounded-br-sm bg-accent px-4 py-3">
          <Text variant="body" tone="ink" weight="medium">
            {message.content}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View className="gap-3">
      <View className="flex-row items-end gap-2">
        <CoachAvatar />
        <View className="max-w-[85%] flex-1 rounded-xl rounded-bl-sm border border-line bg-card px-4 py-3">
          <Text variant="body">{message.content}</Text>
        </View>
      </View>
      {message.workout ? (
        <View className="pl-10">
          <RecommendationCard workout={message.workout} onStart={() => onStartWorkout(message.workout!)} compact />
        </View>
      ) : null}
      {message.exerciseIds?.length ? (
        <View className="pl-10">
          <ExerciseSuggestions ids={message.exerciseIds} />
        </View>
      ) : null}
      {showActions && message.quickActions?.length ? (
        <View className="flex-row flex-wrap gap-2 pl-10">
          {message.quickActions.map((a) => (
            <PressableScale key={a} onPress={() => onQuickAction(a)} accessibilityLabel={a} haptic="selection">
              <View className="rounded-full border border-accent/40 bg-accent/10 px-3.5 py-2">
                <Text variant="caption" weight="semibold" tone="accent">
                  {a}
                </Text>
              </View>
            </PressableScale>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function ReadinessRow({ label, daysSince }: { label: string; daysSince: number | null }) {
  const colors = useColors();
  const ready = daysSince == null || daysSince >= 2;
  const value = daysSince == null ? 1 : Math.min(1, daysSince / 3);
  return (
    <View className="flex-row items-center gap-3">
      <Text variant="small" style={{ width: 82 }}>
        {label}
      </Text>
      <View className="h-2 flex-1 overflow-hidden rounded-full bg-elevated">
        <View style={{ width: `${Math.max(8, value * 100)}%`, height: '100%', borderRadius: 4, backgroundColor: ready ? colors.success : colors.warning }} />
      </View>
      <Badge label={daysSince == null ? 'Fresh' : daysSince === 0 ? 'Today' : `${daysSince}d ago`} tone={ready ? 'success' : 'neutral'} />
    </View>
  );
}
