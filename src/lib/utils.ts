import * as Crypto from 'expo-crypto';

export function uuid(): string {
  return Crypto.randomUUID();
}

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function sum(values: number[]) {
  return values.reduce((acc, v) => acc + v, 0);
}

export function groupBy<T, K extends string | number>(items: T[], key: (item: T) => K) {
  return items.reduce(
    (acc, item) => {
      const k = key(item);
      (acc[k] ||= []).push(item);
      return acc;
    },
    {} as Record<K, T[]>,
  );
}

/** Deterministic PRNG so sample data is stable between launches. */
export function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Epley estimated one-rep max. */
export function estimateOneRepMax(weightKg: number, reps: number) {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export function toErrorMessage(error: unknown, fallback = 'Something went wrong. Try again.') {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  return fallback;
}
