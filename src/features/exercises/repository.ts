import { supabase } from '@/services/supabase';
import type { Difficulty, Equipment, Exercise, ExerciseType, MuscleGroup } from '@/types';
import { EXERCISES } from './catalog';

/**
 * Returns the exercise library. The bundled catalog is always available offline; when
 * Supabase is configured, rows from the `exercises` table are merged on top so the library
 * can be extended server-side without an app release.
 */
export async function fetchExercises(): Promise<Exercise[]> {
  if (!supabase) return EXERCISES;
  try {
    const { data, error } = await supabase
      .from('exercises')
      .select('*, exercise_equipment(equipment)')
      .order('name');
    if (error || !data?.length) return EXERCISES;
    const remote: Exercise[] = data.map((r: any) => ({
      id: r.id,
      slug: r.id,
      name: r.name,
      muscleGroup: r.muscle_group_id,
      primaryMuscle: r.primary_muscle,
      secondaryMuscles: r.secondary_muscles ?? [],
      equipment: (r.exercise_equipment ?? []).map((e: { equipment: Equipment }) => e.equipment),
      type: r.type,
      difficulty: r.difficulty,
      description: r.description ?? '',
      instructions: r.instructions ?? [],
      tips: r.tips ?? [],
      recommended: { sets: r.recommended_sets, reps: r.recommended_reps, restSeconds: r.rest_seconds },
      isTimed: r.is_timed,
      isBodyweight: r.is_bodyweight,
    }));
    const byId = new Map(EXERCISES.map((e) => [e.id, e]));
    for (const e of remote) byId.set(e.id, { ...byId.get(e.id), ...e });
    return [...byId.values()];
  } catch {
    return EXERCISES;
  }
}

export interface ExerciseFilters {
  query: string;
  muscleGroup: MuscleGroup | 'all' | 'favorites';
  equipment: Equipment | 'all';
  type: ExerciseType | 'all';
  difficulty: Difficulty | 'all';
}

export const DEFAULT_FILTERS: ExerciseFilters = {
  query: '',
  muscleGroup: 'all',
  equipment: 'all',
  type: 'all',
  difficulty: 'all',
};

export function filterExercises(exercises: Exercise[], filters: ExerciseFilters, favorites: string[] = []) {
  const q = filters.query.trim().toLowerCase();
  const fav = new Set(favorites);
  return exercises.filter((e) => {
    if (filters.muscleGroup === 'favorites' && !fav.has(e.id)) return false;
    if (filters.muscleGroup !== 'all' && filters.muscleGroup !== 'favorites' && e.muscleGroup !== filters.muscleGroup)
      return false;
    if (filters.equipment !== 'all' && !e.equipment.includes(filters.equipment)) return false;
    if (filters.type !== 'all' && e.type !== filters.type) return false;
    if (filters.difficulty !== 'all' && e.difficulty !== filters.difficulty) return false;
    if (!q) return true;
    return (
      e.name.toLowerCase().includes(q) ||
      e.primaryMuscle.includes(q) ||
      e.secondaryMuscles.some((m) => m.includes(q)) ||
      e.equipment.some((eq) => eq.includes(q)) ||
      e.muscleGroup.includes(q)
    );
  });
}

export function activeFilterCount(filters: ExerciseFilters) {
  return (['equipment', 'type', 'difficulty'] as const).filter((k) => filters[k] !== 'all').length;
}
