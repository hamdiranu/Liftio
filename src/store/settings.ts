import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { kvStorage } from '@/services/kv';
import type { AppSettings, ThemeMode, WeightUnit } from '@/types';

export const DEFAULT_SETTINGS: AppSettings = {
  unit: 'kg',
  theme: 'dark',
  notifications: {
    workoutReminders: false,
    reminderHour: 18,
    restTimerAlerts: true,
    weeklySummary: false,
  },
  privacy: {
    shareAnalytics: false,
    sendWorkoutDataToCoach: true,
  },
  defaultRestSeconds: 90,
};

interface SettingsState extends AppSettings {
  hydrated: boolean;
  setUnit: (unit: WeightUnit) => void;
  setTheme: (theme: ThemeMode) => void;
  setNotifications: (patch: Partial<AppSettings['notifications']>) => void;
  setPrivacy: (patch: Partial<AppSettings['privacy']>) => void;
  setDefaultRest: (seconds: number) => void;
  reset: () => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      hydrated: false,
      setUnit: (unit) => set({ unit }),
      setTheme: (theme) => set({ theme }),
      setNotifications: (patch) => set((s) => ({ notifications: { ...s.notifications, ...patch } })),
      setPrivacy: (patch) => set((s) => ({ privacy: { ...s.privacy, ...patch } })),
      setDefaultRest: (defaultRestSeconds) => set({ defaultRestSeconds }),
      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: 'reptrack.settings',
      storage: kvStorage,
      partialize: ({ hydrated: _h, ...rest }) => rest,
      onRehydrateStorage: () => () => useSettings.setState({ hydrated: true }),
    },
  ),
);
