import { createJSONStorage } from 'zustand/middleware';

/**
 * Web: small persisted state lives in localStorage. On web expo-sqlite runs a single
 * OPFS-backed worker, and a second database (the SQLite kv-store) competes with the app
 * database for it, so the kv-store is only used on native.
 */
const storage = typeof window !== 'undefined' ? window.localStorage : undefined;

export const kv = {
  getItem: async (key: string) => storage?.getItem(key) ?? null,
  setItem: async (key: string, value: string) => storage?.setItem(key, value),
  removeItem: async (key: string) => {
    storage?.removeItem(key);
    return true;
  },
};

export const kvStorage = createJSONStorage(() => ({
  getItem: (name: string) => storage?.getItem(name) ?? null,
  setItem: (name: string, value: string) => storage?.setItem(name, value),
  removeItem: (name: string) => storage?.removeItem(name),
}));
