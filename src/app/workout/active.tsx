import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/ui/ambient-background';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ExerciseImage } from '@/components/ui/exercise-image';
import { IconButton } from '@/components/ui/icon-button';
import { ArrowDown, ArrowUp, Check, ChevronDown, ListPlus, NotebookPen, Pencil, Plus, Trash2 } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { Overline } from '@/components/ui/misc';
import { BottomSheet, confirm, toast } from '@/components/ui/overlays';
import { tapHaptic } from '@/components/ui/pressable-scale';
import { ProgressBar } from '@/components/ui/progress';
import { EmptyState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { ThemeScope } from '@/components/ui/theme-scope';
import { NumberStepper } from '@/components/workout/number-stepper';
import { RestTimer } from '@/components/workout/rest-timer';
import { SetRow } from '@/components/workout/set-row';
import { keyboardAppearanceFor, useColors, fonts } from '@/constants/theme';
import { EXERCISE_BY_ID } from '@/features/exercises/catalog';
import { EmptyWorkoutError, finishActiveWorkout } from '@/features/workouts/finish';
import { usePreviousSets } from '@/features/workouts/hooks';
import { formatDuration, formatWeight, kgToUnit, roundWeight, unitToKg } from '@/lib/format';
import { queryKeys } from '@/lib/query';
import { toErrorMessage } from '@/lib/utils';
import { syncNow } from '@/services/sync';
import { useActiveWorkout } from '@/store/active-workout';
import { useSettings } from '@/store/settings';

function useElapsed(startedAt: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return startedAt ? (now - new Date(startedAt).getTime()) / 1000 : 0;
}

export default function ActiveWorkoutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const workout = useActiveWorkout((s) => s.workout);
  const currentIndex = useActiveWorkout((s) => s.currentIndex);
  const store = useActiveWorkout.getState;
  const unit = useSettings((s) => s.unit);
  const elapsed = useElapsed(workout?.startedAt);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [showList, setShowList] = useState(true);

  const current = workout?.exercises[currentIndex];
  const meta = current ? EXERCISE_BY_ID[current.exerciseId] : undefined;
  const previous = usePreviousSets(current?.exerciseId);
  // The user's explicit pick only applies to the exercise it was made on; otherwise default to
  // the first unfinished set, so switching exercises always lands on the next set to do.
  const [selection, setSelection] = useState<{ exerciseId: string; setId: string } | null>(null);
  const selectedSetId =
    selection && selection.exerciseId === current?.id
      ? selection.setId
      : (current?.sets.find((s) => !s.completed) ?? current?.sets[current.sets.length - 1])?.id ?? null;
  const setSelectedSetId = (setId: string) => current && setSelection({ exerciseId: current.id, setId });

  // Prefill weights from the last session so most sets need a single tap.
  useEffect(() => {
    if (!current || !previous.data?.length || meta?.isTimed) return;
    current.sets.forEach((s, i) => {
      if (s.weightKg == null && !s.completed) {
        const prev = previous.data![Math.min(i, previous.data!.length - 1)];
        store().updateSet(current.id, s.id, { weightKg: prev.weightKg, reps: s.reps ?? prev.reps });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, previous.data]);

  const progress = useMemo(() => {
    if (!workout) return { done: 0, total: 0 };
    const all = workout.exercises.flatMap((e) => e.sets);
    return { done: all.filter((s) => s.completed).length, total: all.length };
  }, [workout]);

  if (!workout) {
    return (
      <View className="flex-1 justify-center bg-background px-5">
        <AmbientBackground />
        <EmptyState icon={ListPlus} title="No workout in progress" body="Start one from Home or Train." actionLabel="Go to Train" onAction={() => router.replace('/train')} />
      </View>
    );
  }

  const selectedSet = current?.sets.find((s) => s.id === selectedSetId) ?? current?.sets[0];
  const next = workout.exercises[currentIndex + 1];
  const weightStep = unit === 'kg' ? 2.5 : 5;

  const completeSelected = () => {
    if (!current || !selectedSet) return;
    if (!meta?.isTimed && (selectedSet.reps == null || selectedSet.reps <= 0)) {
      toast('Enter your reps first', 'error');
      return;
    }
    const completed = store().toggleSetComplete(current.id, selectedSet.id);
    if (completed) {
      tapHaptic('success');
      const refreshed = store().workout?.exercises.find((e) => e.id === current.id);
      const nextOpen = refreshed?.sets.find((s) => !s.completed);
      if (nextOpen) setSelectedSetId(nextOpen.id);
    }
  };

  const finish = async () => {
    const remaining = progress.total - progress.done;
    if (remaining > 0) {
      const ok = await confirm({
        title: 'Finish workout?',
        message: `${remaining} set${remaining === 1 ? ' is' : 's are'} not marked complete and won’t be saved.`,
        confirmLabel: 'Finish',
      });
      if (!ok) return;
    }
    setFinishing(true);
    try {
      const { workout: saved, newRecords } = await finishActiveWorkout();
      await qc.invalidateQueries({ queryKey: queryKeys.workouts(saved.userId) });
      await qc.invalidateQueries({ queryKey: queryKeys.insights(saved.userId) });
      void syncNow(saved.userId);
      router.replace({ pathname: '/workout/summary', params: { id: saved.id, prs: String(newRecords.length) } });
    } catch (error) {
      toast(error instanceof EmptyWorkoutError ? error.message : toErrorMessage(error), 'error');
    } finally {
      setFinishing(false);
    }
  };

  const discard = async () => {
    const ok = await confirm({
      title: 'Discard workout?',
      message: 'Everything logged in this session will be lost.',
      confirmLabel: 'Discard',
      destructive: true,
    });
    if (!ok) return;
    store().clear();
    router.replace('/');
  };

  return (
    <View className="flex-1 bg-background">
      <AmbientBackground intensity="subtle" />
      <View style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center gap-3 px-5 pb-3 pt-2">
          <IconButton icon={ChevronDown} accessibilityLabel="Minimize workout" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} size={40} />
          <Pressable
            className="flex-1"
            accessibilityRole="button"
            accessibilityLabel={`Rename workout, ${workout.name}`}
            onPress={() => {
              setNameDraft(workout.name);
              setRenaming(true);
            }}>
            <View className="flex-row items-center gap-1.5">
              <Text variant="subheading" numberOfLines={1} style={{ flexShrink: 1 }}>
                {workout.name}
              </Text>
              <Pencil size={13} color={colors.textMuted} />
            </View>
            <Text variant="small" tone="accent" weight="semibold" tabular accessibilityLabel={`Elapsed time ${formatDuration(elapsed)}`}>
              {formatDuration(elapsed)}
            </Text>
          </Pressable>
          <Button label="Finish" size="sm" icon={Check} loading={finishing} onPress={finish} />
        </View>
        <View className="px-5 pb-3">
          <ProgressBar value={progress.total ? progress.done / progress.total : 0} height={6} />
          <Text variant="caption" tone="muted" style={{ marginTop: 6 }}>
            {progress.done} of {progress.total} sets · {workout.exercises.length} exercises
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 120, gap: 16 }}>
          {!current || !meta ? (
            <EmptyState
              icon={ListPlus}
              title="Add your first exercise"
              body="Pick from the library — sets and reps are prefilled with recommendations."
              actionLabel="Add exercises"
              onAction={() => router.push('/workout/add-exercise?target=active')}
            />
          ) : (
            <Animated.View key={current.id} entering={FadeIn.duration(250)}>
              <Card padded={false}>
                <Pressable onPress={() => router.push({ pathname: '/exercises/[id]', params: { id: meta.id } })} accessibilityRole="button" accessibilityLabel={`${meta.name} details`}>
                  <ExerciseImage slug={meta.slug} name={meta.name} muscleGroup={meta.muscleGroup} style={{ height: 170 }} radius={0} overlay priority="high" />
                  <ThemeScope mode="dark" style={{ position: 'absolute', left: 16, right: 16, bottom: 14 }}>
                    <Overline>
                      Exercise {currentIndex + 1} of {workout.exercises.length}
                    </Overline>
                    <Text variant="heading" style={{ marginTop: 4 }}>
                      {meta.name}
                    </Text>
                    <Text variant="caption" tone="secondary">
                      {current.sets.length} sets · {meta.recommended.reps} {meta.isTimed ? '' : 'reps '}· Rest {current.restSeconds}s
                    </Text>
                  </ThemeScope>
                </Pressable>

                <View className="gap-4 p-4">
                  <View className="flex-row items-center justify-between rounded-md bg-surface px-3 py-2.5">
                    <Text variant="caption" tone="muted">
                      Last time
                    </Text>
                    <Text variant="small" weight="semibold" numberOfLines={1} style={{ flexShrink: 1, marginLeft: 8 }}>
                      {previous.data?.length
                        ? previous.data
                            .map((s) => (meta.isTimed ? `${s.durationSeconds ?? 0}s` : `${formatWeight(s.weightKg ?? 0, unit, false)}×${s.reps ?? 0}`))
                            .join('  ')
                        : 'First time — set a baseline'}
                    </Text>
                  </View>

                  {selectedSet ? (
                    <>
                      <Text variant="small" weight="semibold" tone="secondary">
                        Set {selectedSet.index + 1} of {current.sets.length}
                        {selectedSet.completed ? ' · completed' : ''}
                      </Text>
                      <View className="flex-row gap-3">
                        {meta.isTimed ? (
                          <NumberStepper
                            label="Seconds"
                            value={selectedSet.durationSeconds}
                            step={5}
                            max={600}
                            onChange={(v) => store().updateSet(current.id, selectedSet.id, { durationSeconds: v })}
                          />
                        ) : (
                          <>
                            <NumberStepper
                              label={meta.isBodyweight ? `Added ${unit}` : `Weight (${unit})`}
                              value={selectedSet.weightKg == null ? null : roundWeight(kgToUnit(selectedSet.weightKg, unit), unit)}
                              step={weightStep}
                              decimals={1}
                              max={unit === 'kg' ? 500 : 1100}
                              placeholder={meta.isBodyweight ? 'BW' : '0'}
                              onChange={(v) => store().updateSet(current.id, selectedSet.id, { weightKg: v == null ? null : unitToKg(v, unit) })}
                            />
                            <NumberStepper
                              label="Reps"
                              value={selectedSet.reps}
                              step={1}
                              max={100}
                              onChange={(v) => store().updateSet(current.id, selectedSet.id, { reps: v })}
                            />
                          </>
                        )}
                      </View>
                      <Button
                        label={selectedSet.completed ? `Undo set ${selectedSet.index + 1}` : `Complete set ${selectedSet.index + 1}`}
                        icon={Check}
                        size="lg"
                        variant={selectedSet.completed ? 'secondary' : 'primary'}
                        fullWidth
                        onPress={completeSelected}
                      />
                    </>
                  ) : null}

                  <View className="gap-1">
                    <View className="flex-row px-3 pb-1">
                      <Text variant="overline" tone="muted" style={{ width: 28 }}>
                        Set
                      </Text>
                      <Text variant="overline" tone="muted" style={{ flex: 1, marginLeft: 12 }}>
                        Previous
                      </Text>
                      <Text variant="overline" tone="muted" style={{ flex: 1.3 }}>
                        Today
                      </Text>
                    </View>
                    {current.sets.map((s, i) => (
                      <SetRow
                        key={s.id}
                        set={s}
                        previous={previous.data?.[i]}
                        unit={unit}
                        timed={meta.isTimed}
                        bodyweight={meta.isBodyweight}
                        selected={s.id === selectedSet?.id}
                        onSelect={() => setSelectedSetId(s.id)}
                        onToggle={() => {
                          setSelectedSetId(s.id);
                          const done = store().toggleSetComplete(current.id, s.id);
                          if (done) tapHaptic('success');
                        }}
                        onRemove={current.sets.length > 1 ? () => store().removeSet(current.id, s.id) : undefined}
                      />
                    ))}
                    <Pressable onPress={() => store().addSet(current.id)} accessibilityRole="button" accessibilityLabel="Add set" className="mt-1 flex-row items-center justify-center gap-2 rounded-md border border-dashed border-line-strong" style={{ height: 46 }}>
                      <Plus size={16} color={colors.accent} />
                      <Text variant="small" weight="semibold" tone="accent">
                        Add set
                      </Text>
                    </Pressable>
                  </View>

                  <View className="flex-row items-start gap-2 rounded-md bg-surface px-3 py-2">
                    <NotebookPen size={16} color={colors.textMuted} style={{ marginTop: 10 }} />
                    <TextInput
                      keyboardAppearance={keyboardAppearanceFor(colors)}
                      value={current.notes}
                      onChangeText={(t) => store().setExerciseNotes(current.id, t)}
                      placeholder="Exercise notes (seat height, grip, cues)"
                      placeholderTextColor={colors.textMuted}
                      multiline
                      style={{ flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 14, minHeight: 40, paddingVertical: 8 }}
                      accessibilityLabel="Exercise notes"
                    />
                  </View>
                </View>
              </Card>
            </Animated.View>
          )}

          {next ? (
            <Card onPress={() => store().setCurrentIndex(currentIndex + 1)} accessibilityLabel={`Next exercise: ${EXERCISE_BY_ID[next.exerciseId]?.name}`}>
              <View className="flex-row items-center gap-3">
                <ExerciseImage slug={next.exerciseId} muscleGroup={EXERCISE_BY_ID[next.exerciseId]?.muscleGroup} style={{ width: 52, height: 52 }} radius={12} priority="low" />
                <View className="flex-1">
                  <Overline tone="muted">Up next</Overline>
                  <Text variant="body" weight="semibold" numberOfLines={1}>
                    {EXERCISE_BY_ID[next.exerciseId]?.name}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    {next.sets.length} sets
                  </Text>
                </View>
              </View>
            </Card>
          ) : null}

          <View>
            <Pressable onPress={() => setShowList((v) => !v)} className="mb-3 flex-row items-center justify-between" accessibilityRole="button" accessibilityLabel={showList ? 'Hide exercise list' : 'Show exercise list'}>
              <Text variant="heading">Exercises</Text>
              <ChevronDown size={20} color={colors.textSecondary} style={{ transform: [{ rotate: showList ? '180deg' : '0deg' }] }} />
            </Pressable>
            {showList ? (
              <View className="gap-2">
                {workout.exercises.map((e, i) => {
                  const m = EXERCISE_BY_ID[e.exerciseId];
                  const done = e.sets.filter((s) => s.completed).length;
                  const isCurrent = i === currentIndex;
                  return (
                    <Animated.View key={e.id} layout={LinearTransition.springify().damping(18)}>
                      <View className={`flex-row items-center gap-3 rounded-lg border p-3 ${isCurrent ? 'border-accent/50 bg-accent/10' : 'border-line bg-card'}`}>
                        <Pressable onPress={() => store().setCurrentIndex(i)} className="flex-1 flex-row items-center gap-3" accessibilityRole="button" accessibilityLabel={`Go to ${m?.name}`}>
                          <View className={`h-8 w-8 items-center justify-center rounded-full ${done === e.sets.length && e.sets.length ? 'bg-success/20' : 'bg-elevated'}`}>
                            {done === e.sets.length && e.sets.length ? <Check size={15} color={colors.success} /> : <Text variant="caption" weight="bold">{i + 1}</Text>}
                          </View>
                          <View className="flex-1">
                            <Text variant="small" weight="semibold" numberOfLines={1}>
                              {m?.name ?? e.exerciseId}
                            </Text>
                            <Text variant="caption" tone="muted">
                              {done}/{e.sets.length} sets
                            </Text>
                          </View>
                        </Pressable>
                        <IconButton icon={ArrowUp} accessibilityLabel={`Move ${m?.name} up`} size={34} variant="ghost" disabled={i === 0} onPress={() => store().moveExercise(e.id, -1)} />
                        <IconButton icon={ArrowDown} accessibilityLabel={`Move ${m?.name} down`} size={34} variant="ghost" disabled={i === workout.exercises.length - 1} onPress={() => store().moveExercise(e.id, 1)} />
                        <IconButton
                          icon={Trash2}
                          accessibilityLabel={`Remove ${m?.name}`}
                          size={34}
                          variant="ghost"
                          color={colors.danger}
                          onPress={async () => {
                            if (done > 0 && !(await confirm({ title: `Remove ${m?.name}?`, message: `${done} completed set${done === 1 ? '' : 's'} will be removed.`, confirmLabel: 'Remove', destructive: true }))) return;
                            store().removeExercise(e.id);
                          }}
                        />
                      </View>
                    </Animated.View>
                  );
                })}
                <Button label="Add exercises" icon={ListPlus} variant="secondary" fullWidth onPress={() => router.push('/workout/add-exercise?target=active')} />
              </View>
            ) : null}
          </View>

          <View className="gap-2">
            <Text variant="heading">Workout notes</Text>
            <TextInput
              keyboardAppearance={keyboardAppearanceFor(colors)}
              value={workout.notes}
              onChangeText={(t) => store().setNotes(t)}
              placeholder="How did it feel? Energy, sleep, anything to remember."
              placeholderTextColor={colors.textMuted}
              multiline
              className="rounded-lg border border-line bg-card"
              style={{ color: colors.text, fontFamily: fonts.regular, fontSize: 15, minHeight: 90, padding: 14, textAlignVertical: 'top' }}
              accessibilityLabel="Workout notes"
            />
          </View>

          <Button label="Discard workout" icon={Trash2} variant="danger" fullWidth onPress={discard} />
        </ScrollView>
        {/* Pinned so the countdown stays visible wherever the user is in the session. */}
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, bottom: Math.max(insets.bottom, 12) + 4 }}>
          <RestTimer />
        </View>
      </KeyboardAvoidingView>

      <BottomSheet visible={renaming} onClose={() => setRenaming(false)} title="Rename workout">
        <Input value={nameDraft} onChangeText={setNameDraft} autoFocus placeholder="Workout name" maxLength={60} returnKeyType="done" onSubmitEditing={() => { store().rename(nameDraft.trim() || workout.name); setRenaming(false); }} />
        <View className="mt-4">
          <Button
            label="Save"
            fullWidth
            onPress={() => {
              store().rename(nameDraft.trim() || workout.name);
              setRenaming(false);
            }}
          />
        </View>
      </BottomSheet>
    </View>
  );
}
