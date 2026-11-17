import * as Haptics from 'expo-haptics';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  className?: string;
  scaleTo?: number;
  haptic?: 'light' | 'medium' | 'selection' | false;
}

export function tapHaptic(kind: 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' = 'light') {
  if (Platform.OS === 'web') return;
  if (kind === 'selection') void Haptics.selectionAsync();
  else if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else if (kind === 'warning') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  else
    void Haptics.impactAsync(
      kind === 'heavy'
        ? Haptics.ImpactFeedbackStyle.Heavy
        : kind === 'medium'
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light,
    );
}

/** Pressable with spring scale feedback and optional haptics — the base of every tappable surface. */
export function PressableScale({
  style,
  scaleTo = 0.97,
  haptic = 'light',
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  children,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: disabled ? 0.5 : 1,
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        scale.set(withTiming(scaleTo, { duration: 90 }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, { damping: 14, stiffness: 260 }));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) tapHaptic(haptic);
        onPress?.(e);
      }}
      style={[animated, style]}>
      {children}
    </AnimatedPressable>
  );
}
