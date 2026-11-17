import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useColors } from '@/constants/theme';
import { tapHaptic } from './pressable-scale';
import { Text } from './text';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segment = width ? (width - 8) / options.length : 0;
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withSpring(index * segment, { damping: 18, stiffness: 220 });
  }, [index, segment, x]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      className="flex-row rounded-full border border-line bg-card p-1"
      style={{ height: 44 }}>
      {segment > 0 ? (
        <Animated.View
          style={[{ position: 'absolute', top: 4, left: 4, bottom: 4, width: segment, borderRadius: 999, backgroundColor: colors.accent }, indicator]}
        />
      ) : null}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              tapHaptic('selection');
              onChange(o.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            className="flex-1 items-center justify-center">
            <Text variant="small" weight="semibold" style={{ color: selected ? colors.accentInk : colors.textSecondary }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
