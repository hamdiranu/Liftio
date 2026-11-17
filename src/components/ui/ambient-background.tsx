import { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useColors, useResolvedTheme } from '@/constants/theme';

type Intensity = 'subtle' | 'normal' | 'strong';

const OPACITY: Record<Intensity, number> = { subtle: 0.12, normal: 0.2, strong: 0.32 };

/**
 * Base color with soft orange ambient light and a film-grain overlay — the backdrop for every
 * screen, so surfaces never sit on a flat fill. Light mode uses a gentler glow.
 */
export const AmbientBackground = memo(function AmbientBackground({ intensity = 'normal' }: { intensity?: Intensity }) {
  const palette = useColors();
  const isLight = useResolvedTheme() === 'light';
  const o = OPACITY[intensity] * (isLight ? 0.6 : 1);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: palette.background }]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="glowTop" cx="85%" cy="0%" rx="75%" ry="45%" fx="85%" fy="0%">
            <Stop offset="0" stopColor="#FF8A36" stopOpacity={o} />
            <Stop offset="0.55" stopColor="#FF6A1A" stopOpacity={o * 0.25} />
            <Stop offset="1" stopColor="#FF6A1A" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="glowBottom" cx="0%" cy="100%" rx="70%" ry="40%" fx="0%" fy="100%">
            <Stop offset="0" stopColor="#FFAD66" stopOpacity={o * 0.45} />
            <Stop offset="1" stopColor="#FFAD66" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glowTop)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glowBottom)" />
      </Svg>
      <Image
        source={require('@/assets/images/textures/noise.png')}
        style={[StyleSheet.absoluteFill, { opacity: 0.5, width: '100%', height: '100%' }]}
        resizeMode="repeat"
      />
    </View>
  );
});
