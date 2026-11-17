import { View } from 'react-native';

import { useColors } from '@/constants/theme';
import { cn } from '@/lib/utils';
import type { IconComponent } from './icons';
import { PressableScale } from './pressable-scale';

export interface IconButtonProps {
  icon: IconComponent;
  onPress?: () => void;
  accessibilityLabel: string;
  variant?: 'solid' | 'ghost' | 'accent';
  size?: number;
  color?: string;
  className?: string;
  disabled?: boolean;
}

export function IconButton({
  icon: Icon,
  onPress,
  accessibilityLabel,
  variant = 'solid',
  size = 44,
  color,
  className,
  disabled,
}: IconButtonProps) {
  const colors = useColors();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={8}
      scaleTo={0.92}
      haptic="selection">
      <View
        className={cn(
          'items-center justify-center rounded-full',
          variant === 'solid' && 'bg-elevated border border-line-strong',
          variant === 'accent' && 'bg-accent',
          className,
        )}
        style={{ width: size, height: size }}>
        <Icon
          size={Math.round(size * 0.45)}
          color={color ?? (variant === 'accent' ? colors.accentInk : colors.text)}
          strokeWidth={2.1}
        />
      </View>
    </PressableScale>
  );
}
