import type { ReactNode } from 'react';
import { Switch, View } from 'react-native';

import { useColors } from '@/constants/theme';
import { cn } from '@/lib/utils';
import { ChevronRight, type IconComponent } from './icons';
import { PressableScale, tapHaptic } from './pressable-scale';
import { Text } from './text';

interface BaseProps {
  icon?: IconComponent;
  label: string;
  description?: string;
  last?: boolean;
  tone?: 'default' | 'danger';
}

function Row({ icon: Icon, label, description, last, tone = 'default', right }: BaseProps & { right?: ReactNode }) {
  const colors = useColors();
  const fg = tone === 'danger' ? colors.danger : colors.text;
  return (
    <View className={cn('flex-row items-center gap-3 px-4', !last && 'border-b border-line')} style={{ minHeight: 56 }}>
      {Icon ? (
        <View className={cn('h-9 w-9 items-center justify-center rounded-md', tone === 'danger' ? 'bg-danger/10' : 'bg-elevated')}>
          <Icon size={18} color={tone === 'danger' ? colors.danger : colors.accent} />
        </View>
      ) : null}
      <View className="flex-1 py-3">
        <Text variant="body" weight="medium" style={{ color: fg }}>
          {label}
        </Text>
        {description ? (
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
            {description}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function SettingLink({ value, onPress, ...props }: BaseProps & { value?: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <PressableScale onPress={onPress} scaleTo={0.99} accessibilityLabel={props.label}>
      <Row
        {...props}
        right={
          <View className="flex-row items-center gap-1">
            {value ? (
              <Text variant="small" tone="secondary">
                {value}
              </Text>
            ) : null}
            {props.tone !== 'danger' ? <ChevronRight size={18} color={colors.textMuted} /> : null}
          </View>
        }
      />
    </PressableScale>
  );
}

export function SettingToggle({ value, onValueChange, ...props }: BaseProps & { value: boolean; onValueChange: (v: boolean) => void }) {
  const colors = useColors();
  return (
    <Row
      {...props}
      right={
        <Switch
          value={value}
          onValueChange={(v) => {
            tapHaptic('selection');
            onValueChange(v);
          }}
          trackColor={{ false: colors.borderStrong, true: colors.accent }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={colors.borderStrong}
          // react-native-web otherwise paints the "on" thumb in its default teal.
          {...({ activeThumbColor: '#FFFFFF' } as object)}
          accessibilityLabel={props.label}
        />
      }
    />
  );
}

export function SettingGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View className="mb-6">
      {title ? (
        <Text variant="overline" tone="muted" style={{ marginBottom: 8, marginLeft: 4 }}>
          {title}
        </Text>
      ) : null}
      <View className="overflow-hidden rounded-lg border border-line bg-card">{children}</View>
    </View>
  );
}
