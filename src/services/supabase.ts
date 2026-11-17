import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = url.length > 0 && anonKey.length > 0;

/**
 * Session storage: the Keychain/Keystore on native (sessions are secrets), localStorage on web.
 * SecureStore values are limited to ~2 KB, so large sessions are chunked.
 */
const CHUNK = 1800;

const secureStorage = {
  async getItem(key: string) {
    const count = await SecureStore.getItemAsync(`${key}.count`);
    if (!count) return SecureStore.getItemAsync(key);
    const parts: string[] = [];
    for (let i = 0; i < Number(count); i++) {
      parts.push((await SecureStore.getItemAsync(`${key}.${i}`)) ?? '');
    }
    return parts.join('');
  },
  async setItem(key: string, value: string) {
    if (value.length <= CHUNK) {
      await SecureStore.setItemAsync(key, value);
      await SecureStore.deleteItemAsync(`${key}.count`);
      return;
    }
    const chunks = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < chunks; i++) {
      await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    }
    await SecureStore.setItemAsync(`${key}.count`, String(chunks));
  },
  async removeItem(key: string) {
    const count = await SecureStore.getItemAsync(`${key}.count`);
    if (count) {
      for (let i = 0; i < Number(count); i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
      await SecureStore.deleteItemAsync(`${key}.count`);
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        storage: Platform.OS === 'web' ? globalThis.localStorage : secureStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

if (supabase && Platform.OS !== 'web') {
  // Refresh tokens only while the app is in the foreground.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured. Add your project keys to .env.local.');
  return supabase;
}

export const exerciseImageBucket = process.env.EXPO_PUBLIC_EXERCISE_IMAGE_BUCKET ?? 'exercise-images';

export function exerciseImagePublicUrl(slug: string) {
  if (!supabase) return null;
  return supabase.storage.from(exerciseImageBucket).getPublicUrl(`${slug}.jpg`).data.publicUrl;
}
