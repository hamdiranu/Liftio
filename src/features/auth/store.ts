import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { reassignUserData } from '@/features/workouts/repository';
import { kv } from '@/services/kv';
import { isSupabaseConfigured, requireSupabase, supabase } from '@/services/supabase';

export const GUEST_USER_ID = 'local-user';
const GUEST_FLAG = 'reptrack.guest';

export type AuthStatus = 'loading' | 'signedOut' | 'guest' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  userId: string | null;
  email: string | null;
  init: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  deleteLocalAccount: () => Promise<void>;
}

let initialized = false;

async function adoptSession(session: Session | null) {
  if (!session) return;
  const wasGuest = (await kv.getItem(GUEST_FLAG)) === '1';
  if (wasGuest) {
    // Keep anything logged offline before the user created an account.
    await reassignUserData(GUEST_USER_ID, session.user.id);
    await kv.removeItem(GUEST_FLAG);
  }
  useAuth.setState({ status: 'signedIn', userId: session.user.id, email: session.user.email ?? null });
}

export const useAuth = create<AuthState>()((set) => ({
  status: 'loading',
  userId: null,
  email: null,

  init: async () => {
    if (initialized) return;
    initialized = true;
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await adoptSession(data.session);
      }
      supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          void adoptSession(session);
        } else if (useAuth.getState().status === 'signedIn') {
          set({ status: 'signedOut', userId: null, email: null });
        }
      });
      if (data.session) return;
    }
    const guest = (await kv.getItem(GUEST_FLAG)) === '1';
    set(guest ? { status: 'guest', userId: GUEST_USER_ID } : { status: 'signedOut', userId: null });
  },

  continueAsGuest: async () => {
    await kv.setItem(GUEST_FLAG, '1');
    set({ status: 'guest', userId: GUEST_USER_ID, email: null });
  },

  signIn: async (email, password) => {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await adoptSession(data.session);
  },

  signUp: async (email, password, name) => {
    const client = requireSupabase();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) throw error;
    if (data.session) {
      await adoptSession(data.session);
      return { needsConfirmation: false };
    }
    return { needsConfirmation: true };
  },

  signOut: async () => {
    if (supabase && useAuth.getState().status === 'signedIn') {
      await supabase.auth.signOut();
    }
    await kv.removeItem(GUEST_FLAG);
    set({ status: 'signedOut', userId: null, email: null });
  },

  sendPasswordReset: async (email) => {
    const client = requireSupabase();
    const { error } = await client.auth.resetPasswordForEmail(email);
    if (error) throw error;
  },

  deleteLocalAccount: async () => {
    const { getDb } = await import('@/services/db');
    const db = await getDb();
    const userId = useAuth.getState().userId;
    if (userId) {
      for (const table of ['workouts', 'workout_templates', 'personal_records', 'ai_conversations', 'sync_queue', 'favorites']) {
        await db.runAsync(`DELETE FROM ${table} WHERE user_id = ?`, [userId]);
      }
      await db.runAsync('DELETE FROM profiles WHERE id = ?', [userId]);
    }
    await useAuth.getState().signOut();
  },
}));

export function useUserId() {
  return useAuth((s) => s.userId) ?? GUEST_USER_ID;
}

export const authMode = isSupabaseConfigured ? 'supabase' : 'offline';
