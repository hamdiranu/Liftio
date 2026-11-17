import { View } from 'react-native';

import { ChevronRight, Clock, Dumbbell, Layers } from '@/components/ui/icons';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { useColors } from '@/constants/theme';
import { completedSetCount, workoutVolume } from '@/features/workouts/stats';
import { formatShortDate, relativeDay } from '@/lib/dates';
import { formatMinutes, formatVolume } from '@/lib/format';
import { useSettings } from '@/store/settings';
import type { Workout } from '@/types';

export function WorkoutRow({ workout, onPress }: { workout: Workout; onPress: () => void }) {
  const colors = useColors();
  const unit = useSettings((s) => s.unit);
  const date = new Date(workout.startedAt);
  return (
    <PressableScale onPress={onPress} scaleTo={0.98} accessibilityLabel={`${workout.name}, ${formatShortDate(workout.startedAt)}`}>
      <View className="flex-row items-center gap-4 rounded-lg border border-line bg-card p-4">
        <View className="h-14 w-14 items-center justify-center rounded-md border border-accent/25 bg-accent/10">
          <Text variant="caption" tone="accent" weight="semibold">
            {date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
          </Text>
          <Text variant="heading" weight="extrabold" style={{ lineHeight: 22 }}>
            {date.getDate()}
          </Text>
        </View>
        <View className="flex-1 gap-1">
          <Text variant="subheading" numberOfLines={1}>
            {workout.name}
          </Text>
          <Text variant="caption" tone="muted">
            {relativeDay(workout.startedAt)}
          </Text>
          <View className="mt-1 flex-row flex-wrap gap-x-3 gap-y-1">
            <Meta icon={Clock} text={formatMinutes(workout.durationSeconds)} />
            <Meta icon={Dumbbell} text={`${workout.exercises.length} exercises`} />
            <Meta icon={Layers} text={`${completedSetCount(workout)} sets`} />
          </View>
        </View>
        <View className="items-end gap-1">
          <Text variant="small" weight="bold">
            {formatVolume(workoutVolume(workout), unit)}
          </Text>
          <ChevronRight size={18} color={colors.textMuted} />
        </View>
      </View>
    </PressableScale>
  );
}

function Meta({ icon: Icon, text }: { icon: typeof Clock; text: string }) {
  const colors = useColors();
  return (
    <View className="flex-row items-center gap-1">
      <Icon size={12} color={colors.textMuted} />
      <Text variant="caption" tone="secondary">
        {text}
      </Text>
    </View>
  );
}
