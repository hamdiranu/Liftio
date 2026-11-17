import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { ExerciseImage } from '@/components/ui/exercise-image';
import { Check, Heart } from '@/components/ui/icons';
import { PressableScale, tapHaptic } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { ThemeScope } from '@/components/ui/theme-scope';
import { colors, useColors } from '@/constants/theme';
import { capitalize } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Difficulty, Exercise } from '@/types';

export const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  beginner: colors.success,
  intermediate: colors.accentSoft,
  advanced: colors.danger,
};

export const ExerciseCard = memo(function ExerciseCard({
  exercise,
  favorite,
  onPress,
  onToggleFavorite,
}: {
  exercise: Exercise;
  favorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
}) {
  const colors = useColors();
  // The favorite button is a sibling of the card's pressable (not a child) so web doesn't nest <button>s.
  return (
    <View style={{ flex: 1 }}>
      <PressableScale onPress={onPress} scaleTo={0.97} accessibilityLabel={`${exercise.name}, ${exercise.muscleGroup}`}>
      <View className="overflow-hidden rounded-lg border border-line bg-card">
        <View>
          <ExerciseImage slug={exercise.slug} name={exercise.name} muscleGroup={exercise.muscleGroup} style={{ aspectRatio: 1 }} radius={0} overlay priority="low" />
          <ThemeScope mode="dark" style={{ position: 'absolute', left: 12, right: 12, bottom: 10 }}>
            <Text variant="small" weight="bold" numberOfLines={2}>
              {exercise.name}
            </Text>
          </ThemeScope>
        </View>
        <View className="flex-row items-center justify-between px-3 py-2.5">
          <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
            {capitalize(exercise.primaryMuscle)}
          </Text>
          <View className="flex-row items-center gap-1">
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: DIFFICULTY_COLOR[exercise.difficulty] }} />
            <Text variant="caption" tone="muted">
              {capitalize(exercise.difficulty)}
            </Text>
          </View>
        </View>
      </View>
      </PressableScale>
      <Pressable
        onPress={() => {
          tapHaptic('selection');
          onToggleFavorite();
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={favorite ? `Remove ${exercise.name} from favorites` : `Add ${exercise.name} to favorites`}
        style={{ position: 'absolute', top: 10, right: 10 }}
        className="h-9 w-9 items-center justify-center rounded-full bg-black/40">
        <Heart size={17} color={favorite ? colors.accent : '#FFFFFF'} fill={favorite ? colors.accent : 'transparent'} />
      </Pressable>
    </View>
  );
});

export const ExercisePickRow = memo(function ExercisePickRow({
  exercise,
  selected,
  onPress,
  meta,
}: {
  exercise: Exercise;
  selected: boolean;
  onPress: () => void;
  meta?: string;
}) {
  const colors = useColors();
  return (
    <PressableScale onPress={onPress} scaleTo={0.98} haptic="selection" accessibilityState={{ selected }} accessibilityLabel={exercise.name}>
      <View className={cn('flex-row items-center gap-3 rounded-lg border p-2.5', selected ? 'border-accent bg-accent/10' : 'border-line bg-card')}>
        <ExerciseImage slug={exercise.slug} name={exercise.name} muscleGroup={exercise.muscleGroup} style={{ width: 56, height: 56 }} radius={12} priority="low" />
        <View className="flex-1">
          <Text variant="body" weight="semibold" numberOfLines={1}>
            {exercise.name}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {meta ?? `${capitalize(exercise.primaryMuscle)} · ${exercise.equipment.map(capitalize).join(', ')}`}
          </Text>
        </View>
        <View className={cn('h-7 w-7 items-center justify-center rounded-full border', selected ? 'border-accent bg-accent' : 'border-line-strong')}>
          {selected ? <Check size={16} color={colors.accentInk} strokeWidth={3} /> : null}
        </View>
      </View>
    </PressableScale>
  );
});
