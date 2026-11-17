import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { cn } from '@/lib/utils';
import { PressableScale } from './pressable-scale';

type Variant = 'default' | 'elevated' | 'accent' | 'outline' | 'glow';

export interface CardProps {
  children: ReactNode;
  variant?: Variant;
  className?: string;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

const VARIANT_CLASS: Record<Variant, string> = {
  default: 'bg-card border border-line',
  elevated: 'bg-elevated border border-line-strong',
  accent: 'border border-accent/40',
  outline: 'border border-line',
  glow: 'bg-card border border-accent/25',
};

/** Layered surface with an optional warm wash; becomes pressable when given `onPress`. */
export function Card({ children, variant = 'default', className, style, padded = true, onPress, accessibilityLabel }: CardProps) {
  const body = (
    <View className={cn('overflow-hidden rounded-lg', VARIANT_CLASS[variant], padded && 'p-4', className)} style={style}>
      {variant === 'accent' || variant === 'glow' ? (
        <LinearGradient
          pointerEvents="none"
          colors={variant === 'accent' ? ['rgba(255,138,54,0.28)', 'rgba(255,138,54,0.06)'] : ['rgba(255,138,54,0.12)', 'rgba(255,138,54,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : null}
      {children}
    </View>
  );
  if (!onPress) return body;
  return (
    <PressableScale onPress={onPress} accessibilityLabel={accessibilityLabel} scaleTo={0.98}>
      {body}
    </PressableScale>
  );
}
