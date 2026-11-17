import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExercisePickRow } from '@/components/exercises/exercise-card';
import { ExerciseSearchBar } from '@/components/exercises/exercise-filters';
import { AmbientBackground } from '@/components/ui/ambient-background';
import { Button } from '@/components/ui/button';
import { ListPlus, Search } from '@/components/ui/icons';
import { toast } from '@/components/ui/overlays';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/states';
import { useExercises, useFavorites } from '@/features/exercises/hooks';
import { DEFAULT_FILTERS, filterExercises, type ExerciseFilters } from '@/features/exercises/repository';
import { useActiveWorkout } from '@/store/active-workout';
import { useTemplateDraft } from '@/store/template-draft';

/** Multi-select exercise picker; `target` decides whether picks go to the live session or the builder. */
export default function AddExerciseScreen() {
  const { target = 'active' } = useLocalSearchParams<{ target?: 'active' | 'builder' }>();
  const insets = useSafeAreaInsets();
  const exercises = useExercises();
  const favorites = useFavorites();
  const [filters, setFilters] = useState<ExerciseFilters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<string[]>([]);
  // Select stable references from the stores; deriving arrays inside a selector would return a
  // new value on every render and loop the subscription.
  const activeExercises = useActiveWorkout((s) => s.workout?.exercises);
  const draftExercises = useTemplateDraft((s) => s.exercises);
  const already = useMemo(
    () => new Set((target === 'builder' ? draftExercises : (activeExercises ?? [])).map((e) => e.exerciseId)),
    [target, draftExercises, activeExercises],
  );

  const results = useMemo(
    () => filterExercises(exercises.data ?? [], filters, favorites.data ?? []),
    [exercises.data, filters, favorites.data],
  );

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const confirmSelection = () => {
    if (!selected.length) return;
    if (target === 'builder') {
      useTemplateDraft.getState().add(selected);
    } else {
      if (!useActiveWorkout.getState().workout) {
        toast('No workout in progress', 'error');
        return;
      }
      useActiveWorkout.getState().addExercises(selected);
      useActiveWorkout.getState().setCurrentIndex(useActiveWorkout.getState().workout!.exercises.length - selected.length);
    }
    toast(`${selected.length} exercise${selected.length === 1 ? '' : 's'} added`);
    if (router.canGoBack()) router.back();
    else router.replace(target === 'builder' ? '/workout/builder' : '/workout/active');
  };

  return (
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
      <AmbientBackground intensity="subtle" />
      <ScreenHeader back="close" title="Add exercises" subtitle={selected.length ? `${selected.length} selected` : 'Tap to select one or more'} />
      <FlatList
        data={results}
        keyExtractor={(e) => e.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 10 }}
        ListHeaderComponent={
          <View className="mb-2">
            <ExerciseSearchBar filters={filters} onChange={setFilters} />
          </View>
        }
        ListEmptyComponent={<EmptyState icon={Search} title="No matches" body="Try another search or filter." compact />}
        renderItem={({ item }) => (
          <ExercisePickRow
            exercise={item}
            selected={selected.includes(item.id)}
            onPress={() => toggle(item.id)}
            meta={already.has(item.id) ? 'Already in this workout' : undefined}
          />
        )}
      />
      <View className="absolute bottom-0 left-0 right-0 border-t border-line bg-surface px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 14) }}>
        <Button
          label={selected.length ? `Add ${selected.length} exercise${selected.length === 1 ? '' : 's'}` : 'Select exercises'}
          icon={ListPlus}
          size="lg"
          fullWidth
          disabled={!selected.length}
          onPress={confirmSelection}
        />
      </View>
    </View>
  );
}
