import Storage from 'expo-sqlite/kv-store';
import { createJSONStorage } from 'zustand/middleware';

/** SQLite-backed key-value storage shared by persisted Zustand stores. */
export const kvStorage = createJSONStorage(() => ({
  getItem: (name: string) => Storage.getItem(name),
  setItem: (name: string, value: string) => Storage.setItem(name, value),
  removeItem: (name: string) => Storage.removeItem(name),
}));

export const kv = Storage;
