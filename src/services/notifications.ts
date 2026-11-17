import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import type { Weekday } from '@/types';

/** Expo weekday numbers: 1 = Sunday … 7 = Saturday. */
const EXPO_WEEKDAY: Record<Weekday, number> = { sun: 1, mon: 2, tue: 3, wed: 4, thu: 5, fri: 6, sat: 7 };
const REMINDER_TAG = 'reptrack-reminder';

export const notificationsSupported = Platform.OS !== 'web';

if (notificationsSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function ensurePermission() {
  if (!notificationsSupported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

async function cancelReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.tag === REMINDER_TAG)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/** Replaces workout reminders with one per preferred training day at `hour`. */
export async function scheduleWorkoutReminders(days: Weekday[], hour: number) {
  if (!notificationsSupported) return { scheduled: 0, reason: 'unsupported' as const };
  const granted = await ensurePermission();
  if (!granted) return { scheduled: 0, reason: 'denied' as const };
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Workout reminders',
      importance: AndroidImportance.DEFAULT,
    });
  }
  await cancelReminders();
  for (const day of days) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time to train',
        body: 'Your session is waiting. Small progress compounds.',
        data: { tag: REMINDER_TAG },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: EXPO_WEEKDAY[day],
        hour,
        minute: 0,
        channelId: 'reminders',
      },
    });
  }
  return { scheduled: days.length, reason: 'ok' as const };
}

export async function disableWorkoutReminders() {
  if (!notificationsSupported) return;
  await cancelReminders();
}
