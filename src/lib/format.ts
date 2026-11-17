import type { WeightUnit } from '@/types';

const KG_PER_LB = 0.45359237;

export function kgToUnit(kg: number, unit: WeightUnit) {
  return unit === 'kg' ? kg : kg / KG_PER_LB;
}

export function unitToKg(value: number, unit: WeightUnit) {
  return unit === 'kg' ? value : value * KG_PER_LB;
}

/** Rounds to the nearest 0.5 for kg and 1 for lb — the increments people actually load. */
export function roundWeight(value: number, unit: WeightUnit) {
  return unit === 'kg' ? Math.round(value * 2) / 2 : Math.round(value);
}

export function formatWeight(kg: number | null | undefined, unit: WeightUnit, withUnit = true) {
  if (kg == null) return '—';
  const v = roundWeight(kgToUnit(kg, unit), unit);
  const text = Number.isInteger(v) ? v.toString() : v.toFixed(1);
  return withUnit ? `${text} ${unit}` : text;
}

export function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value);
}

export function formatCompact(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 10_000) return `${(value / 1000).toFixed(1)}k`;
  return formatNumber(value);
}

export function formatVolume(kg: number, unit: WeightUnit) {
  return `${formatNumber(Math.round(kgToUnit(kg, unit)))} ${unit}`;
}

export function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function formatMinutes(totalSeconds: number) {
  const m = Math.round(totalSeconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

export function formatTimer(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function titleCase(text: string) {
  return text
    .split(/[\s_-]+/)
    .map(capitalize)
    .join(' ');
}
