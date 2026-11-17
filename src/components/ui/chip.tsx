import { View } from 'react-native';

import { useColors } from '@/constants/theme';
import { cn } from '@/lib/utils';
import type { IconComponent } from './icons';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconComponent;
  size?: 'sm' | 'md';
  count?: number;
}

export function Chip({ label, selected, onPress, icon: Icon, size = 'md', count }: ChipProps) {
  const colors = useColors();
  const fg = selected ? colors.accentInk : colors.textSecondary;
  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}>
      <View
        className={cn(
          'flex-row items-center gap-1.5 rounded-full border',
          selected ? 'border-accent bg-accent' : 'border-line-strong bg-card',
          size === 'sm' ? 'px-3' : 'px-4',
        )}
        style={{ height: size === 'sm' ? 32 : 38 }}>
        {Icon ? <Icon size={14} color={fg} strokeWidth={2.2} /> : null}
        <Text variant={size === 'sm' ? 'caption' : 'small'} weight="semibold" style={{ color: selected ? colors.accentInk : colors.text }}>
          {label}
        </Text>
        {count ? (
          <View className={cn('ml-0.5 rounded-full px-1.5', selected ? 'bg-accent-ink/15' : 'bg-elevated')}>
            <Text variant="caption" style={{ color: fg, fontSize: 11 }}>
              {count}
            </Text>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}
