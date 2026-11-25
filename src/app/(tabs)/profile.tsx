import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Bell,
  CalendarDays,
  Clock,
  Cloud,
  Dumbbell,
  History,
  LogOut,
  Palette,
  Ruler,
  Scale,
  Settings,
  Shield,
  Target,
  Trophy,
  UserPen,
  Weight,
} from '@/components/ui/icons';
import { Avatar, Badge, KeyValue, Overline, SectionHeader } from '@/components/ui/misc';
import { confirm } from '@/components/ui/overlays';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SettingGroup, SettingLink } from '@/components/ui/setting-row';
import { SkeletonCard } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useColors } from '@/constants/theme';
import { useAuth } from '@/features/auth/store';
import { EXPERIENCE_LABELS, GOAL_LABELS, useProfile } from '@/features/profile/hooks';
import { usePersonalRecords, useWorkoutHistory } from '@/features/workouts/hooks';
import { workoutVolume } from '@/features/workouts/stats';
import { WEEKDAY_LABELS, WEEKDAYS } from '@/lib/dates';
import { formatCompact, formatWeight, kgToUnit } from '@/lib/format';
import { cn } from '@/lib/utils';
import { isSupabaseConfigured } from '@/services/supabase';
import { useSettings } from '@/store/settings';

function formatHeight(cm: number | null, unit: 'kg' | 'lb') {
  if (!cm) return '—';
  if (unit === 'kg') return `${Math.round(cm)} cm`;
  const inches = Math.round(cm / 2.54);
  return `${Math.floor(inches / 12)}′${inches % 12}″`;
}

export default function ProfileScreen() {
  const colors = useColors();
  const profile = useProfile();
  const history = useWorkoutHistory();
  const records = usePersonalRecords();
  const { status, email, signOut } = useAuth();
  const unit = useSettings((s) => s.unit);
  const setUnit = useSettings((s) => s.setUnit);
  const theme = useSettings((s) => s.theme);
  const reminders = useSettings((s) => s.notifications.workoutReminders);
  const p = profile.data;

  const lifetime = useMemo(() => {
    const ws = history.data ?? [];
    return { workouts: ws.length, volume: ws.reduce((a, w) => a + workoutVolume(w), 0) };
  }, [history.data]);
  const prCount = (records.data ?? []).filter((r) => r.type === 'estimated_1rm').length;

  return (
    <Screen tabBar>
      {!p ? (
        <View className="gap-3 pt-4">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={4} />
        </View>
      ) : (
        <View className="gap-6 pt-2">
          <View>
            <Overline>Athlete profile</Overline>
            <Card className="mt-3" variant="glow">
              <View className="flex-row items-center gap-4">
                <Avatar name={p.name} uri={p.avatarUri} size={72} />
                <View className="flex-1">
                  <Text variant="heading" numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    {status === 'signedIn' ? email : isSupabaseConfigured ? 'Guest · data stays on this device' : 'Data stays on this phone'}
                  </Text>
                  <View className="mt-2 flex-row gap-2">
                    <Badge label={EXPERIENCE_LABELS[p.experience]} />
                    {status === 'signedIn' ? <Badge label="Synced" tone="success" icon={Cloud} /> : null}
                  </View>
                </View>
              </View>
              <View className="mt-4">
                <Button label="Edit profile" icon={UserPen} variant="secondary" size="sm" fullWidth onPress={() => router.push('/profile/edit')} />
              </View>
            </Card>
          </View>

          <View className="flex-row gap-3">
            <Card className="flex-1">
              <KeyValue label="Workouts" value={String(lifetime.workouts)} />
            </Card>
            <Card className="flex-1">
              <KeyValue label="Lifted" value={`${formatCompact(Math.round(kgToUnit(lifetime.volume, unit)))} ${unit}`} />
            </Card>
            <Card className="flex-1">
              <KeyValue label="Records" value={String(prCount)} />
            </Card>
          </View>

          <View>
            <SectionHeader title="Body metrics" />
            <Card>
              <View className="flex-row">
                <Metric icon={Weight} label="Weight" value={p.weightKg ? formatWeight(p.weightKg, unit) : '—'} />
                <View className="w-px bg-line" />
                <Metric icon={Ruler} label="Height" value={formatHeight(p.heightCm, unit)} />
                <View className="w-px bg-line" />
                <Metric icon={CalendarDays} label="Age" value={p.age ? String(p.age) : '—'} />
              </View>
            </Card>
          </View>

          <View>
            <SectionHeader title="Goals and training" actionLabel="Edit" onAction={() => router.push('/profile/edit')} />
            <Card>
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-accent/15">
                  <Target size={18} color={colors.accent} />
                </View>
                <View className="flex-1">
                  <Text variant="caption" tone="muted">
                    Primary goal
                  </Text>
                  <Text variant="subheading">{GOAL_LABELS[p.goals[0] ?? 'general_fitness']}</Text>
                </View>
              </View>
              {p.goals.length > 1 ? (
                <View className="mt-3 flex-row flex-wrap gap-2">
                  {p.goals.slice(1).map((g) => (
                    <Badge key={g} label={GOAL_LABELS[g]} tone="neutral" />
                  ))}
                </View>
              ) : null}
              <View className="mt-4 flex-row justify-between">
                {WEEKDAYS.map((d) => {
                  const on = p.preferredDays.includes(d);
                  return (
                    <View key={d} className={cn('h-9 w-9 items-center justify-center rounded-full border', on ? 'border-accent bg-accent' : 'border-line-strong')} accessibilityLabel={`${WEEKDAY_LABELS[d]} ${on ? 'training day' : 'rest day'}`}>
                      <Text variant="caption" weight="bold" style={{ color: on ? colors.accentInk : colors.textMuted }}>
                        {WEEKDAY_LABELS[d].slice(0, 1)}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <View className="mt-4 flex-row flex-wrap gap-2">
                <Badge label={`${p.preferredDurationMinutes} min sessions`} tone="neutral" icon={Clock} />
                {p.trainingPreferences.map((t) => (
                  <Badge key={t} label={t} tone="neutral" icon={Dumbbell} />
                ))}
              </View>
            </Card>
          </View>

          <View>
            <SectionHeader title="Units" />
            <SegmentedControl
              options={[
                { value: 'kg', label: 'Kilograms (kg)' },
                { value: 'lb', label: 'Pounds (lb)' },
              ]}
              value={unit}
              onChange={setUnit}
            />
          </View>

          <View>
            <SettingGroup title="Settings">
              <SettingLink icon={Bell} label="Notifications" value={reminders ? 'On' : 'Off'} onPress={() => router.push('/profile/settings')} />
              <SettingLink icon={Palette} label="Theme" value={{ system: 'System', light: 'Light', dark: 'Dark', oled: 'Pure black' }[theme]} onPress={() => router.push('/profile/settings')} />
              <SettingLink icon={Shield} label="Privacy and data" onPress={() => router.push('/profile/settings')} />
              <SettingLink icon={Scale} label="Training defaults" onPress={() => router.push('/profile/settings')} />
              <SettingLink icon={History} label="Workout history" onPress={() => router.push('/workout/history')} />
              <SettingLink icon={Trophy} label="Progress and records" onPress={() => router.push('/progress')} />
              <SettingLink icon={Settings} label="Account" value={status === 'signedIn' ? 'Signed in' : isSupabaseConfigured ? 'Guest' : 'This phone'} onPress={() => router.push('/profile/settings')} last />
            </SettingGroup>

            {status === 'guest' && isSupabaseConfigured ? (
              <Button label="Create an account to back up" icon={Cloud} fullWidth onPress={() => signOut().then(() => router.replace('/auth/sign-up'))} />
            ) : null}
            {/* Offline builds have no accounts, so leaving guest mode would only show the welcome screen again. */}
            {status === 'signedIn' || isSupabaseConfigured ? (
              <View className="mt-3">
                <Button
                  label={status === 'signedIn' ? 'Sign out' : 'Leave guest mode'}
                  icon={LogOut}
                  variant="danger"
                  fullWidth
                  onPress={async () => {
                    const ok = await confirm({
                      title: status === 'signedIn' ? 'Sign out?' : 'Leave guest mode?',
                      message:
                        status === 'signedIn'
                          ? 'Your synced data stays in your account. Unsynced changes stay on this device until you sign back in.'
                          : 'Your workouts stay on this device and come back when you continue as a guest again.',
                      confirmLabel: status === 'signedIn' ? 'Sign out' : 'Leave',
                    });
                    if (ok) await signOut();
                  }}
                />
              </View>
            ) : null}
          </View>
        </View>
      )}
    </Screen>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Weight; label: string; value: string }) {
  const colors = useColors();
  return (
    <View className="flex-1 items-center gap-1">
      <Icon size={16} color={colors.accent} />
      <Text variant="subheading" weight="bold">
        {value}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}
