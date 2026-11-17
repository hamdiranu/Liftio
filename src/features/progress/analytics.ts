import { EXERCISE_BY_ID, MUSCLE_GROUPS } from '@/features/exercises/catalog';
import { estimateCalories, workoutVolume } from '@/features/workouts/stats';
import { addDays, DAY_MS, rangeStart, startOfDay, startOfWeek, WEEKDAY_LABELS, WEEKDAYS } from '@/lib/dates';
import { estimateOneRepMax } from '@/lib/utils';
import type { DateRange, MuscleGroup, Workout } from '@/types';

export interface Overview {
  workouts: number;
  volumeKg: number;
  avgDurationSeconds: number;
  totalSets: number;
  calories: number;
}

export function overview(workouts: Workout[], bodyWeightKg?: number): Overview {
  const sets = workouts.reduce((acc, w) => acc + w.exercises.reduce((a, e) => a + e.sets.filter((s) => s.completed).length, 0), 0);
  const volume = workouts.reduce((acc, w) => acc + workoutVolume(w), 0);
  const duration = workouts.reduce((acc, w) => acc + w.durationSeconds, 0);
  return {
    workouts: workouts.length,
    volumeKg: volume,
    avgDurationSeconds: workouts.length ? duration / workouts.length : 0,
    totalSets: sets,
    calories: workouts.reduce((acc, w) => acc + estimateCalories(w.durationSeconds, workoutVolume(w), bodyWeightKg), 0),
  };
}

/** Percentage change between the current window and the window before it. */
export function changeVsPrevious(all: Workout[], range: DateRange, metric: (ws: Workout[]) => number) {
  const start = rangeStart(range);
  if (!start) return null;
  const length = startOfDay(new Date()).getTime() + DAY_MS - start.getTime();
  const prevStart = new Date(start.getTime() - length);
  const current = all.filter((w) => new Date(w.startedAt) >= start);
  const previous = all.filter((w) => {
    const d = new Date(w.startedAt);
    return d >= prevStart && d < start;
  });
  const a = metric(current);
  const b = metric(previous);
  if (b === 0) return a > 0 ? 100 : null;
  return ((a - b) / b) * 100;
}

export interface Bucket {
  key: number;
  label: string;
  start: Date;
  volume: number;
  workouts: number;
  minutes: number;
}

/** Daily buckets for 7 days, weekly buckets otherwise. */
export function volumeBuckets(workouts: Workout[], range: DateRange): Bucket[] {
  const today = startOfDay(new Date());
  if (range === '7d') {
    return Array.from({ length: 7 }, (_, i) => {
      const start = addDays(today, i - 6);
      const day = workouts.filter((w) => startOfDay(new Date(w.startedAt)).getTime() === start.getTime());
      return {
        key: i,
        label: WEEKDAY_LABELS[WEEKDAYS[(start.getDay() + 6) % 7]].slice(0, 1),
        start,
        volume: day.reduce((a, w) => a + workoutVolume(w), 0),
        workouts: day.length,
        minutes: day.reduce((a, w) => a + w.durationSeconds / 60, 0),
      };
    });
  }
  const earliest = workouts.length
    ? startOfWeek(new Date(Math.min(...workouts.map((w) => new Date(w.startedAt).getTime()))))
    : startOfWeek(today);
  const fromRange = rangeStart(range);
  const first = fromRange ? startOfWeek(fromRange) : earliest;
  const weeks = Math.max(1, Math.round((startOfWeek(today).getTime() - first.getTime()) / (7 * DAY_MS)) + 1);
  const count = Math.min(weeks, 26);
  return Array.from({ length: count }, (_, i) => {
    const start = addDays(startOfWeek(today), (i - count + 1) * 7);
    const end = addDays(start, 7);
    const inWeek = workouts.filter((w) => {
      const d = new Date(w.startedAt);
      return d >= start && d < end;
    });
    return {
      key: i,
      label: start.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
      start,
      volume: inWeek.reduce((a, w) => a + workoutVolume(w), 0),
      workouts: inWeek.length,
      minutes: inWeek.reduce((a, w) => a + w.durationSeconds / 60, 0),
    };
  });
}

export interface WeekDayActivity {
  key: number;
  label: string;
  minutes: number;
  volume: number;
  trained: boolean;
  isToday: boolean;
}

export function currentWeekActivity(workouts: Workout[]): WeekDayActivity[] {
  const start = startOfWeek(new Date());
  const today = startOfDay(new Date()).getTime();
  return WEEKDAYS.map((d, i) => {
    const day = addDays(start, i);
    const list = workouts.filter((w) => startOfDay(new Date(w.startedAt)).getTime() === day.getTime());
    return {
      key: i,
      label: WEEKDAY_LABELS[d].slice(0, 1),
      minutes: Math.round(list.reduce((a, w) => a + w.durationSeconds / 60, 0)),
      volume: list.reduce((a, w) => a + workoutVolume(w), 0),
      trained: list.length > 0,
      isToday: day.getTime() === today,
    };
  });
}

/** Consecutive training run in days, allowing up to two rest days between sessions. */
export function trainingStreak(workouts: Workout[]) {
  if (!workouts.length) return 0;
  const days = [...new Set(workouts.map((w) => startOfDay(new Date(w.startedAt)).getTime()))].sort((a, b) => b - a);
  const today = startOfDay(new Date()).getTime();
  if ((today - days[0]) / DAY_MS > 2) return 0;
  let first = days[0];
  for (let i = 1; i < days.length; i++) {
    if ((days[i - 1] - days[i]) / DAY_MS > 3) break;
    first = days[i];
  }
  return Math.round((today - first) / DAY_MS) + 1;
}

export interface StrengthPoint {
  key: number;
  date: string;
  e1rm: number;
  topWeight: number;
}

export function strengthProgression(workouts: Workout[], exerciseId: string): StrengthPoint[] {
  return [...workouts]
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((w) => {
      const sets = w.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets.filter((s) => s.completed));
      const best = sets.reduce(
        (acc, s) => {
          const e1 = estimateOneRepMax(s.weightKg ?? 0, s.reps ?? 0);
          return e1 > acc.e1rm ? { e1rm: e1, topWeight: s.weightKg ?? 0 } : acc;
        },
        { e1rm: 0, topWeight: 0 },
      );
      return { date: w.startedAt, ...best };
    })
    .filter((p) => p.e1rm > 0)
    .map((p, key) => ({ key, ...p }));
}

/** Exercises with enough weighted history to chart, most-trained first. */
export function chartableExercises(workouts: Workout[]) {
  const counts = new Map<string, number>();
  for (const w of workouts) {
    for (const e of w.exercises) {
      if (EXERCISE_BY_ID[e.exerciseId]?.isTimed) continue;
      if (!e.sets.some((s) => s.completed && (s.weightKg ?? 0) > 0)) continue;
      counts.set(e.exerciseId, (counts.get(e.exerciseId) ?? 0) + 1);
    }
  }
  return [...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

export interface MuscleSlice {
  group: MuscleGroup;
  label: string;
  sets: number;
  percent: number;
  color: string;
}

export function muscleDistribution(workouts: Workout[], colors: Record<string, string>): MuscleSlice[] {
  const counts: Record<MuscleGroup, number> = { chest: 0, back: 0, shoulders: 0, arms: 0, legs: 0, core: 0 };
  for (const w of workouts) {
    for (const e of w.exercises) {
      const group = EXERCISE_BY_ID[e.exerciseId]?.muscleGroup;
      if (group) counts[group] += e.sets.filter((s) => s.completed).length;
    }
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return MUSCLE_GROUPS.map((group) => ({
    group,
    label: group.charAt(0).toUpperCase() + group.slice(1),
    sets: counts[group],
    percent: total ? (counts[group] / total) * 100 : 0,
    color: colors[group],
  }))
    .filter((s) => s.sets > 0)
    .sort((a, b) => b.sets - a.sets);
}

export function monthlyActivity(workouts: Workout[], months = 6) {
  const now = new Date();
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const list = workouts.filter((w) => {
      const t = new Date(w.startedAt);
      return t >= d && t < next;
    });
    return {
      key: i,
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      workouts: list.length,
      volume: list.reduce((a, w) => a + workoutVolume(w), 0),
    };
  });
}

/** Days since each muscle group was last trained. */
export function recoveryByMuscle(workouts: Workout[]) {
  const last: Partial<Record<MuscleGroup, number>> = {};
  for (const w of workouts) {
    const t = new Date(w.startedAt).getTime();
    for (const e of w.exercises) {
      const g = EXERCISE_BY_ID[e.exerciseId]?.muscleGroup;
      if (g && (!last[g] || t > last[g]!)) last[g] = t;
    }
  }
  const now = Date.now();
  return MUSCLE_GROUPS.map((group) => ({
    group,
    daysSince: last[group] ? Math.floor((now - last[group]!) / DAY_MS) : null,
  }));
}
