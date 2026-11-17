import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseCard } from '@/components/exercises/exercise-card';
import { ExerciseSearchBar } from '@/components/exercises/exercise-filters';
import { AmbientBackground } from '@/components/ui/ambient-background';
import { Search } from '@/components/ui/icons';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useExercises, useFavorites, useToggleFavorite } from '@/features/exercises/hooks';
import { DEFAULT_FILTERS, filterExercises, type ExerciseFilters } from '@/features/exercises/repository';

export default function ExerciseLibraryScreen() {
  const insets = useSafeAreaInsets();
  const [filters, setFilters] = useState<ExerciseFilters>(DEFAULT_FILTERS);
  const exercises = useExercises();
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const favSet = useMemo(() => new Set(favorites.data ?? []), [favorites.data]);
  const results = useMemo(
    () => filterExercises(exercises.data ?? [], filters, favorites.data ?? []),
    [exercises.data, filters, favorites.data],
  );

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <AmbientBackground intensity="subtle" />
      <ScreenHeader title="Exercise library" subtitle={`${exercises.data?.length ?? 0} exercises`} />
      <FlatList
        data={results}
        keyExtractor={(e) => e.id}
        numColumns={2}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32, gap: 12 }}
        initialNumToRender={8}
        windowSize={7}
        ListHeaderComponent={
          <View className="mb-2 gap-4">
            <ExerciseSearchBar filters={filters} onChange={setFilters} />
            <Text variant="caption" tone="muted">
              {results.length} {results.length === 1 ? 'result' : 'results'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          exercises.isLoading ? (
            <View className="flex-row gap-3">
              <Skeleton height={200} width="48%" radius={18} />
              <Skeleton height={200} width="48%" radius={18} />
            </View>
          ) : exercises.error ? (
            <ErrorState error={exercises.error} onRetry={() => exercises.refetch()} />
          ) : (
            <EmptyState
              icon={Search}
              title={filters.muscleGroup === 'favorites' ? 'No favorites yet' : 'No matches'}
              body={filters.muscleGroup === 'favorites' ? 'Tap the heart on any exercise to save it here.' : 'Try a different search or clear some filters.'}
              actionLabel="Clear filters"
              onAction={() => setFilters(DEFAULT_FILTERS)}
            />
          )
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1, maxWidth: '50%' }}>
            <ExerciseCard
              exercise={item}
              favorite={favSet.has(item.id)}
              onPress={() => router.push({ pathname: '/exercises/[id]', params: { id: item.id } })}
              onToggleFavorite={() => toggleFavorite.mutate({ exerciseId: item.id, favorite: !favSet.has(item.id) })}
            />
          </View>
        )}
      />
    </View>
  );
}
