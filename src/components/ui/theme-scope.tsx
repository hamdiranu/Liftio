import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemeOverrideContext, themeVars, type ResolvedTheme } from '@/constants/theme';

/**
 * Renders its children in a fixed theme, both for `useColors()` and for NativeWind surface
 * classes. Used over photos, which stay dark in light mode so their white text stays legible.
 */
export function ThemeScope({
  mode,
  children,
  style,
  pointerEvents,
}: {
  mode: ResolvedTheme;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
}) {
  return (
    <ThemeOverrideContext.Provider value={mode}>
      <View style={[themeVars(mode), style]} pointerEvents={pointerEvents}>
        {children}
      </View>
    </ThemeOverrideContext.Provider>
  );
}
