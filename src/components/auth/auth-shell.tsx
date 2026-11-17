import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { GymBackdrop, GymHero } from '@/components/ui/exercise-image';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { ThemeScope } from '@/components/ui/theme-scope';

const LOGO = require('@/assets/images/logo.png');

export function AuthShell({
  title,
  subtitle,
  children,
  back,
  background,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  back?: boolean;
  /** Key in `GYM_IMAGES` to use as a full-screen photo background. */
  background?: string;
}) {
  const screen = (
    <Screen
      keyboard
      ambient="strong"
      backdrop={background ? <GymBackdrop image={background} /> : null}
      header={back ? <ScreenHeader /> : null}>
      <View className="pt-4">
        {!back ? (
          <GymHero height={200} image="hero" style={{ marginBottom: 28 }}>
            <View className="flex-row items-center gap-2">
              <Image source={LOGO} style={{ width: 40, height: 40 }} contentFit="contain" accessibilityLabel="Liftio logo" />
              <Text variant="heading" weight="extrabold">
                Liftio
              </Text>
            </View>
            <Text variant="small" tone="secondary" style={{ marginTop: 6 }}>
              Smart workout tracking with an AI coach in your pocket.
            </Text>
          </GymHero>
        ) : null}
        <Text variant="title">{title}</Text>
        <Text variant="body" tone="secondary" style={{ marginTop: 6, marginBottom: 24 }}>
          {subtitle}
        </Text>
        {children}
      </View>
    </Screen>
  );
  // A photo background is always darkened, so keep the dark palette even in light mode.
  return background ? (
    <ThemeScope mode="dark" style={{ flex: 1 }}>
      {screen}
    </ThemeScope>
  ) : (
    screen
  );
}
