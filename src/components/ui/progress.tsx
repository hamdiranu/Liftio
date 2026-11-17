import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

import { useColors } from '@/constants/theme';
import { clamp } from '@/lib/utils';

export function ProgressBar({ value, height = 8, track: trackProp }: { value: number; height?: number; track?: string }) {
  const colors = useColors();
  const track = trackProp ?? colors.elevated;
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(clamp(value, 0, 1), { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [value, progress]);
  const style = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return (
    <View
      style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamp(value, 0, 1) * 100) }}>
      <Animated.View style={[{ height, borderRadius: height, overflow: 'hidden' }, style]}>
        <LinearGradient colors={[colors.accentSoft, colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function ProgressRing({
  value,
  size = 72,
  stroke = 7,
  track: trackProp,
  duration = 800,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  track?: string;
  duration?: number;
  children?: React.ReactNode;
}) {
  const colors = useColors();
  const track = trackProp ?? colors.elevated;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(clamp(value, 0, 1), { duration, easing: Easing.out(Easing.cubic) });
  }, [value, progress, duration]);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <SvgGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.accentSoft} />
            <Stop offset="1" stopColor={colors.accent} />
          </SvgGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ring)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
        />
      </Svg>
      {children}
    </View>
  );
}
