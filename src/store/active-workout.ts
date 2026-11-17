import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { EXERCISE_BY_ID } from '@/features/exercises/catalog';
import { targetReps, targetSeconds } from '@/features/workouts/templates';
import { uuid } from '@/lib/utils';
import { kvStorage } from '@/services/kv';
import type {
  TemplateExercise,
  Workout,
  WorkoutExercise,
  WorkoutRecommendation,
  WorkoutSet,
  WorkoutTemplate,
} from '@/types';

export interface RestState {
  endsAt: number | null;
  durationSeconds: number;
  workoutExerciseId: string | null;
}

interface ActiveWorkoutState {
  workout: Workout | null;
  currentIndex: number;
  rest: RestState;
  hydrated: boolean;

  start: (input: { userId: string; name: string; templateId?: string | null; exercises?: TemplateExercise[] }) => void;
  startFromTemplate: (userId: string, template: WorkoutTemplate) => void;
  startFromRecommendation: (userId: string, rec: WorkoutRecommendation) => void;
  rename: (name: string) => void;
  setNotes: (notes: string) => void;

  addExercises: (exerciseIds: string[]) => void;
  removeExercise: (workoutExerciseId: string) => void;
  moveExercise: (workoutExerciseId: string, direction: -1 | 1) => void;
  setExerciseNotes: (workoutExerciseId: string, notes: string) => void;
  setExerciseRest: (workoutExerciseId: string, seconds: number) => void;
  setCurrentIndex: (index: number) => void;

  addSet: (workoutExerciseId: string) => void;
  removeSet: (workoutExerciseId: string, setId: string) => void;
  updateSet: (workoutExerciseId: string, setId: string, patch: Partial<WorkoutSet>) => void;
  toggleSetComplete: (workoutExerciseId: string, setId: string) => boolean;

  startRest: (seconds: number, workoutExerciseId?: string | null) => void;
  adjustRest: (deltaSeconds: number) => void;
  skipRest: () => void;

  clear: () => void;
}

const EMPTY_REST: RestState = { endsAt: null, durationSeconds: 0, workoutExerciseId: null };

function makeSets(te: Pick<TemplateExercise, 'exerciseId' | 'sets' | 'reps'>): WorkoutSet[] {
  const meta = EXERCISE_BY_ID[te.exerciseId];
  return Array.from({ length: Math.max(1, te.sets) }, (_, i) => ({
    id: uuid(),
    index: i,
    type: 'working' as const,
    weightKg: null,
    reps: meta?.isTimed ? null : targetReps(te.reps),
    durationSeconds: meta?.isTimed ? targetSeconds(te.reps) : null,
    completed: false,
    completedAt: null,
  }));
}

function makeExercise(te: TemplateExercise, order: number): WorkoutExercise {
  return {
    id: uuid(),
    exerciseId: te.exerciseId,
    order,
    notes: '',
    restSeconds: te.restSeconds,
    sets: makeSets(te),
  };
}

function updateExercise(
  workout: Workout,
  workoutExerciseId: string,
  fn: (e: WorkoutExercise) => WorkoutExercise,
): Workout {
  return {
    ...workout,
    exercises: workout.exercises.map((e) => (e.id === workoutExerciseId ? fn(e) : e)),
  };
}

export const useActiveWorkout = create<ActiveWorkoutState>()(
  persist(
    (set, get) => ({
      workout: null,
      currentIndex: 0,
      rest: EMPTY_REST,
      hydrated: false,

      start: ({ userId, name, templateId = null, exercises = [] }) => {
        set({
          workout: {
            id: uuid(),
            userId,
            name: name.trim() || 'Workout',
            status: 'in_progress',
            startedAt: new Date().toISOString(),
            endedAt: null,
            durationSeconds: 0,
            notes: '',
            templateId,
            exercises: exercises.map(makeExercise),
          },
          currentIndex: 0,
          rest: EMPTY_REST,
        });
      },

      startFromTemplate: (userId, template) =>
        get().start({ userId, name: template.name, templateId: template.id, exercises: template.exercises }),

      startFromRecommendation: (userId, rec) =>
        get().start({
          userId,
          name: rec.title,
          exercises: rec.exercises
            .filter((e) => EXERCISE_BY_ID[e.exerciseId])
            .map((e) => ({
              exerciseId: e.exerciseId,
              sets: e.sets,
              reps: e.reps,
              restSeconds: EXERCISE_BY_ID[e.exerciseId].recommended.restSeconds,
            })),
        }),

      rename: (name) => set((s) => (s.workout ? { workout: { ...s.workout, name } } : s)),
      setNotes: (notes) => set((s) => (s.workout ? { workout: { ...s.workout, notes } } : s)),

      addExercises: (exerciseIds) =>
        set((s) => {
          if (!s.workout) return s;
          const start = s.workout.exercises.length;
          const added = exerciseIds
            .filter((id) => EXERCISE_BY_ID[id])
            .map((id, i) => {
              const meta = EXERCISE_BY_ID[id];
              return makeExercise(
                { exerciseId: id, sets: meta.recommended.sets, reps: meta.recommended.reps, restSeconds: meta.recommended.restSeconds },
                start + i,
              );
            });
          return { workout: { ...s.workout, exercises: [...s.workout.exercises, ...added] } };
        }),

      removeExercise: (workoutExerciseId) =>
        set((s) => {
          if (!s.workout) return s;
          const exercises = s.workout.exercises
            .filter((e) => e.id !== workoutExerciseId)
            .map((e, order) => ({ ...e, order }));
          return {
            workout: { ...s.workout, exercises },
            currentIndex: Math.min(s.currentIndex, Math.max(0, exercises.length - 1)),
          };
        }),

      moveExercise: (workoutExerciseId, direction) =>
        set((s) => {
          if (!s.workout) return s;
          const list = [...s.workout.exercises];
          const from = list.findIndex((e) => e.id === workoutExerciseId);
          const to = from + direction;
          if (from < 0 || to < 0 || to >= list.length) return s;
          [list[from], list[to]] = [list[to], list[from]];
          const currentId = s.workout.exercises[s.currentIndex]?.id;
          const exercises = list.map((e, order) => ({ ...e, order }));
          return {
            workout: { ...s.workout, exercises },
            currentIndex: Math.max(0, exercises.findIndex((e) => e.id === currentId)),
          };
        }),

      setExerciseNotes: (id, notes) =>
        set((s) => (s.workout ? { workout: updateExercise(s.workout, id, (e) => ({ ...e, notes })) } : s)),

      setExerciseRest: (id, restSeconds) =>
        set((s) => (s.workout ? { workout: updateExercise(s.workout, id, (e) => ({ ...e, restSeconds })) } : s)),

      setCurrentIndex: (index) =>
        set((s) => ({ currentIndex: Math.max(0, Math.min(index, (s.workout?.exercises.length ?? 1) - 1)) })),

      addSet: (id) =>
        set((s) => {
          if (!s.workout) return s;
          return {
            workout: updateExercise(s.workout, id, (e) => {
              const last = e.sets[e.sets.length - 1];
              const next: WorkoutSet = {
                id: uuid(),
                index: e.sets.length,
                type: 'working',
                weightKg: last?.weightKg ?? null,
                reps: last?.reps ?? null,
                durationSeconds: last?.durationSeconds ?? null,
                completed: false,
                completedAt: null,
              };
              return { ...e, sets: [...e.sets, next] };
            }),
          };
        }),

      removeSet: (id, setId) =>
        set((s) => {
          if (!s.workout) return s;
          return {
            workout: updateExercise(s.workout, id, (e) => ({
              ...e,
              sets: e.sets.filter((x) => x.id !== setId).map((x, index) => ({ ...x, index })),
            })),
          };
        }),

      updateSet: (id, setId, patch) =>
        set((s) => {
          if (!s.workout) return s;
          return {
            workout: updateExercise(s.workout, id, (e) => ({
              ...e,
              sets: e.sets.map((x) => (x.id === setId ? { ...x, ...patch } : x)),
            })),
          };
        }),

      toggleSetComplete: (id, setId) => {
        const { workout } = get();
        if (!workout) return false;
        const exercise = workout.exercises.find((e) => e.id === id);
        const target = exercise?.sets.find((x) => x.id === setId);
        if (!exercise || !target) return false;
        const completed = !target.completed;
        get().updateSet(id, setId, { completed, completedAt: completed ? new Date().toISOString() : null });
        if (completed) {
          get().startRest(exercise.restSeconds, id);
          // Auto-advance once every set of this exercise is done.
          const refreshed = get().workout!.exercises.find((e) => e.id === id)!;
          const idx = get().workout!.exercises.findIndex((e) => e.id === id);
          if (refreshed.sets.every((x) => x.completed) && idx === get().currentIndex) {
            const nextIdx = get().workout!.exercises.findIndex((e, i) => i > idx && e.sets.some((x) => !x.completed));
            if (nextIdx >= 0) set({ currentIndex: nextIdx });
          }
        }
        return completed;
      },

      startRest: (seconds, workoutExerciseId = null) =>
        set({ rest: { endsAt: Date.now() + seconds * 1000, durationSeconds: seconds, workoutExerciseId } }),

      adjustRest: (delta) =>
        set((s) => {
          if (!s.rest.endsAt) return s;
          const endsAt = Math.max(Date.now(), s.rest.endsAt + delta * 1000);
          return { rest: { ...s.rest, endsAt, durationSeconds: Math.max(1, s.rest.durationSeconds + delta) } };
        }),

      skipRest: () => set({ rest: EMPTY_REST }),

      clear: () => set({ workout: null, currentIndex: 0, rest: EMPTY_REST }),
    }),
    {
      name: 'reptrack.active-workout',
      storage: kvStorage,
      partialize: ({ workout, currentIndex, rest }) => ({ workout, currentIndex, rest }),
      onRehydrateStorage: () => () => useActiveWorkout.setState({ hydrated: true }),
    },
  ),
);
