import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/ui/ambient-background';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ExerciseImage } from '@/components/ui/exercise-image';
import { IconButton } from '@/components/ui/icon-button';
import { ChevronLeft, Clock, Dumbbell, Heart, Info, Layers, ListPlus, Play, Repeat, Target, Trophy } from '@/components/ui/icons';
import { Badge, KeyValue, Overline, SectionHeader } from '@/components/ui/misc';
import { toast } from '@/components/ui/overlays';
import { EmptyState, SkeletonCard } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { ThemeScope } from '@/components/ui/theme-scope';
import { EXERCISE_LIBRARY } from '@/constants/routes';
import { useColors } from '@/constants/theme';
import { useExercise, useFavorites, useToggleFavorite } from '@/features/exercises/hooks';
import { useExerciseHistory, usePersonalRecords } from '@/features/workouts/hooks';
import { formatShortDate } from '@/lib/dates';
import { capitalize, formatWeight } from '@/lib/format';
import { useStartWorkout } from '@/hooks/use-start-workout';
import { useActiveWorkout } from '@/store/active-workout';
import { useSettings } from '@/store/settings';

export default function ExerciseDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const exercise = useExercise(id);
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const history = useExerciseHistory(id);
  const records = usePersonalRecords();
  const unit = useSettings((s) => s.unit);
  const active = useActiveWorkout((s) => s.workout);
  const addExercises = useActiveWorkout((s) => s.addExercises);
  const startWorkout = useStartWorkout();

  const isFavorite = Boolean(id && favorites.data?.includes(id));
  const prs = useMemo(() => (records.data ?? []).filter((r) => r.exerciseId === id), [records.data, id]);
  const best1rm = prs.find((r) => r.type === 'estimated_1rm');
  const bestWeight = prs.find((r) => r.type === 'max_weight');
  const bestReps = prs.find((r) => r.type === 'max_reps');

  if (!exercise) {
    return (
      <View className="flex-1 justify-center bg-background px-5">
        <EmptyState icon={Info} title="Exercise not found" body="It may have been removed from the library." actionLabel="Back to library" onAction={() => router.replace(EXERCISE_LIBRARY)} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <AmbientBackground intensity="subtle" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false}>
        <ThemeScope mode="dark">
          <ExerciseImage slug={exercise.slug} name={exercise.name} muscleGroup={exercise.muscleGroup} style={{ height: 340 }} radius={0} overlay priority="high" />
          <View className="absolute left-0 right-0 flex-row justify-between px-5" style={{ top: insets.top + 8 }}>
            <IconButton icon={ChevronLeft} accessibilityLabel="Go back" onPress={() => (router.canGoBack() ? router.back() : router.replace(EXERCISE_LIBRARY))} />
            <IconButton
              icon={Heart}
              accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              color={isFavorite ? colors.accent : undefined}
              onPress={() => {
                toggleFavorite.mutate({ exerciseId: exercise.id, favorite: !isFavorite });
                toast(isFavorite ? 'Removed from favorites' : 'Saved to favorites');
              }}
            />
          </View>
          <View className="absolute bottom-5 left-5 right-5">
            <Overline>{exercise.muscleGroup}</Overline>
            <Text variant="title" style={{ marginTop: 6 }}>
              {exercise.name}
            </Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              <Badge label={capitalize(exercise.difficulty)} tone={exercise.difficulty === 'advanced' ? 'danger' : exercise.difficulty === 'beginner' ? 'success' : 'accent'} />
              <Badge label={capitalize(exercise.type)} tone="neutral" />
              {exercise.equipment.map((e) => (
                <Badge key={e} label={capitalize(e)} tone="neutral" icon={Dumbbell} />
              ))}
            </View>
          </View>
        </ThemeScope>

        <View className="gap-6 px-5 pt-5">
          <Text variant="body" tone="secondary">
            {exercise.description}
          </Text>

          <Card>
            <View className="flex-row">
              <KeyValue label="Sets" value={String(exercise.recommended.sets)} />
              <View className="w-px bg-line" />
              <KeyValue label={exercise.isTimed ? 'Hold' : 'Reps'} value={exercise.recommended.reps} />
              <View className="w-px bg-line" />
              <KeyValue label="Rest" value={`${exercise.recommended.restSeconds}s`} />
            </View>
          </Card>

          <View>
            <SectionHeader title="Muscles worked" />
            <View className="gap-3">
              <View className="flex-row items-center gap-3 rounded-lg border border-accent/30 bg-accent/10 p-3">
                <Target size={18} color={colors.accent} />
                <View className="flex-1">
                  <Text variant="caption" tone="accent">
                    Primary
                  </Text>
                  <Text variant="body" weight="semibold">
                    {capitalize(exercise.primaryMuscle)}
                  </Text>
                </View>
              </View>
              {exercise.secondaryMuscles.length ? (
                <View className="flex-row flex-wrap gap-2">
                  {exercise.secondaryMuscles.map((m) => (
                    <Badge key={m} label={capitalize(m)} tone="neutral" />
                  ))}
                </View>
              ) : null}
            </View>
          </View>

          <View>
            <SectionHeader title="How to do it" />
            <View className="gap-3">
              {exercise.instructions.map((step, i) => (
                <View key={i} className="flex-row gap-3">
                  <View className="h-7 w-7 items-center justify-center rounded-full bg-elevated">
                    <Text variant="caption" weight="bold" tone="accent">
                      {i + 1}
                    </Text>
                  </View>
                  <Text variant="body" style={{ flex: 1 }}>
                    {step}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {exercise.tips.length ? (
            <Card variant="glow">
              <Overline>Coach tips</Overline>
              {exercise.tips.map((t) => (
                <Text key={t} variant="small" tone="secondary" style={{ marginTop: 6 }}>
                  • {t}
                </Text>
              ))}
            </Card>
          ) : null}

          <View>
            <SectionHeader title="Your records" />
            <View className="flex-row gap-3">
              <RecordTile icon={Trophy} label="Est. 1RM" value={best1rm ? formatWeight(best1rm.value, unit) : '—'} />
              <RecordTile icon={Dumbbell} label="Heaviest" value={bestWeight ? formatWeight(bestWeight.value, unit) : '—'} />
              <RecordTile icon={Repeat} label={exercise.isTimed ? 'Longest' : 'Most reps'} value={bestReps ? `${Math.round(bestReps.value)}${exercise.isTimed ? 's' : ''}` : '—'} />
            </View>
          </View>

          <View>
            <SectionHeader title="History" />
            {history.isLoading ? (
              <SkeletonCard lines={2} />
            ) : !history.data?.length ? (
              <EmptyState icon={Clock} title="No sessions yet" body="Log this exercise and your sets will appear here." compact />
            ) : (
              <View className="gap-3">
                {history.data.slice(0, 6).map((h) => (
                  <Card key={h.workoutId} onPress={() => router.push({ pathname: '/workout/[id]', params: { id: h.workoutId } })} accessibilityLabel={`${h.workoutName} on ${formatShortDate(h.date)}`}>
                    <View className="flex-row items-center justify-between">
                      <Text variant="small" weight="semibold">
                        {formatShortDate(h.date)} · {h.workoutName}
                      </Text>
                      <View className="flex-row items-center gap-1">
                        <Layers size={12} color={colors.textMuted} />
                        <Text variant="caption" tone="muted">
                          {h.sets.length} sets
                        </Text>
                      </View>
                    </View>
                    <Text variant="caption" tone="secondary" style={{ marginTop: 6 }}>
                      {h.sets
                        .map((s) => (s.durationSeconds ? `${s.durationSeconds}s` : `${!s.weightKg && exercise.isBodyweight ? 'BW' : formatWeight(s.weightKg ?? 0, unit, false)} × ${s.reps ?? 0}`))
                        .join('   ')}
                    </Text>
                  </Card>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-line bg-background/95 px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 14) }}>
        {active ? (
          <Button
            label={`Add to ${active.name}`}
            icon={ListPlus}
            size="lg"
            fullWidth
            onPress={() => {
              addExercises([exercise.id]);
              toast(`${exercise.name} added`);
              router.push('/workout/active');
            }}
          />
        ) : (
          <Button label="Start workout with this" icon={Play} size="lg" fullWidth onPress={() => void startWorkout({ kind: 'exercises', name: exercise.name, exerciseIds: [exercise.id] })} />
        )}
      </View>
    </View>
  );
}

function RecordTile({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string }) {
  const colors = useColors();
  return (
    <View className="flex-1 items-center rounded-lg border border-line bg-card px-2 py-4">
      <Icon size={18} color={colors.accent} />
      <Text variant="subheading" weight="bold" style={{ marginTop: 8 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}
