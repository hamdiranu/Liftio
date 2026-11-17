import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { fonts, useColors, type FontWeight, type Palette } from '@/constants/theme';

const VARIANTS = {
  display: { fontSize: 34, lineHeight: 40, letterSpacing: -0.8, weight: 'extrabold' },
  title: { fontSize: 26, lineHeight: 32, letterSpacing: -0.5, weight: 'bold' },
  heading: { fontSize: 20, lineHeight: 26, letterSpacing: -0.3, weight: 'bold' },
  subheading: { fontSize: 16, lineHeight: 22, letterSpacing: -0.1, weight: 'semibold' },
  body: { fontSize: 15, lineHeight: 22, letterSpacing: 0, weight: 'regular' },
  small: { fontSize: 13, lineHeight: 18, letterSpacing: 0, weight: 'regular' },
  caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0.1, weight: 'medium' },
  overline: { fontSize: 11, lineHeight: 14, letterSpacing: 1.2, weight: 'semibold' },
  stat: { fontSize: 28, lineHeight: 32, letterSpacing: -0.8, weight: 'extrabold' },
  statLarge: { fontSize: 44, lineHeight: 48, letterSpacing: -1.5, weight: 'extrabold' },
} as const;

/** Text tones map to theme colors; `accent` uses the text-safe orange (darker in light mode). */
function toneColor(tone: TextTone, c: Palette) {
  switch (tone) {
    case 'primary':
      return c.text;
    case 'secondary':
      return c.textSecondary;
    case 'muted':
      return c.textMuted;
    case 'accent':
      return c.accentText;
    case 'accentSoft':
      return c.accentSoft;
    case 'success':
      return c.success;
    case 'danger':
      return c.danger;
    case 'ink':
      return c.accentInk;
  }
}

export type TextVariant = keyof typeof VARIANTS;
export type TextTone = 'primary' | 'secondary' | 'muted' | 'accent' | 'accentSoft' | 'success' | 'danger' | 'ink';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
  weight?: FontWeight;
  align?: 'left' | 'center' | 'right';
  uppercase?: boolean;
  tabular?: boolean;
}

export function Text({
  variant = 'body',
  tone = 'primary',
  weight,
  align,
  uppercase,
  tabular,
  style,
  ...rest
}: TextProps) {
  const colors = useColors();
  const v = VARIANTS[variant];
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={1.4}
      style={[
        {
          fontFamily: fonts[weight ?? v.weight],
          fontSize: v.fontSize,
          lineHeight: v.lineHeight,
          letterSpacing: v.letterSpacing,
          color: toneColor(tone, colors),
          textAlign: align,
          textTransform: uppercase || variant === 'overline' ? 'uppercase' : undefined,
          fontVariant: tabular || variant === 'stat' || variant === 'statLarge' ? ['tabular-nums'] : undefined,
        },
        style,
      ]}
    />
  );
}
