import type { ReactElement, ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { cn } from '@/lib/utils';
import { AmbientBackground } from './ambient-background';

export interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  /** Adds bottom clearance for the floating tab bar. */
  tabBar?: boolean;
  padded?: boolean;
  header?: ReactElement | null;
  footer?: ReactElement | null;
  ambient?: 'subtle' | 'normal' | 'strong';
  /** Full-bleed layer drawn over the ambient background and behind the content (e.g. a photo). */
  backdrop?: ReactNode;
  contentClassName?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  keyboard?: boolean;
  scrollProps?: ScrollViewProps;
  topInset?: boolean;
}

export function Screen({
  children,
  scroll = true,
  tabBar = false,
  padded = true,
  header,
  footer,
  ambient = 'normal',
  backdrop,
  contentClassName,
  refreshing,
  onRefresh,
  keyboard = false,
  scrollProps,
  topInset = true,
}: ScreenProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottom = tabBar ? TAB_BAR_CLEARANCE + insets.bottom : footer ? 16 : insets.bottom + 24;

  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: bottom, flexGrow: 1 }}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
        ) : undefined
      }
      {...scrollProps}>
      <View className={cn(padded && 'px-5', contentClassName)}>{children}</View>
    </ScrollView>
  ) : (
    <View className={cn('flex-1', padded && 'px-5', contentClassName)} style={{ paddingBottom: tabBar ? bottom : 0 }}>
      {children}
    </View>
  );

  const content = (
    <View style={{ flex: 1, paddingTop: topInset ? insets.top : 0 }}>
      {header}
      {body}
      {footer ? <View style={{ paddingBottom: Math.max(insets.bottom, 12) }}>{footer}</View> : null}
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <AmbientBackground intensity={ambient} />
      {backdrop}
      {keyboard ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </View>
  );
}
