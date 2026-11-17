import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useColors } from '@/constants/theme';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, ChevronRight, type IconComponent } from './icons';
import { Text } from './text';

export function SectionHeader({
  title,
  actionLabel,
  onAction,
  className,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  const colors = useColors();
  return (
    <View className={cn('mb-3 flex-row items-center justify-between', className)}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button" className="flex-row items-center gap-0.5">
          <Text variant="small" tone="accent" weight="semibold">
            {actionLabel}
          </Text>
          <ChevronRight size={16} color={colors.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Overline({ children, tone = 'accent' }: { children: ReactNode; tone?: 'accent' | 'muted' | 'secondary' }) {
  return (
    <Text variant="overline" tone={tone}>
      {children}
    </Text>
  );
}

export function Avatar({ name, uri, size = 48 }: { name: string; uri?: string | null; size?: number }) {
  const colors = useColors();
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}
      className="items-center justify-center border border-accent/40"
      accessibilityLabel={`${name} avatar`}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" transition={200} />
      ) : (
        <LinearGradient
          colors={[colors.avatarFrom, colors.avatarTo]}
          style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <Text weight="bold" style={{ fontSize: size * 0.36, color: colors.accentText }}>
            {initials || 'A'}
          </Text>
        </LinearGradient>
      )}
    </View>
  );
}

export function Badge({ label, tone = 'accent', icon: Icon }: { label: string; tone?: 'accent' | 'success' | 'danger' | 'neutral'; icon?: IconComponent }) {
  const colors = useColors();
  const map = {
    accent: { bg: 'bg-accent/15', fg: colors.accent },
    success: { bg: 'bg-success/15', fg: colors.success },
    danger: { bg: 'bg-danger/15', fg: colors.danger },
    neutral: { bg: 'bg-elevated', fg: colors.textSecondary },
  }[tone];
  return (
    <View className={cn('flex-row items-center gap-1 self-start rounded-full px-2.5 py-1', map.bg)}>
      {Icon ? <Icon size={12} color={map.fg} strokeWidth={2.4} /> : null}
      <Text variant="caption" weight="semibold" style={{ color: map.fg }}>
        {label}
      </Text>
    </View>
  );
}

export function StatTile({
  label,
  value,
  unit,
  icon: Icon,
  delta,
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  icon?: IconComponent;
  delta?: number | null;
  className?: string;
}) {
  const colors = useColors();
  const up = (delta ?? 0) >= 0;
  return (
    <View className={cn('flex-1 rounded-lg border border-line bg-card p-4', className)} accessible accessibilityLabel={`${label} ${value} ${unit ?? ''}`}>
      <View className="mb-3 flex-row items-center justify-between">
        <Text variant="caption" tone="secondary">
          {label}
        </Text>
        {Icon ? <Icon size={16} color={colors.accent} /> : null}
      </View>
      <View className="flex-row items-baseline gap-1">
        <Text variant="stat" numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {unit ? (
          <Text variant="small" tone="muted" weight="medium">
            {unit}
          </Text>
        ) : null}
      </View>
      {delta != null ? (
        <View className="mt-2 flex-row items-center gap-1">
          {up ? <ArrowUp size={12} color={colors.success} /> : <ArrowDown size={12} color={colors.danger} />}
          <Text variant="caption" tone={up ? 'success' : 'danger'}>
            {Math.abs(Math.round(delta))}% vs previous
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function Divider({ className }: { className?: string }) {
  return <View className={cn('h-px bg-line', className)} />;
}

export function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center">
      <Text variant="overline" tone="muted">
        {label}
      </Text>
      <Text variant="subheading" weight="bold" style={{ marginTop: 4 }}>
        {value}
      </Text>
    </View>
  );
}
