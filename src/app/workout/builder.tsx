import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ExerciseImage } from '@/components/ui/exercise-image';
import { IconButton } from '@/components/ui/icon-button';
import { ArrowDown, ArrowUp, ListPlus, Play, Save, Trash2 } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { Overline } from '@/components/ui/misc';
import { confirm, toast } from '@/components/ui/overlays';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState, SkeletonCard } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { MiniStepper } from '@/components/workout/number-stepper';
import { useColors } from '@/constants/theme';
import { useUserId } from '@/features/auth/store';
import { EXERCISE_BY_ID, MUSCLE_GROUPS } from '@/features/exercises/catalog';
import { useDeleteTemplate, useSaveTemplate, useTemplate } from '@/features/workouts/hooks';
import { capitalize } from '@/lib/format';
import { goBack } from '@/lib/navigation';
import { uuid } from '@/lib/utils';
import { nowIso } from '@/services/db';
import { useStartWorkout } from '@/hooks/use-start-workout';
import { useTemplateDraft } from '@/store/template-draft';
import type { MuscleGroup, WorkoutTemplate } from '@/types';

const schema = z.object({
  name: z.string().trim().min(2, 'Give your workout a name').max(60, 'Keep it under 60 characters'),
  description: z.string().trim().max(200, 'Keep it under 200 characters'),
  estimatedMinutes: z.number().int().min(10).max(180),
  focus: z.array(z.enum(MUSCLE_GROUPS)).min(1, 'Pick at least one focus'),
});
type Values = z.infer<typeof schema>;

export default function WorkoutBuilderScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const userId = useUserId();
  const existing = useTemplate(id);
  const saveTemplate = useSaveTemplate();
  const deleteTemplate = useDeleteTemplate();
  const startWorkout = useStartWorkout();
  const draft = useTemplateDraft();

  const { control, handleSubmit, reset, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', estimatedMinutes: 45, focus: [] },
  });

  useEffect(() => {
    if (id && existing.data) {
      draft.load(existing.data);
      reset({
        name: existing.data.name,
        description: existing.data.description,
        estimatedMinutes: existing.data.estimatedMinutes,
        focus: existing.data.focus,
      });
    } else if (!id) {
      draft.load(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, existing.data]);

  const build = (values: Values): WorkoutTemplate => ({
    id: existing.data?.id ?? uuid(),
    userId,
    name: values.name.trim(),
    description: values.description.trim(),
    focus: values.focus as MuscleGroup[],
    estimatedMinutes: values.estimatedMinutes,
    exercises: draft.exercises,
    createdAt: existing.data?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  });

  const onSave = handleSubmit(async (values) => {
    if (!draft.exercises.length) {
      toast('Add at least one exercise', 'error');
      return;
    }
    try {
      await saveTemplate.mutateAsync(build(values));
      toast(id ? 'Template updated' : 'Template saved');
      goBack('/train');
    } catch (e) {
      toast(String(e), 'error');
    }
  });

  const onStart = handleSubmit(async (values) => {
    if (!draft.exercises.length) {
      toast('Add at least one exercise', 'error');
      return;
    }
    await startWorkout({ kind: 'template', template: build(values) });
  });

  if (id && existing.isLoading) {
    return (
      <Screen header={<ScreenHeader title="Edit workout" />}>
        <SkeletonCard lines={5} />
      </Screen>
    );
  }

  return (
    <Screen
      keyboard
      header={
        <ScreenHeader
          title={id ? 'Edit workout' : 'New workout'}
          right={
            id ? (
              <IconButton
                icon={Trash2}
                color={colors.danger}
                accessibilityLabel="Delete template"
                onPress={async () => {
                  if (!(await confirm({ title: 'Delete this template?', message: 'Past workouts stay in your history.', confirmLabel: 'Delete', destructive: true }))) return;
                  await deleteTemplate.mutateAsync(id);
                  toast('Template deleted');
                  goBack('/train');
                }}
              />
            ) : null
          }
        />
      }
      footer={
        <View className="flex-row gap-3 px-5 pt-3">
          <View className="flex-1">
            <Button label="Save template" icon={Save} variant="secondary" size="lg" fullWidth loading={formState.isSubmitting || saveTemplate.isPending} onPress={onSave} />
          </View>
          <View className="flex-1">
            <Button label="Start now" icon={Play} size="lg" fullWidth onPress={onStart} />
          </View>
        </View>
      }>
      <View className="gap-5 pb-4">
        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <Input label="Name" placeholder="Upper body strength" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} maxLength={60} />
          )}
        />
        <Controller
          control={control}
          name="description"
          render={({ field, fieldState }) => (
            <Input label="Description (optional)" placeholder="What is this session for?" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} multiline maxLength={200} />
          )}
        />
        <Controller
          control={control}
          name="focus"
          render={({ field, fieldState }) => (
            <View className="gap-2">
              <Text variant="caption" tone="secondary">
                Focus
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {MUSCLE_GROUPS.map((g) => (
                  <Chip
                    key={g}
                    size="sm"
                    label={capitalize(g)}
                    selected={field.value.includes(g)}
                    onPress={() => field.onChange(field.value.includes(g) ? field.value.filter((x) => x !== g) : [...field.value, g])}
                  />
                ))}
              </View>
              {fieldState.error ? (
                <Text variant="caption" tone="danger">
                  {fieldState.error.message}
                </Text>
              ) : null}
            </View>
          )}
        />
        <Controller
          control={control}
          name="estimatedMinutes"
          render={({ field }) => (
            <View className="flex-row items-center justify-between rounded-lg border border-line bg-card px-4 py-3">
              <Text variant="body" weight="medium">
                Estimated duration
              </Text>
              <MiniStepper value={field.value} onChange={field.onChange} step={5} min={10} max={180} format={(v) => `${v}m`} />
            </View>
          )}
        />

        <View>
          <View className="mb-3 flex-row items-center justify-between">
            <Text variant="heading">Exercises</Text>
            <Text variant="caption" tone="muted">
              {draft.exercises.length} added
            </Text>
          </View>
          {draft.exercises.length === 0 ? (
            <EmptyState icon={ListPlus} title="No exercises yet" body="Add from the library, then set sets, reps and rest." compact />
          ) : (
            <View className="gap-3">
              {draft.exercises.map((e, i) => {
                const meta = EXERCISE_BY_ID[e.exerciseId];
                return (
                  <Animated.View key={`${e.exerciseId}-${i}`} layout={LinearTransition.springify().damping(18)}>
                    <View className="gap-3 rounded-lg border border-line bg-card p-3">
                      <View className="flex-row items-center gap-3">
                        <ExerciseImage slug={e.exerciseId} muscleGroup={meta?.muscleGroup} style={{ width: 48, height: 48 }} radius={12} priority="low" />
                        <View className="flex-1">
                          <Overline tone="muted">#{i + 1}</Overline>
                          <Text variant="body" weight="semibold" numberOfLines={1}>
                            {meta?.name ?? e.exerciseId}
                          </Text>
                        </View>
                        <IconButton icon={ArrowUp} accessibilityLabel="Move up" size={34} variant="ghost" disabled={i === 0} onPress={() => draft.move(i, -1)} />
                        <IconButton icon={ArrowDown} accessibilityLabel="Move down" size={34} variant="ghost" disabled={i === draft.exercises.length - 1} onPress={() => draft.move(i, 1)} />
                        <IconButton icon={Trash2} accessibilityLabel="Remove" size={34} variant="ghost" color={colors.danger} onPress={() => draft.remove(i)} />
                      </View>
                      <View className="flex-row flex-wrap items-center justify-between gap-2">
                        <Field label="Sets">
                          <MiniStepper value={e.sets} onChange={(v) => draft.update(i, { sets: v })} min={1} max={10} />
                        </Field>
                        <Field label={meta?.isTimed ? 'Seconds' : 'Reps'}>
                          <MiniStepper
                            value={Number(e.reps.match(/\d+/)?.[0] ?? 10)}
                            onChange={(v) => draft.update(i, { reps: String(v) })}
                            min={1}
                            max={meta?.isTimed ? 300 : 50}
                            step={meta?.isTimed ? 5 : 1}
                          />
                        </Field>
                        <Field label="Rest">
                          <MiniStepper value={e.restSeconds} onChange={(v) => draft.update(i, { restSeconds: v })} min={15} max={300} step={15} format={(v) => `${v}s`} />
                        </Field>
                      </View>
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          )}
          <View className="mt-3">
            <Button label="Add exercises" icon={ListPlus} variant="outline" fullWidth onPress={() => router.push('/workout/add-exercise?target=builder')} />
          </View>
        </View>
      </View>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="items-center gap-1">
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      {children}
    </View>
  );
}
