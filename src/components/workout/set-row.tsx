import { memo, useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { Check, X } from '@/components/ui/icons';
import { Text } from '@/components/ui/text';
import { useColors } from '@/constants/theme';
import { formatWeight } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { WeightUnit, WorkoutSet } from '@/types';

export const SetRow = memo(function SetRow({
  set,
  previous,
  unit,
  timed,
  bodyweight,
  selected,
  onSelect,
  onToggle,
  onRemove,
}: {
  set: WorkoutSet;
  previous?: WorkoutSet;
  unit: WeightUnit;
  timed?: boolean;
  bodyweight?: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  const colors = useColors();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (set.completed) scale.value = withSequence(withTiming(1.25, { duration: 110 }), withSpring(1, { damping: 8, stiffness: 240 }));
  }, [set.completed, scale]);
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const prevText = previous
    ? timed
      ? `${previous.durationSeconds ?? 0}s`
      : `${formatWeight(previous.weightKg ?? 0, unit, false)} × ${previous.reps ?? 0}`
    : '—';
  const showBw = bodyweight && !set.weightKg;
  const valueText = timed ? `${set.durationSeconds ?? 0}s` : `${showBw ? 'BW' : set.weightKg != null ? formatWeight(set.weightKg, unit, false) : '—'} × ${set.reps ?? '—'}`;

  return (
    <View
      className={cn('flex-row items-center rounded-md px-3', selected ? 'border border-accent/50 bg-accent/10' : set.completed ? 'bg-success/5' : '')}
      style={{ minHeight: 52 }}>
      <Pressable
        onPress={onSelect}
        accessibilityRole="button"
        accessibilityLabel={`Set ${set.index + 1}, ${valueText}${set.completed ? ', completed' : ''}`}
        className="flex-1 flex-row items-center"
        style={{ minHeight: 52 }}>
      <View className={cn('h-7 w-7 items-center justify-center rounded-full', set.completed ? 'bg-success/20' : 'bg-elevated')}>
        <Text variant="caption" weight="bold" style={{ color: set.completed ? colors.success : colors.textSecondary }}>
          {set.index + 1}
        </Text>
      </View>
      <Text variant="small" tone="muted" style={{ flex: 1, marginLeft: 12 }} numberOfLines={1}>
        {prevText}
      </Text>
      <Text variant="body" weight="bold" style={{ flex: 1.3 }} numberOfLines={1}>
        {valueText}
        {!timed && !showBw ? (
          <Text variant="caption" tone="muted">
            {' '}
            {unit}
          </Text>
        ) : null}
      </Text>
      </Pressable>
      {onRemove && !set.completed ? (
        <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove set ${set.index + 1}`} style={{ marginRight: 10 }}>
          <X size={16} color={colors.textMuted} />
        </Pressable>
      ) : null}
      <Pressable onPress={onToggle} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: set.completed }} accessibilityLabel={`Mark set ${set.index + 1} complete`}>
        <Animated.View style={checkStyle} className={cn('h-9 w-9 items-center justify-center rounded-full border', set.completed ? 'border-success bg-success' : 'border-line-strong')}>
          <Check size={18} color={set.completed ? '#0B2A1C' : colors.textMuted} strokeWidth={3} />
        </Animated.View>
      </Pressable>
    </View>
  );
});
