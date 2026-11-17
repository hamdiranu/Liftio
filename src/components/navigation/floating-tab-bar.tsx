import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Dumbbell, House, Play, Sparkles, TrendingUp, UserRound, type IconComponent } from '@/components/ui/icons';
import { tapHaptic } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { useColors, useResolvedTheme } from '@/constants/theme';
import { formatDuration } from '@/lib/format';
import { useActiveWorkout } from '@/store/active-workout';

const TABS: Record<string, { label: string; icon: IconComponent }> = {
  index: { label: 'Home', icon: House },
  train: { label: 'Train', icon: Dumbbell },
  progress: { label: 'Progress', icon: TrendingUp },
  coach: { label: 'AI Coach', icon: Sparkles },
  profile: { label: 'Profile', icon: UserRound },
};

// Geometry (see the navbar spec): 64px pill, 62px cradle, 48px floating button.
const BAR_TOP = 26;
const BAR_HEIGHT = 64;
const CRADLE = 62;
const FAB = 48;
const INSET = 8;
const SPRING = { damping: 15, stiffness: 170, mass: 0.9 };

function ActiveWorkoutPill() {
  const colors = useColors();
  const workout = useActiveWorkout((s) => s.workout);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!workout) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [workout]);
  if (!workout) return null;
  const done = workout.exercises.reduce((a, e) => a + e.sets.filter((s) => s.completed).length, 0);
  const total = workout.exercises.reduce((a, e) => a + e.sets.length, 0);
  return (
    <Pressable
      onPress={() => router.push('/workout/active')}
      accessibilityRole="button"
      accessibilityLabel={`Resume ${workout.name}`}
      style={{ marginBottom: 10 }}>
      <View className="flex-row items-center gap-3 rounded-full border border-accent/40 bg-elevated px-4" style={{ height: 48 }}>
        <View className="h-2 w-2 rounded-full bg-accent" />
        <View className="flex-1">
          <Text variant="small" weight="semibold" numberOfLines={1}>
            {workout.name}
          </Text>
          <Text variant="caption" tone="secondary">
            {formatDuration((now - new Date(workout.startedAt).getTime()) / 1000)} · {done}/{total} sets
          </Text>
        </View>
        <View className="flex-row items-center gap-1 rounded-full bg-accent px-3 py-1.5">
          <Play size={12} color={colors.accentInk} fill={colors.accentInk} />
          <Text variant="caption" weight="bold" tone="ink">
            Resume
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export function FloatingTabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const palette = colors;
  const isLight = useResolvedTheme() === 'light';
  const [width, setWidth] = useState(0);
  const count = state.routes.length;
  const colWidth = width ? (width - INSET * 2) / count : 0;

  const x = useSharedValue(0);
  const pop = useSharedValue(1);
  const ready = width > 0;

  useEffect(() => {
    if (!ready) return;
    const target = INSET + colWidth * (state.index + 0.5);
    x.value = x.value === 0 ? target : withSpring(target, SPRING);
    pop.value = withSequence(withTiming(0.82, { duration: 90 }), withSpring(1, { damping: 9, stiffness: 220 }));
  }, [state.index, ready, colWidth, x, pop]);

  const cradleStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value - CRADLE / 2 }] }));
  const coverStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value - 1 - (CRADLE + 2) / 2 }] }));
  const fabStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value - FAB / 2 }, { scale: pop.value }] }));
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value - (FAB + 8) / 2 }] }));

  const activeRoute = state.routes[state.index];
  const ActiveIcon = TABS[activeRoute.name]?.icon ?? House;
  const surfaceStyle = { backgroundColor: palette.card, borderColor: palette.borderStrong };

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 14, right: 14, bottom: Math.max(insets.bottom, 12) + (Platform.OS === 'android' ? 4 : 0) }}>
      <ActiveWorkoutPill />
      <View
        role="tablist"
        style={{ height: BAR_TOP + BAR_HEIGHT }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <View
          style={[
            styles.bar,
            surfaceStyle,
            Platform.select({
              ios: { shadowColor: '#000', shadowOpacity: isLight ? 0.12 : 0.45, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
              android: { elevation: isLight ? 6 : 14 },
              default: {},
            }),
          ]}
        />
        {ready ? (
          <>
            <Animated.View style={[styles.cradle, surfaceStyle, cradleStyle]} />
            <View pointerEvents="none" style={styles.clip}>
              <Animated.View style={[styles.cover, { backgroundColor: palette.card }, coverStyle]} />
            </View>
          </>
        ) : null}

        <View style={styles.items}>
          {state.routes.map((route, index) => {
            const focused = index === state.index;
            const meta = TABS[route.name] ?? { label: route.name, icon: House };
            const Icon = meta.icon;
            const options = descriptors[route.key]?.options;
            return (
              <Pressable
                key={route.key}
                role="tab"
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={options?.tabBarAccessibilityLabel ?? meta.label}
                onPress={() => {
                  const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!focused && !event.defaultPrevented) {
                    tapHaptic('selection');
                    navigateToTab(route.key);
                  }
                }}
                onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
                style={styles.item}>
                <View style={{ opacity: focused ? 0 : 1 }}>
                  <Icon size={21} color={colors.textSecondary} strokeWidth={2} />
                </View>
                <Text variant="caption" style={{ fontSize: 11, color: focused ? colors.accentText : colors.textSecondary }} weight={focused ? 'semibold' : 'medium'}>
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {ready ? (
          <>
            <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
            <Animated.View pointerEvents="none" style={[styles.fab, fabStyle]}>
              <LinearGradient
                colors={[colors.accentSoft, colors.accent, '#F2701C']}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={styles.fabFill}>
                <ActiveIcon size={22} color={colors.accentInk} strokeWidth={2.3} />
              </LinearGradient>
            </Animated.View>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: BAR_TOP,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    borderWidth: 1,
  },
  cradle: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CRADLE,
    height: CRADLE,
    borderRadius: CRADLE / 2,
    borderWidth: 1,
  },
  clip: {
    position: 'absolute',
    left: 1,
    right: 1,
    top: BAR_TOP + 1,
    height: BAR_HEIGHT - 2,
    borderRadius: (BAR_HEIGHT - 2) / 2,
    overflow: 'hidden',
  },
  cover: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CRADLE + 2,
    height: 40,
  },
  items: {
    position: 'absolute',
    left: INSET,
    right: INSET,
    top: BAR_TOP,
    height: BAR_HEIGHT,
    flexDirection: 'row',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 11,
    gap: 5,
  },
  ring: {
    position: 'absolute',
    top: 3,
    left: 0,
    width: FAB + 8,
    height: FAB + 8,
    borderRadius: (FAB + 8) / 2,
    backgroundColor: 'rgba(255,138,54,0.16)',
  },
  fab: {
    position: 'absolute',
    top: 7,
    left: 0,
    width: FAB,
    height: FAB,
    borderRadius: FAB / 2,
    overflow: 'hidden',
  },
  fabFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
