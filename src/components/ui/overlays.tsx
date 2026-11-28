import { useEffect, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { useColors } from '@/constants/theme';
import { Button } from './button';
import { CircleCheck, Info, TriangleAlert } from './icons';
import { Text } from './text';

// ───────────────────────────── Bottom sheet

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={onClose} accessibilityLabel="Close sheet" />
        <View
          className="rounded-t-xl border border-line-strong bg-surface px-5 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 8, maxHeight: '88%' }}>
          <View className="mb-4 h-1.5 w-10 self-center rounded-full bg-line-strong" />
          {title ? (
            <Text variant="heading" style={{ marginBottom: 16 }}>
              {title}
            </Text>
          ) : null}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ───────────────────────────── Confirm dialog (works on web, unlike Alert.alert)

interface DialogRequest {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  resolve: (ok: boolean) => void;
}

const useDialogStore = create<{ request: DialogRequest | null }>(() => ({ request: null }));

export function confirm(options: Omit<DialogRequest, 'resolve'>) {
  return new Promise<boolean>((resolve) => {
    useDialogStore.setState({ request: { ...options, resolve } });
  });
}

export function DialogHost() {
  const request = useDialogStore((s) => s.request);
  const close = (ok: boolean) => {
    request?.resolve(ok);
    useDialogStore.setState({ request: null });
  };
  return (
    <Modal visible={Boolean(request)} transparent animationType="fade" onRequestClose={() => close(false)} statusBarTranslucent>
      <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
        {request ? (
          <Animated.View entering={FadeInDown.duration(220)} style={{ width: '100%', maxWidth: 384 }}>
            <View className="rounded-xl border border-line-strong bg-surface p-6">
              <Text variant="heading">{request.title}</Text>
              {request.message ? (
                <Text variant="body" tone="secondary" style={{ marginTop: 8 }}>
                  {request.message}
                </Text>
              ) : null}
              <View className="mt-6 flex-row gap-3">
                <View className="flex-1">
                  <Button label={request.cancelLabel ?? 'Cancel'} variant="secondary" fullWidth onPress={() => close(false)} />
                </View>
                <View className="flex-1">
                  <Button
                    label={request.confirmLabel ?? 'Confirm'}
                    variant={request.destructive ? 'danger' : 'primary'}
                    fullWidth
                    onPress={() => close(true)}
                  />
                </View>
              </View>
            </View>
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}

// ───────────────────────────── Toasts

type ToastTone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const useToastStore = create<{ toast: ToastItem | null }>(() => ({ toast: null }));
let toastId = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function toast(message: string, tone: ToastTone = 'success') {
  clearTimeout(toastTimer);
  useToastStore.setState({ toast: { id: ++toastId, message, tone } });
  toastTimer = setTimeout(() => useToastStore.setState({ toast: null }), 2600);
}

export function ToastHost() {
  const colors = useColors();
  const item = useToastStore((s) => s.toast);
  const insets = useSafeAreaInsets();
  if (!item) return null;
  const Icon = item.tone === 'success' ? CircleCheck : item.tone === 'error' ? TriangleAlert : Info;
  const color = item.tone === 'success' ? colors.success : item.tone === 'error' ? colors.danger : colors.accent;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, top: insets.top + 8, zIndex: 1000 }}>
      <Animated.View
        key={item.id}
        entering={FadeInDown.springify().damping(16)}
        exiting={FadeOutDown.duration(180)}
        accessibilityLiveRegion="polite">
        <View className="flex-row items-center gap-3 rounded-lg border border-line-strong bg-elevated px-4 py-3">
          <Icon size={18} color={color} />
          <Text variant="small" weight="medium" style={{ flex: 1 }}>
            {item.message}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ───────────────────────────── Fade-in wrapper for lists/sections

export function FadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const opacity = useSharedValue(0);
  const translate = useSharedValue(10);
  useEffect(() => {
    const t = setTimeout(() => {
      opacity.value = withTiming(1, { duration: 360 });
      translate.value = withTiming(0, { duration: 360 });
    }, delay);
    return () => clearTimeout(t);
  }, [delay, opacity, translate]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: translate.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
