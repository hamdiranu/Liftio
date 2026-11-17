import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';

import { useColors } from '@/constants/theme';
import type { IconComponent } from './icons';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const HEIGHT: Record<Size, number> = { sm: 38, md: 48, lg: 58 };
const PAD: Record<Size, number> = { sm: 14, md: 18, lg: 22 };

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconComponent;
  iconRight?: IconComponent;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  children?: ReactNode;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading,
  disabled,
  fullWidth,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const colors = useColors();
  const fg =
    variant === 'primary' ? colors.accentInk : variant === 'danger' ? colors.danger : variant === 'ghost' ? colors.accentText : colors.text;
  const iconSize = size === 'sm' ? 16 : 18;

  const content = (
    <View
      style={{
        height: HEIGHT[size],
        paddingHorizontal: PAD[size],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {Icon ? <Icon size={iconSize} color={fg} strokeWidth={2.2} /> : null}
          <Text variant={size === 'lg' ? 'subheading' : 'body'} weight="semibold" style={{ color: fg }}>
            {label}
          </Text>
          {IconRight ? <IconRight size={iconSize} color={fg} strokeWidth={2.2} /> : null}
        </>
      )}
    </View>
  );

  const radius = size === 'sm' ? 12 : 16;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      haptic={variant === 'primary' ? 'medium' : 'light'}
      style={[{ borderRadius: radius, overflow: 'hidden', alignSelf: fullWidth ? 'stretch' : 'auto' }, style]}>
      {variant === 'primary' ? (
        <LinearGradient
          colors={[colors.accentSoft, colors.accent, '#F2701C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: radius }}>
          {content}
        </LinearGradient>
      ) : (
        <View
          className={
            variant === 'secondary'
              ? 'bg-elevated border border-line-strong'
              : variant === 'outline'
                ? 'border border-line-strong'
                : variant === 'danger'
                  ? 'bg-danger/10 border border-danger/30'
                  : ''
          }
          style={{ borderRadius: radius }}>
          {content}
        </View>
      )}
    </PressableScale>
  );
}
