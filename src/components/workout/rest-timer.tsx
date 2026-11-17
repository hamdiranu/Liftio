import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { SkipForward, Timer } from '@/components/ui/icons';
import { PressableScale, tapHaptic } from '@/components/ui/pressable-scale';
import { ProgressRing } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { useColors } from '@/constants/theme';
import { formatTimer } from '@/lib/format';
import { useActiveWorkout } from '@/store/active-workout';
import { useSettings } from '@/store/settings';

/** Countdown shown after a completed set; survives app restarts because it stores an end time. */
export function RestTimer() {
  const colors = useColors();
  const rest = useActiveWorkout((s) => s.rest);
  const adjustRest = useActiveWorkout((s) => s.adjustRest);
  const skipRest = useActiveWorkout((s) => s.skipRest);
  const alerts = useSettings((s) => s.notifications.restTimerAlerts);
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef<number | null>(null);

  useEffect(() => {
    if (!rest.endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [rest.endsAt]);

  const remaining = rest.endsAt ? Math.max(0, (rest.endsAt - now) / 1000) : 0;

  useEffect(() => {
    if (!rest.endsAt || remaining > 0 || fired.current === rest.endsAt) return;
    fired.current = rest.endsAt;
    if (alerts) tapHaptic('success');
    const t = setTimeout(() => skipRest(), 1200);
    return () => clearTimeout(t);
  }, [remaining, rest.endsAt, alerts, skipRest]);

  if (!rest.endsAt) return null;
  const done = remaining <= 0;

  return (
    <Animated.View entering={FadeInDown.springify().damping(16)} exiting={FadeOutDown.duration(200)}>
      <View
        className={`flex-row items-center gap-3 rounded-xl border p-3 ${done ? 'border-success/40 bg-elevated' : 'border-accent/40 bg-elevated'}`}
        style={{ shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12 }}
        accessibilityLiveRegion="polite">
        <ProgressRing value={rest.durationSeconds ? remaining / rest.durationSeconds : 0} size={56} stroke={5} duration={250}>
          <Timer size={18} color={done ? colors.success : colors.accent} />
        </ProgressRing>
        <View className="flex-1">
          <Text variant="overline" tone={done ? 'secondary' : 'accent'}>
            {done ? 'Rest complete' : 'Resting'}
          </Text>
          <Text
            variant="stat"
            numberOfLines={1}
            style={{ color: done ? colors.success : colors.text, fontSize: 26 }}
            accessibilityLabel={`${Math.ceil(remaining)} seconds of rest left`}>
            {done ? 'Go!' : formatTimer(remaining)}
          </Text>
        </View>
        {!done ? (
          <View className="flex-row gap-2">
            <TimerButton label="-15" onPress={() => adjustRest(-15)} />
            <TimerButton label="+15" onPress={() => adjustRest(15)} />
            <PressableScale onPress={skipRest} accessibilityLabel="Skip rest" haptic="selection">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-accent" style={{ width: 44, height: 44 }}>
                <SkipForward size={18} color={colors.accentInk} />
              </View>
            </PressableScale>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

function TimerButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={`${label} seconds`} haptic="selection">
      <View className="h-11 w-11 items-center justify-center rounded-full border border-line-strong bg-surface">
        <Text variant="caption" weight="bold">
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}
