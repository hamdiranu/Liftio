import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Minus, Plus } from '@/components/ui/icons';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { keyboardAppearanceFor, useColors, fonts } from '@/constants/theme';

/**
 * Large +/- control for weight and reps. Built for mid-set use: big targets, one-tap
 * increments, and the value itself is a numeric field for typing an exact number.
 */
export function NumberStepper({
  label,
  value,
  onChange,
  step,
  min = 0,
  max = 9999,
  decimals = 0,
  suffix,
  placeholder = '0',
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  step: number;
  min?: number;
  max?: number;
  decimals?: number;
  suffix?: string;
  placeholder?: string;
}) {
  const colors = useColors();
  const format = (v: number | null) => (v == null ? '' : decimals ? String(Math.round(v * 10 ** decimals) / 10 ** decimals) : String(Math.round(v)));
  // While typing, show the draft; otherwise always mirror the committed value.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? format(value);
  const setText = setDraft;

  const bump = (delta: number) => {
    const next = Math.min(max, Math.max(min, (value ?? 0) + delta));
    onChange(decimals ? Math.round(next * 10 ** decimals) / 10 ** decimals : Math.round(next));
  };

  const commit = (raw: string) => {
    const cleaned = raw.replace(',', '.');
    if (cleaned.trim() === '') return onChange(null);
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return;
    const clamped = Math.min(max, Math.max(min, n));
    // Respect the field's precision: reps are whole numbers, weights keep `decimals` places.
    onChange(Math.round(clamped * 10 ** decimals) / 10 ** decimals);
  };

  return (
    <View className="flex-1">
      <Text variant="overline" tone="muted" align="center" style={{ marginBottom: 8 }}>
        {label}
      </Text>
      <View className="flex-row items-center rounded-lg border border-line-strong bg-surface" style={{ height: 64 }}>
        <PressableScale onPress={() => bump(-step)} accessibilityLabel={`Decrease ${label}`} haptic="selection" style={{ height: '100%' }}>
          <View className="h-full w-12 items-center justify-center">
            <Minus size={20} color={colors.text} strokeWidth={2.4} />
          </View>
        </PressableScale>
        <View className="flex-1 items-center justify-center" style={{ minWidth: 0 }}>
          <TextInput
            keyboardAppearance={keyboardAppearanceFor(colors)}
            value={text}
            onChangeText={setText}
            onFocus={() => setDraft(format(value))}
            onBlur={() => {
              commit(text);
              setDraft(null);
            }}
            onSubmitEditing={() => commit(text)}
            keyboardType={decimals ? 'decimal-pad' : 'number-pad'}
            returnKeyType="done"
            selectTextOnFocus
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.accent}
            accessibilityLabel={label}
            // Stretch to the middle column: an unsized input on web takes its default ~20ch width
            // and overlaps the +/- buttons and the neighbouring stepper.
            style={{ color: colors.text, fontFamily: fonts.extrabold, fontSize: 26, textAlign: 'center', alignSelf: 'stretch', width: '100%', minWidth: 0, paddingVertical: 0 }}
          />
          {suffix ? (
            <Text variant="caption" tone="muted" style={{ marginTop: -2 }}>
              {suffix}
            </Text>
          ) : null}
        </View>
        <PressableScale onPress={() => bump(step)} accessibilityLabel={`Increase ${label}`} haptic="selection" style={{ height: '100%' }}>
          <View className="h-full w-12 items-center justify-center">
            <Plus size={20} color={colors.text} strokeWidth={2.4} />
          </View>
        </PressableScale>
      </View>
    </View>
  );
}

/** Compact stepper used in lists (template builder sets/rest). */
export function MiniStepper({ value, onChange, step = 1, min = 1, max = 20, format }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; format?: (v: number) => string }) {
  const colors = useColors();
  return (
    <View className="flex-row items-center rounded-full border border-line-strong bg-surface">
      <PressableScale onPress={() => onChange(Math.max(min, value - step))} accessibilityLabel="Decrease" haptic="selection" hitSlop={6}>
        <View className="h-9 w-9 items-center justify-center">
          <Minus size={15} color={colors.textSecondary} />
        </View>
      </PressableScale>
      <Text variant="small" weight="bold" style={{ minWidth: 34, textAlign: 'center' }}>
        {format ? format(value) : value}
      </Text>
      <PressableScale onPress={() => onChange(Math.min(max, value + step))} accessibilityLabel="Increase" haptic="selection" hitSlop={6}>
        <View className="h-9 w-9 items-center justify-center">
          <Plus size={15} color={colors.textSecondary} />
        </View>
      </PressableScale>
    </View>
  );
}
