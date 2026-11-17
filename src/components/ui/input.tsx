import { forwardRef, useState, type ComponentRef } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { keyboardAppearanceFor, useColors, fonts } from '@/constants/theme';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, type IconComponent } from './icons';
import { Text } from './text';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  icon?: IconComponent;
  suffix?: string;
  containerClassName?: string;
}

export const Input = forwardRef<ComponentRef<typeof TextInput>, InputProps>(function Input(
  { label, error, hint, icon: Icon, suffix, secureTextEntry, containerClassName, onFocus, onBlur, style, ...rest },
  ref,
) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));
  return (
    <View className={cn('gap-1.5', containerClassName)}>
      {label ? (
        <Text variant="caption" tone="secondary">
          {label}
        </Text>
      ) : null}
      <View
        className={cn(
          'flex-row items-center rounded-md border bg-surface px-4',
          error ? 'border-danger' : focused ? 'border-accent' : 'border-line-strong',
        )}
        style={{ minHeight: 52 }}>
        {Icon ? <Icon size={18} color={focused ? colors.accent : colors.textMuted} style={{ marginRight: 10 }} /> : null}
        <TextInput
          keyboardAppearance={keyboardAppearanceFor(colors)}
          ref={ref}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          secureTextEntry={hidden}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[{ flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 16, paddingVertical: 12 }, style]}
          {...rest}
        />
        {suffix ? (
          <Text variant="small" tone="muted">
            {suffix}
          </Text>
        ) : null}
        {secureTextEntry ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            {hidden ? <Eye size={18} color={colors.textMuted} /> : <EyeOff size={18} color={colors.textMuted} />}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});
