import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { IconButton } from './icon-button';
import { ChevronLeft, X } from './icons';
import { Text } from './text';

export interface ScreenHeaderProps {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  back?: boolean | 'close';
  onBack?: () => void;
}

export function ScreenHeader({ title, subtitle, right, back = true, onBack }: ScreenHeaderProps) {
  const handleBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View className="flex-row items-center gap-3 px-5 pb-3 pt-2" style={{ minHeight: 56 }}>
      {back ? (
        <IconButton
          icon={back === 'close' ? X : ChevronLeft}
          onPress={handleBack}
          accessibilityLabel={back === 'close' ? 'Close' : 'Go back'}
          size={40}
        />
      ) : null}
      <View className="flex-1">
        {title ? (
          <Text variant="subheading" numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View className="flex-row items-center gap-2">{right}</View> : null}
    </View>
  );
}
