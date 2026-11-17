import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { IconButton } from '@/components/ui/icon-button';
import { Heart, Search, SlidersHorizontal, X } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { BottomSheet } from '@/components/ui/overlays';
import { Text } from '@/components/ui/text';
import { useColors } from '@/constants/theme';
import { MUSCLE_GROUPS } from '@/features/exercises/catalog';
import { activeFilterCount, DEFAULT_FILTERS, type ExerciseFilters } from '@/features/exercises/repository';
import { capitalize } from '@/lib/format';
import type { Difficulty, Equipment, ExerciseType } from '@/types';

const EQUIPMENT: Equipment[] = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'bench', 'pull-up bar', 'ez bar', 'plate'];
const TYPES: ExerciseType[] = ['compound', 'isolation', 'bodyweight', 'isometric'];
const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced'];

export function ExerciseSearchBar({
  filters,
  onChange,
  showFavorites = true,
}: {
  filters: ExerciseFilters;
  onChange: (f: ExerciseFilters) => void;
  showFavorites?: boolean;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(filters);
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Input
            icon={Search}
            placeholder="Search exercises, muscles, equipment"
            value={filters.query}
            onChangeText={(query) => onChange({ ...filters, query })}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search exercises"
          />
        </View>
        <View>
          <IconButton icon={SlidersHorizontal} accessibilityLabel="Filters" onPress={() => setOpen(true)} size={52} variant={count ? 'accent' : 'solid'} />
          {count ? (
            <View className="absolute -right-1 -top-1 h-5 min-w-5 items-center justify-center rounded-full border-2 border-background px-1" style={{ backgroundColor: colors.text }}>
              <Text variant="caption" style={{ color: colors.accentInk, fontSize: 10 }}>
                {count}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 20 }}>
        <Chip label="All" selected={filters.muscleGroup === 'all'} onPress={() => onChange({ ...filters, muscleGroup: 'all' })} />
        {showFavorites ? (
          <Chip label="Favorites" icon={Heart} selected={filters.muscleGroup === 'favorites'} onPress={() => onChange({ ...filters, muscleGroup: 'favorites' })} />
        ) : null}
        {MUSCLE_GROUPS.map((g) => (
          <Chip key={g} label={capitalize(g)} selected={filters.muscleGroup === g} onPress={() => onChange({ ...filters, muscleGroup: g })} />
        ))}
      </ScrollView>

      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Filters">
        <ScrollView showsVerticalScrollIndicator={false}>
          <FilterGroup title="Equipment">
            {EQUIPMENT.map((e) => (
              <Chip key={e} size="sm" label={capitalize(e)} selected={filters.equipment === e} onPress={() => onChange({ ...filters, equipment: filters.equipment === e ? 'all' : e })} />
            ))}
          </FilterGroup>
          <FilterGroup title="Exercise type">
            {TYPES.map((t) => (
              <Chip key={t} size="sm" label={capitalize(t)} selected={filters.type === t} onPress={() => onChange({ ...filters, type: filters.type === t ? 'all' : t })} />
            ))}
          </FilterGroup>
          <FilterGroup title="Difficulty">
            {DIFFICULTIES.map((d) => (
              <Chip key={d} size="sm" label={capitalize(d)} selected={filters.difficulty === d} onPress={() => onChange({ ...filters, difficulty: filters.difficulty === d ? 'all' : d })} />
            ))}
          </FilterGroup>
          <View className="mt-2 flex-row gap-3">
            <View className="flex-1">
              <Button
                label="Reset"
                icon={X}
                variant="secondary"
                fullWidth
                onPress={() => onChange({ ...DEFAULT_FILTERS, query: filters.query, muscleGroup: filters.muscleGroup })}
              />
            </View>
            <View className="flex-1">
              <Button label="Show results" fullWidth onPress={() => setOpen(false)} />
            </View>
          </View>
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-5">
      <Text variant="overline" tone="muted" style={{ marginBottom: 10 }}>
        {title}
      </Text>
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}
