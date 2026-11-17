import type { DateRange, Weekday } from '@/types';

export const DAY_MS = 24 * 60 * 60 * 1000;

export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

export function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Monday-based week start. */
export function startOfWeek(date: Date) {
  const d = startOfDay(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isSameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function weekdayOf(date: Date): Weekday {
  return WEEKDAYS[(date.getDay() + 6) % 7];
}

export function rangeStart(range: DateRange, now = new Date()): Date | null {
  switch (range) {
    case '7d':
      return addDays(startOfDay(now), -6);
    case '30d':
      return addDays(startOfDay(now), -29);
    case '90d':
      return addDays(startOfDay(now), -89);
    default:
      return null;
  }
}

export const RANGE_LABELS: Record<DateRange, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  all: 'All time',
};

export function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatLongDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function relativeDay(iso: string, now = new Date()) {
  const diff = Math.round((startOfDay(now).getTime() - startOfDay(new Date(iso)).getTime()) / DAY_MS);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  return formatShortDate(iso);
}

export function greetingFor(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Late session';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
