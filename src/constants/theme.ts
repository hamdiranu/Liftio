import { vars } from 'nativewind';
import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

import { useSettings } from '@/store/settings';
import tokens from './tokens.json';

/**
 * Dark palette. Components should read colors through `useColors()` so they follow the theme;
 * this static export is only for values that are deliberately the same in every theme.
 */
export const colors = tokens.colors;
export const radius = tokens.radius;
export const spacing = tokens.spacing;

export type Palette = typeof tokens.colors;
/** The palette actually rendered; `system` in settings resolves to `light` or `dark`. */
export type ResolvedTheme = 'dark' | 'oled' | 'light';

const PALETTES: Record<ResolvedTheme, Palette> = {
  dark: tokens.colors,
  oled: { ...tokens.colors, ...tokens.oled },
  light: { ...tokens.colors, ...tokens.light },
};

export function getPalette(mode: ResolvedTheme): Palette {
  return PALETTES[mode];
}

/** Lets a subtree render in a fixed theme (photo heroes stay dark so white text stays readable). */
export const ThemeOverrideContext = createContext<ResolvedTheme | null>(null);

export function useResolvedTheme(): ResolvedTheme {
  const override = useContext(ThemeOverrideContext);
  const setting = useSettings((s) => s.theme);
  const system = useColorScheme();
  if (override) return override;
  if (setting === 'system') return system === 'light' ? 'light' : 'dark';
  return setting;
}

export function useColors(): Palette {
  return PALETTES[useResolvedTheme()];
}

function hexToRgbTriplet(hex: string) {
  const value = hex.replace('#', '');
  const n = parseInt(value, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** CSS variables consumed by the Tailwind surface colors (see tailwind.config.js). */
export function themeVars(mode: ResolvedTheme) {
  const p = getPalette(mode);
  return vars({
    '--color-background': hexToRgbTriplet(p.background),
    '--color-surface': hexToRgbTriplet(p.surface),
    '--color-card': hexToRgbTriplet(p.card),
    '--color-elevated': hexToRgbTriplet(p.elevated),
    '--color-border': hexToRgbTriplet(p.border),
    '--color-border-strong': hexToRgbTriplet(p.borderStrong),
  });
}

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  extraboldItalic: 'Inter_800ExtraBold_Italic',
} as const;

export type FontWeight = keyof typeof fonts;

/** Muscle-group accent hues used by charts and fallback art. Kept within the warm palette. */
export const muscleGroupColors: Record<string, string> = {
  chest: '#FF8A36',
  back: '#FFAD66',
  shoulders: '#E86A2C',
  arms: '#FFC999',
  legs: '#C85A12',
  core: '#8F4A1E',
};

/** Height of the floating tab bar including the raised button, used to pad scroll content. */
export const TAB_BAR_CLEARANCE = 112;

/** Keyboard appearance that matches the palette (light keyboards on light surfaces). */
export function keyboardAppearanceFor(palette: Palette): 'light' | 'dark' {
  return palette.background === PALETTES.light.background ? 'light' : 'dark';
}

/** `#RRGGBB` → `rgba(r,g,b,alpha)`; used for fades that must end in the surface color itself. */
export function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
