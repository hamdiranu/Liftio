import { create } from 'zustand';

import { EXERCISE_BY_ID } from '@/features/exercises/catalog';
import type { TemplateExercise, WorkoutTemplate } from '@/types';

/** In-progress edits for the workout builder; the exercise picker adds to it from a modal. */
interface TemplateDraftState {
  templateId: string | null;
  exercises: TemplateExercise[];
  load: (template: WorkoutTemplate | null) => void;
  add: (exerciseIds: string[]) => void;
  remove: (index: number) => void;
  move: (index: number, direction: -1 | 1) => void;
  update: (index: number, patch: Partial<TemplateExercise>) => void;
  reset: () => void;
}

export const useTemplateDraft = create<TemplateDraftState>()((set) => ({
  templateId: null,
  exercises: [],
  load: (template) => set({ templateId: template?.id ?? null, exercises: template?.exercises ?? [] }),
  add: (ids) =>
    set((s) => ({
      exercises: [
        ...s.exercises,
        ...ids
          .filter((id) => EXERCISE_BY_ID[id])
          .map((id) => {
            const r = EXERCISE_BY_ID[id].recommended;
            return { exerciseId: id, sets: r.sets, reps: r.reps, restSeconds: r.restSeconds };
          }),
      ],
    })),
  remove: (index) => set((s) => ({ exercises: s.exercises.filter((_, i) => i !== index) })),
  move: (index, direction) =>
    set((s) => {
      const to = index + direction;
      if (to < 0 || to >= s.exercises.length) return s;
      const list = [...s.exercises];
      [list[index], list[to]] = [list[to], list[index]];
      return { exercises: list };
    }),
  update: (index, patch) => set((s) => ({ exercises: s.exercises.map((e, i) => (i === index ? { ...e, ...patch } : e)) })),
  reset: () => set({ templateId: null, exercises: [] }),
}));
