import '../global.css';

// Import each weight from its own subpath: the package index requires all 18 font files (~6 MB),
// and Metro bundles every file it requires, used or not.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { Inter_800ExtraBold_Italic } from '@expo-google-fonts/inter/800ExtraBold_Italic';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DialogHost, ToastHost } from '@/components/ui/overlays';
import { themeVars, useColors, useResolvedTheme } from '@/constants/theme';
import { useAuth } from '@/features/auth/store';
import { useBootstrap } from '@/hooks/use-bootstrap';
import { queryClient } from '@/lib/query';

void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const status = useAuth((s) => s.status);
  const palette = useColors();
  const ready = useBootstrap();
  const authed = status === 'guest' || status === 'signedIn';

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: palette.background }} />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.background },
        animation: 'slide_from_right',
      }}>
      <Stack.Protected guard={authed}>
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="workout/active" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="workout/summary" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="workout/add-exercise" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="workout/builder" />
        <Stack.Screen name="workout/history" />
        <Stack.Screen name="workout/[id]" />
        <Stack.Screen name="exercises" />
        <Stack.Screen name="coach/chat" />
        <Stack.Screen name="profile/edit" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="profile/settings" />
      </Stack.Protected>
      <Stack.Protected guard={!authed}>
        <Stack.Screen name="auth/sign-in" options={{ animation: 'fade' }} />
        <Stack.Screen name="auth/sign-up" />
        <Stack.Screen name="auth/forgot-password" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const theme = useResolvedTheme();
  const palette = useColors();
  const isLight = theme === 'light';
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_800ExtraBold_Italic,
  });

  const base = isLight ? DefaultTheme : DarkTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.accent,
      background: palette.background,
      card: palette.surface,
      border: palette.border,
      text: palette.text,
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider value={navTheme}>
            <View style={[{ flex: 1 }, themeVars(theme)]}>
              <StatusBar style={isLight ? 'dark' : 'light'} />
              {fontsLoaded || fontError ? <RootNavigator /> : <View style={{ flex: 1, backgroundColor: palette.background }} />}
              <ToastHost />
              <DialogHost />
            </View>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
