import { EXERCISE_BY_ID } from '@/features/exercises/catalog';
import { recoveryByMuscle, trainingStreak } from '@/features/progress/analytics';
import { workoutVolume } from '@/features/workouts/stats';
import { addDays, startOfDay, startOfWeek } from '@/lib/dates';
import { estimateOneRepMax } from '@/lib/utils';
import type { MuscleGroup, PersonalRecord, Profile, Workout } from '@/types';

/** Compact, model-friendly summary of the user's training — the only data the coach sees. */
export interface CoachContext {
  profile: Pick<Profile, 'name' | 'age' | 'experience' | 'goals' | 'preferredDays' | 'preferredDurationMinutes' | 'trainingPreferences' | 'weightKg'>;
  streakDays: number;
  /** Sessions since Monday — matches the weekly goal shown on Home. */
  sessionsThisWeek: number;
  sessionsLast7: number;
  sessionsLast28: number;
  avgSessionsPerWeek: number;
  volumeLast7Kg: number;
  volumePrev7Kg: number;
  recovery: { group: MuscleGroup; daysSince: number | null }[];
  setsByGroupLast14: Record<MuscleGroup, number>;
  recentWorkouts: {
    name: string;
    date: string;
    durationMinutes: number;
    exercises: { id: string; name: string; topSet: string; sets: number }[];
  }[];
  /** Per exercise: last session's working sets, used for progressive overload advice. */
  lastPerformance: Record<string, { weightKg: number; reps: number[]; date: string; targetReps: string }>;
  topRecords: { exercise: string; e1rmKg: number }[];
}

export function buildCoachContext(workouts: Workout[], profile: Profile, records: PersonalRecord[]): CoachContext {
  const now = new Date();
  const d7 = addDays(startOfDay(now), -6);
  const d14 = addDays(startOfDay(now), -13);
  const d28 = addDays(startOfDay(now), -27);
  const sorted = [...workouts].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const inRange = (from: Date, to?: Date) =>
    sorted.filter((w) => {
      const t = new Date(w.startedAt);
      return t >= from && (!to || t < to);
    });

  const setsByGroupLast14: Record<MuscleGroup, number> = { chest: 0, back: 0, shoulders: 0, arms: 0, legs: 0, core: 0 };
  for (const w of inRange(d14)) {
    for (const e of w.exercises) {
      const g = EXERCISE_BY_ID[e.exerciseId]?.muscleGroup;
      if (g) setsByGroupLast14[g] += e.sets.filter((s) => s.completed).length;
    }
  }

  const lastPerformance: CoachContext['lastPerformance'] = {};
  for (const w of sorted) {
    for (const e of w.exercises) {
      if (lastPerformance[e.exerciseId]) continue;
      const meta = EXERCISE_BY_ID[e.exerciseId];
      const working = e.sets.filter((s) => s.completed && s.type !== 'warmup');
      if (!meta || !working.length || meta.isTimed) continue;
      const top = Math.max(...working.map((s) => s.weightKg ?? 0));
      lastPerformance[e.exerciseId] = {
        weightKg: top,
        reps: working.filter((s) => (s.weightKg ?? 0) === top).map((s) => s.reps ?? 0),
        date: w.startedAt,
        targetReps: meta.recommended.reps,
      };
    }
  }

  const firstDate = sorted.length ? new Date(sorted[sorted.length - 1].startedAt) : now;
  const weeks = Math.max(1, Math.min(12, (now.getTime() - firstDate.getTime()) / (7 * 86400000)));
  const last12w = sorted.filter((w) => new Date(w.startedAt) >= addDays(now, -84));

  return {
    profile: {
      name: profile.name,
      age: profile.age,
      experience: profile.experience,
      goals: profile.goals,
      preferredDays: profile.preferredDays,
      preferredDurationMinutes: profile.preferredDurationMinutes,
      trainingPreferences: profile.trainingPreferences,
      weightKg: profile.weightKg,
    },
    streakDays: trainingStreak(sorted),
    sessionsThisWeek: inRange(startOfWeek(now)).length,
    sessionsLast7: inRange(d7).length,
    sessionsLast28: inRange(d28).length,
    avgSessionsPerWeek: Math.round((last12w.length / weeks) * 10) / 10,
    volumeLast7Kg: Math.round(inRange(d7).reduce((a, w) => a + workoutVolume(w), 0)),
    volumePrev7Kg: Math.round(inRange(addDays(d7, -7), d7).reduce((a, w) => a + workoutVolume(w), 0)),
    recovery: recoveryByMuscle(sorted),
    setsByGroupLast14,
    lastPerformance,
    recentWorkouts: sorted.slice(0, 5).map((w) => ({
      name: w.name,
      date: w.startedAt.slice(0, 10),
      durationMinutes: Math.round(w.durationSeconds / 60),
      exercises: w.exercises.map((e) => {
        const best = e.sets.filter((s) => s.completed).sort((a, b) => estimateOneRepMax(b.weightKg ?? 0, b.reps ?? 0) - estimateOneRepMax(a.weightKg ?? 0, a.reps ?? 0))[0];
        return {
          id: e.exerciseId,
          name: EXERCISE_BY_ID[e.exerciseId]?.name ?? e.exerciseId,
          topSet: best ? (best.durationSeconds ? `${best.durationSeconds}s` : `${best.weightKg ?? 0}kg x ${best.reps ?? 0}`) : '-',
          sets: e.sets.filter((s) => s.completed).length,
        };
      }),
    })),
    topRecords: records
      .filter((r) => r.type === 'estimated_1rm')
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
      .map((r) => ({ exercise: EXERCISE_BY_ID[r.exerciseId]?.name ?? r.exerciseId, e1rmKg: Math.round(r.value) })),
  };
}

/** Context with training history removed — used when the user opts out of sharing workout data. */
export function minimalContext(ctx: CoachContext): CoachContext {
  return {
    ...ctx,
    recentWorkouts: [],
    lastPerformance: {},
    topRecords: [],
  };
}
