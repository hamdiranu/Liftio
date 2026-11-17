import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Clock, Copy, Flame, Layers, NotebookPen, Play, Trash2, Weight } from '@/components/ui/icons';
import { SectionHeader, StatTile } from '@/components/ui/misc';
import { confirm, toast } from '@/components/ui/overlays';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { ErrorState, SkeletonCard } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { WorkoutBreakdown } from '@/components/workout/workout-breakdown';
import { useColors } from '@/constants/theme';
import { useUserId } from '@/features/auth/store';
import { useProfile } from '@/features/profile/hooks';
import { useDeleteWorkout, usePersonalRecords, useSaveTemplate, useWorkout } from '@/features/workouts/hooks';
import { summarizeWorkout } from '@/features/workouts/stats';
import { formatLongDate, formatTime } from '@/lib/dates';
import { formatCompact, formatMinutes, formatNumber, kgToUnit } from '@/lib/format';
import { goBack } from '@/lib/navigation';
import { uuid } from '@/lib/utils';
import { nowIso } from '@/services/db';
import { useStartWorkout } from '@/hooks/use-start-workout';
import { useSettings } from '@/store/settings';
import { EXERCISE_BY_ID } from '@/features/exercises/catalog';
import type { MuscleGroup, WorkoutTemplate } from '@/types';

export default function WorkoutDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const workout = useWorkout(id);
  const records = usePersonalRecords();
  const profile = useProfile();
  const unit = useSettings((s) => s.unit);
  const deleteWorkout = useDeleteWorkout();
  const saveTemplate = useSaveTemplate();
  const startWorkout = useStartWorkout();

  const w = workout.data;
  const stats = w ? summarizeWorkout(w, [], profile.data?.weightKg ?? undefined) : null;

  const asTemplate = (): WorkoutTemplate | null =>
    w
      ? {
          id: uuid(),
          userId,
          name: w.name,
          description: `Saved from your ${formatLongDate(w.startedAt)} session.`,
          focus: [...new Set(w.exercises.map((e) => EXERCISE_BY_ID[e.exerciseId]?.muscleGroup).filter((g): g is MuscleGroup => Boolean(g)))],
          estimatedMinutes: Math.max(10, Math.round(w.durationSeconds / 60 / 5) * 5),
          exercises: w.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            sets: e.sets.length,
            reps: String(e.sets[0]?.reps ?? e.sets[0]?.durationSeconds ?? 10),
            restSeconds: e.restSeconds,
          })),
          createdAt: nowIso(),
          updatedAt: nowIso(),
        }
      : null;

  return (
    <Screen
      header={
        <ScreenHeader
          title={w?.name ?? 'Workout'}
          subtitle={w ? `${formatLongDate(w.startedAt)} · ${formatTime(w.startedAt)}` : undefined}
          right={
            w ? (
              <IconButton
                icon={Trash2}
                color={colors.danger}
                accessibilityLabel="Delete workout"
                onPress={async () => {
                  if (!(await confirm({ title: 'Delete this workout?', message: 'It will be removed from your history and stats. This can’t be undone.', confirmLabel: 'Delete', destructive: true }))) return;
                  await deleteWorkout.mutateAsync(w.id);
                  toast('Workout deleted');
                  goBack('/workout/history');
                }}
              />
            ) : null
          }
        />
      }
      footer={
        w ? (
          <View className="flex-row gap-3 px-5 pt-3">
            <View className="flex-1">
              <Button
                label="Save as template"
                icon={Copy}
                variant="secondary"
                size="lg"
                fullWidth
                loading={saveTemplate.isPending}
                onPress={async () => {
                  const t = asTemplate();
                  if (!t) return;
                  await saveTemplate.mutateAsync(t);
                  toast('Saved to your templates');
                }}
              />
            </View>
            <View className="flex-1">
              <Button
                label="Repeat"
                icon={Play}
                size="lg"
                fullWidth
                onPress={() => {
                  const t = asTemplate();
                  if (t) void startWorkout({ kind: 'template', template: t });
                }}
              />
            </View>
          </View>
        ) : null
      }>
      {workout.isLoading ? (
        <View className="gap-3">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={4} />
        </View>
      ) : workout.error || !w || !stats ? (
        <ErrorState error={workout.error ?? new Error('This workout no longer exists.')} onRetry={() => workout.refetch()} />
      ) : (
        <View className="gap-6">
          <View className="gap-3">
            <View className="flex-row gap-3">
              <StatTile label="Duration" value={formatMinutes(stats.durationSeconds)} icon={Clock} />
              <StatTile label="Volume" value={formatCompact(Math.round(kgToUnit(stats.totalVolumeKg, unit)))} unit={unit} icon={Weight} />
            </View>
            <View className="flex-row gap-3">
              <StatTile label="Sets" value={String(stats.completedSets)} unit={`· ${stats.exerciseCount} exercises`} icon={Layers} />
              <StatTile label="Calories (est.)" value={formatNumber(stats.estimatedCalories)} unit="kcal" icon={Flame} />
            </View>
          </View>
          {w.notes ? (
            <Card>
              <View className="flex-row gap-2">
                <NotebookPen size={16} color={colors.accent} />
                <Text variant="small" tone="secondary" style={{ flex: 1 }}>
                  {w.notes}
                </Text>
              </View>
            </Card>
          ) : null}
          <View>
            <SectionHeader title="Exercises" />
            <WorkoutBreakdown workout={w} records={records.data} />
          </View>
        </View>
      )}
    </Screen>
  );
}
