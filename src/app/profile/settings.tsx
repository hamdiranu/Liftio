import { useQuery, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Share, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Bell, Cloud, Database, Download, LogOut, Mail, Moon, RefreshCw, Shield, Sun, Timer, Trash2, UserRound } from '@/components/ui/icons';
import { confirm, toast } from '@/components/ui/overlays';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SettingGroup, SettingLink, SettingToggle } from '@/components/ui/setting-row';
import { Text } from '@/components/ui/text';
import { MiniStepper } from '@/components/workout/number-stepper';
import { useAuth, useUserId } from '@/features/auth/store';
import { useProfile } from '@/features/profile/hooks';
import { listWorkouts, clearSampleData, hasSampleData, listTemplates, listPersonalRecords } from '@/features/workouts/repository';
import { seedSampleData } from '@/features/workouts/sample-data';
import { goBack } from '@/lib/navigation';
import { queryKeys } from '@/lib/query';
import { toErrorMessage } from '@/lib/utils';
import { disableWorkoutReminders, notificationsSupported, scheduleWorkoutReminders } from '@/services/notifications';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { subscribeSync, syncNow, type SyncState } from '@/services/sync';
import { pendingSyncCount } from '@/services/sync-queue';
import { useSettings } from '@/store/settings';
import { useColors } from '@/constants/theme';
import type { ThemeMode } from '@/types';

const THEME_HINT: Record<ThemeMode, string> = {
  system: "Matches your phone's light or dark setting.",
  light: 'Bright surfaces for training in well-lit gyms. Photos stay dark.',
  dark: 'The Liftio default: warm dark surfaces with orange accents.',
  oled: 'Pure black backgrounds save battery on OLED screens.',
};

export default function SettingsScreen() {
  const colors = useColors();
  const qc = useQueryClient();
  const userId = useUserId();
  const { status, email, signOut, deleteLocalAccount } = useAuth();
  const profile = useProfile();
  const settings = useSettings();
  const [sync, setSync] = useState<SyncState | null>(null);
  useEffect(() => subscribeSync(setSync), []);
  const pending = useQuery({ queryKey: queryKeys.sync(userId), queryFn: () => pendingSyncCount(userId), refetchInterval: 5000 });
  const sample = useQuery({ queryKey: ['sample', userId], queryFn: () => hasSampleData(userId) });

  const toggleReminders = async (enabled: boolean) => {
    if (!enabled) {
      settings.setNotifications({ workoutReminders: false });
      await disableWorkoutReminders();
      return;
    }
    const days = profile.data?.preferredDays ?? ['mon', 'wed', 'fri'];
    const res = await scheduleWorkoutReminders(days, settings.notifications.reminderHour);
    if (res.reason === 'ok') {
      settings.setNotifications({ workoutReminders: true });
      toast(`Reminders set for ${res.scheduled} day${res.scheduled === 1 ? '' : 's'} a week`);
    } else {
      toast(res.reason === 'denied' ? 'Allow notifications in system settings first.' : 'Reminders aren’t supported on this platform.', 'error');
    }
  };

  const exportData = async () => {
    try {
      const [workouts, templates, records] = await Promise.all([listWorkouts(userId), listTemplates(userId), listPersonalRecords(userId)]);
      const json = JSON.stringify({ exportedAt: new Date().toISOString(), profile: profile.data, settings: { unit: settings.unit }, workouts, templates, records }, null, 2);
      await Share.share({ title: 'Liftio export', message: json });
    } catch (e) {
      toast(toErrorMessage(e), 'error');
    }
  };

  const deleteAccount = async () => {
    const ok = await confirm({
      title: status === 'signedIn' ? 'Delete your account?' : 'Delete all data on this device?',
      message:
        status === 'signedIn'
          ? 'Your account and every workout, template and message in the cloud will be permanently deleted. This can’t be undone.'
          : 'Every workout, template and message stored on this device will be permanently deleted. This can’t be undone.',
      confirmLabel: 'Delete permanently',
      destructive: true,
    });
    if (!ok) return;
    try {
      if (status === 'signedIn' && supabase) {
        const { error } = await supabase.functions.invoke('delete-account', { body: {} });
        if (error) throw error;
      }
      await deleteLocalAccount();
      qc.clear();
      router.replace('/auth/sign-in');
    } catch (e) {
      toast(toErrorMessage(e, 'Couldn’t delete the account. Try again.'), 'error');
    }
  };

  return (
    <Screen header={<ScreenHeader title="Settings" />}>
      <View className="pb-6">
        <SettingGroup title="Units">
          <View className="p-3">
            <SegmentedControl
              options={[
                { value: 'kg', label: 'Kilograms' },
                { value: 'lb', label: 'Pounds' },
              ]}
              value={settings.unit}
              onChange={settings.setUnit}
            />
          </View>
        </SettingGroup>

        <SettingGroup title="Theme">
          <View className="gap-2 p-3">
            <SegmentedControl
              options={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'oled', label: 'Black' },
              ]}
              value={settings.theme}
              onChange={settings.setTheme}
            />
            <View className="flex-row items-center gap-2 px-1">
              {settings.theme === 'light' ? <Sun size={14} color={colors.textMuted} /> : <Moon size={14} color={colors.textMuted} />}
              <Text variant="caption" tone="muted" style={{ flex: 1 }}>
                {THEME_HINT[settings.theme]}
              </Text>
            </View>
          </View>
        </SettingGroup>

        <SettingGroup title="Notifications">
          <SettingToggle
            icon={Bell}
            label="Workout reminders"
            description={notificationsSupported ? `On your training days at ${settings.notifications.reminderHour}:00` : 'Available in the iOS and Android apps'}
            value={settings.notifications.workoutReminders}
            onValueChange={(v) => void toggleReminders(v)}
          />
          {settings.notifications.workoutReminders ? (
            <View className="flex-row items-center justify-between border-b border-line px-4 py-3">
              <Text variant="body">Reminder time</Text>
              <MiniStepper
                value={settings.notifications.reminderHour}
                min={5}
                max={22}
                format={(v) => `${v}:00`}
                onChange={(v) => {
                  settings.setNotifications({ reminderHour: v });
                  void scheduleWorkoutReminders(profile.data?.preferredDays ?? [], v);
                }}
              />
            </View>
          ) : null}
          <SettingToggle icon={Timer} label="Rest timer alerts" description="Vibrate when rest is over" value={settings.notifications.restTimerAlerts} onValueChange={(v) => settings.setNotifications({ restTimerAlerts: v })} />
          <View className="flex-row items-center justify-between px-4 py-3">
            <View className="flex-1">
              <Text variant="body" weight="medium">
                Default rest time
              </Text>
              <Text variant="caption" tone="muted">
                For exercises added without a preset
              </Text>
            </View>
            <MiniStepper value={settings.defaultRestSeconds} min={15} max={300} step={15} format={(v) => `${v}s`} onChange={settings.setDefaultRest} />
          </View>
        </SettingGroup>

        <SettingGroup title="Privacy">
          <SettingToggle
            icon={Shield}
            label="Use my workouts for coaching"
            description="Lets the AI coach read your training history. Off: it only sees your goals."
            value={settings.privacy.sendWorkoutDataToCoach}
            onValueChange={(v) => settings.setPrivacy({ sendWorkoutDataToCoach: v })}
          />
          <SettingToggle
            icon={Database}
            label="Share anonymous usage stats"
            description="Helps improve Liftio. Never includes workout content."
            value={settings.privacy.shareAnalytics}
            onValueChange={(v) => settings.setPrivacy({ shareAnalytics: v })}
          />
          <SettingLink icon={Download} label="Export my data" description="Workouts, templates and records as JSON" onPress={() => void exportData()} last />
        </SettingGroup>

        <SettingGroup title="Data">
          {status === 'signedIn' ? (
            <SettingLink
              icon={RefreshCw}
              label="Sync now"
              description={sync?.status === 'syncing' ? 'Syncing…' : sync?.error ? sync.error : `${pending.data ?? 0} change${pending.data === 1 ? '' : 's'} waiting${sync?.lastSyncedAt ? ` · last synced ${new Date(sync.lastSyncedAt).toLocaleTimeString()}` : ''}`}
              onPress={async () => {
                const res = await syncNow(userId);
                await pending.refetch();
                toast(res.failed ? `${res.failed} changes failed — they’ll retry` : `Synced ${res.pushed} change${res.pushed === 1 ? '' : 's'}`, res.failed ? 'error' : 'success');
              }}
            />
          ) : null}
          {sample.data ? (
            <SettingLink
              icon={Trash2}
              label="Clear sample data"
              description="Remove the generated demo workouts"
              onPress={async () => {
                if (!(await confirm({ title: 'Clear sample data?', message: 'Only the generated demo workouts are removed.', confirmLabel: 'Clear', destructive: true }))) return;
                await clearSampleData(userId);
                await qc.invalidateQueries();
                toast('Sample data cleared');
              }}
              last
            />
          ) : (
            <SettingLink
              icon={Database}
              label="Load sample data"
              description="Add 12 weeks of demo history (only if you have no workouts)"
              onPress={async () => {
                const added = await seedSampleData(userId);
                await qc.invalidateQueries();
                toast(added ? 'Sample data added' : 'You already have workouts — sample data skipped', added ? 'success' : 'info');
              }}
              last
            />
          )}
        </SettingGroup>

        <SettingGroup title="Account">
          {status === 'signedIn' ? (
            <>
              <SettingLink icon={Mail} label="Email" value={email ?? ''} onPress={() => undefined} />
              <SettingLink icon={LogOut} label="Sign out" onPress={async () => (await confirm({ title: 'Sign out?', confirmLabel: 'Sign out' })) && signOut()} />
            </>
          ) : isSupabaseConfigured ? (
            <SettingLink icon={Cloud} label="Create account or sign in" description="Back up and sync across devices" onPress={() => signOut().then(() => router.replace('/auth/sign-in'))} />
          ) : (
            <SettingLink icon={UserRound} label="Stored on this phone" description="No account needed. Use Export my data to keep a copy." onPress={() => undefined} />
          )}
          <SettingLink icon={Trash2} tone="danger" label={status === 'signedIn' ? 'Delete account' : 'Delete all data on this device'} onPress={() => void deleteAccount()} last />
        </SettingGroup>

        <Text variant="caption" tone="muted" align="center">
          Liftio {Constants.expoConfig?.version ?? '1.0.0'} · {Platform.OS}
          {isSupabaseConfigured ? ' · Cloud sync available' : ''}
        </Text>
        <Text variant="caption" tone="muted" align="center" style={{ marginTop: 4 }}>
          Created by Hamdi Ranuharja
        </Text>
        <View className="mt-4">
          <Button label="Done" variant="secondary" fullWidth onPress={() => goBack('/profile')} />
        </View>
      </View>
    </Screen>
  );
}
