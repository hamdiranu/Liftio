import { useEffect } from 'react';
import { View, type DimensionValue } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useColors } from '@/constants/theme';
import { cn, toErrorMessage } from '@/lib/utils';
import { Button } from './button';
import { RefreshCw, TriangleAlert, type IconComponent } from './icons';
import { Text } from './text';

export function Skeleton({
  width = '100%',
  height = 16,
  radius = 10,
  className,
}: {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  className?: string;
}) {
  const colors = useColors();
  const opacity = useSharedValue(0.45);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.9, { duration: 850 }), -1, true);
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      className={className}
      accessibilityLabel="Loading"
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.elevated }, style]}
    />
  );
}

export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <View className={cn('gap-3 rounded-lg border border-line bg-card p-4', className)}>
      <Skeleton width="45%" height={14} />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '70%' : '100%'} height={12} />
      ))}
    </View>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  actionLabel,
  onAction,
  compact,
}: {
  icon: IconComponent;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  const colors = useColors();
  return (
    <View className={cn('items-center rounded-lg border border-line bg-card px-6', compact ? 'py-6' : 'py-10')}>
      <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-accent/10">
        <Icon size={26} color={colors.accent} />
      </View>
      <Text variant="subheading" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="small" tone="secondary" align="center" style={{ marginTop: 6, maxWidth: 280 }}>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View className="mt-5">
          <Button label={actionLabel} onPress={onAction} size="sm" />
        </View>
      ) : null}
    </View>
  );
}

export function ErrorState({ error, onRetry, title = "Couldn't load this" }: { error?: unknown; onRetry?: () => void; title?: string }) {
  const colors = useColors();
  return (
    <View className="items-center rounded-lg border border-danger/30 bg-danger/5 px-6 py-8">
      <TriangleAlert size={26} color={colors.danger} />
      <Text variant="subheading" align="center" style={{ marginTop: 12 }}>
        {title}
      </Text>
      <Text variant="small" tone="secondary" align="center" style={{ marginTop: 4 }}>
        {toErrorMessage(error)}
      </Text>
      {onRetry ? (
        <View className="mt-4">
          <Button label="Try again" icon={RefreshCw} variant="secondary" size="sm" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}
