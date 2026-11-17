import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';

import { GUEST_USER_ID } from '@/features/auth/store';
import { listFavorites, setFavorite } from '@/features/exercises/favorites';
import { getProfile, saveProfile } from '@/features/profile/repository';
import {
  getTemplate,
  getWorkout,
  listPersonalRecords,
  recomputePersonalRecords,
  saveWorkout,
} from '@/features/workouts/repository';
import { toErrorMessage } from '@/lib/utils';
import type { Workout } from '@/types';
import { getDb } from './db';
import { kv } from './kv';
import { supabase } from './supabase';
import { markFailed, markSynced, pendingSyncItems, type SyncQueueItem } from './sync-queue';

/**
 * Offline-first sync. Every local write lands in SQLite first and is recorded in `sync_queue`.
 * When the device is online and the user is signed in, the queue is pushed in order; on first
 * sign-in on a device, the user's remote history is pulled down once.
 */

let running: Promise<SyncResult> | null = null;
type Listener = (state: SyncState) => void;
export type SyncState = { status: 'idle' | 'syncing' | 'offline' | 'error'; lastSyncedAt: string | null; error?: string };
let state: SyncState = { status: 'idle', lastSyncedAt: null };
const listeners = new Set<Listener>();

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

export function subscribeSync(listener: Listener) {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
}

export type SyncResult = { pushed: number; failed: number; skipped?: string };

async function pushWorkout(userId: string, id: string) {
  const client = supabase!;
  const workout = await getWorkout(id);
  if (!workout || workout.isSample || workout.status !== 'completed') return;
  const { error } = await client.from('workouts').upsert({
    id: workout.id,
    user_id: userId,
    template_id: workout.templateId,
    name: workout.name,
    status: workout.status,
    started_at: workout.startedAt,
    ended_at: workout.endedAt,
    duration_seconds: workout.durationSeconds,
    notes: workout.notes,
  });
  if (error) throw error;
  // Children are replaced wholesale; cascades remove old sets.
  const del = await client.from('workout_exercises').delete().eq('workout_id', workout.id);
  if (del.error) throw del.error;
  if (workout.exercises.length) {
    const ex = await client.from('workout_exercises').insert(
      workout.exercises.map((e, position) => ({
        id: e.id,
        workout_id: workout.id,
        user_id: userId,
        exercise_id: e.exerciseId,
        position,
        notes: e.notes,
        rest_seconds: e.restSeconds,
      })),
    );
    if (ex.error) throw ex.error;
    const sets = workout.exercises.flatMap((e) =>
      e.sets.map((s, position) => ({
        id: s.id,
        workout_exercise_id: e.id,
        user_id: userId,
        position,
        set_type: s.type,
        weight_kg: s.weightKg,
        reps: s.reps,
        duration_seconds: s.durationSeconds,
        completed: s.completed,
        completed_at: s.completedAt,
      })),
    );
    if (sets.length) {
      const res = await client.from('workout_sets').insert(sets);
      if (res.error) throw res.error;
    }
  }
}

async function pushItem(item: SyncQueueItem) {
  const client = supabase!;
  const userId = item.user_id;
  switch (item.entity) {
    case 'workout': {
      if (item.op === 'delete') {
        const { error } = await client.from('workouts').delete().eq('id', item.entity_id);
        if (error) throw error;
      } else {
        await pushWorkout(userId, item.entity_id);
      }
      return;
    }
    case 'template': {
      if (item.op === 'delete') {
        const { error } = await client.from('workout_templates').delete().eq('id', item.entity_id);
        if (error) throw error;
        return;
      }
      const t = await getTemplate(item.entity_id);
      if (!t) return;
      const { error } = await client.from('workout_templates').upsert({
        id: t.id,
        user_id: userId,
        name: t.name,
        description: t.description,
        focus: t.focus,
        estimated_minutes: t.estimatedMinutes,
        exercises: t.exercises,
        created_at: t.createdAt,
      });
      if (error) throw error;
      return;
    }
    case 'favorite': {
      if (item.op === 'delete') {
        const { error } = await client
          .from('user_favorites')
          .delete()
          .eq('user_id', userId)
          .eq('exercise_id', item.entity_id);
        if (error) throw error;
      } else {
        const { error } = await client
          .from('user_favorites')
          .upsert({ user_id: userId, exercise_id: item.entity_id });
        if (error) throw error;
      }
      return;
    }
    case 'profile': {
      const p = await getProfile(userId);
      const { error } = await client.from('profiles').upsert({
        id: userId,
        full_name: p.name,
        avatar_url: p.avatarUri?.startsWith('http') ? p.avatarUri : null,
        age: p.age,
        height_cm: p.heightCm,
        weight_kg: p.weightKg,
        experience: p.experience,
        preferred_days: p.preferredDays,
        preferred_duration_minutes: p.preferredDurationMinutes,
        training_preferences: p.trainingPreferences,
      });
      if (error) throw error;
      const del = await client.from('user_goals').delete().eq('user_id', userId);
      if (del.error) throw del.error;
      if (p.goals.length) {
        const ins = await client
          .from('user_goals')
          .insert(p.goals.map((goal, i) => ({ user_id: userId, goal, is_primary: i === 0 })));
        if (ins.error) throw ins.error;
      }
      return;
    }
    case 'conversation': {
      const db = await getDb();
      const conv = await db.getFirstAsync<{ id: string; title: string; created_at: string }>(
        'SELECT * FROM ai_conversations WHERE id = ?',
        [item.entity_id],
      );
      if (!conv) {
        await client.from('ai_conversations').delete().eq('id', item.entity_id);
        return;
      }
      const { error } = await client
        .from('ai_conversations')
        .upsert({ id: conv.id, user_id: userId, title: conv.title, created_at: conv.created_at });
      if (error) throw error;
      const messages = await db.getAllAsync<{ id: string; role: string; content: string; payload: string | null; created_at: string }>(
        'SELECT * FROM ai_messages WHERE conversation_id = ?',
        [conv.id],
      );
      if (messages.length) {
        const res = await client.from('ai_messages').upsert(
          messages.map((m) => ({
            id: m.id,
            conversation_id: conv.id,
            user_id: userId,
            role: m.role,
            content: m.content,
            payload: m.payload ? JSON.parse(m.payload) : null,
            created_at: m.created_at,
          })),
        );
        if (res.error) throw res.error;
      }
      return;
    }
  }
}

async function pushPersonalRecords(userId: string) {
  const records = await listPersonalRecords(userId);
  const remote = records.filter((r) => !r.workoutId.startsWith('sample-'));
  if (!remote.length) return;
  const { error } = await supabase!.from('personal_records').upsert(
    remote.map((r) => ({
      user_id: userId,
      exercise_id: r.exerciseId,
      record_type: r.type,
      value: r.value,
      reps: r.reps,
      workout_id: r.workoutId,
      achieved_at: r.achievedAt,
    })),
    { onConflict: 'user_id,exercise_id,record_type' },
  );
  if (error) throw error;
}

/** One-time download of a signed-in user's data onto this device. */
async function pullOnce(userId: string) {
  const flag = `reptrack.pulled.${userId}`;
  if ((await kv.getItem(flag)) === '1') return;
  const client = supabase!;

  const { data: workouts, error } = await client
    .from('workouts')
    .select('*, workout_exercises(*, workout_sets(*))')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(500);
  if (error) throw error;

  for (const w of workouts ?? []) {
    const local: Workout = {
      id: w.id,
      userId,
      name: w.name,
      status: w.status,
      startedAt: w.started_at,
      endedAt: w.ended_at,
      durationSeconds: w.duration_seconds,
      notes: w.notes ?? '',
      templateId: w.template_id,
      exercises: [...(w.workout_exercises ?? [])]
        .sort((a: { position: number }, b: { position: number }) => a.position - b.position)
        .map((e: any) => ({
          id: e.id,
          exerciseId: e.exercise_id,
          order: e.position,
          notes: e.notes ?? '',
          restSeconds: e.rest_seconds,
          sets: [...(e.workout_sets ?? [])]
            .sort((a: { position: number }, b: { position: number }) => a.position - b.position)
            .map((s: any) => ({
              id: s.id,
              index: s.position,
              type: s.set_type,
              weightKg: s.weight_kg == null ? null : Number(s.weight_kg),
              reps: s.reps,
              durationSeconds: s.duration_seconds,
              completed: s.completed,
              completedAt: s.completed_at,
            })),
        })),
    };
    await saveWorkout(local, { sync: false });
  }

  const templates = await client.from('workout_templates').select('*').eq('user_id', userId);
  if (templates.error) throw templates.error;
  for (const t of templates.data ?? []) {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO workout_templates
        (id, user_id, name, description, focus, estimated_minutes, exercises, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.id, userId, t.name, t.description ?? '', JSON.stringify(t.focus ?? []), t.estimated_minutes, JSON.stringify(t.exercises ?? []), t.created_at, t.updated_at],
    );
  }

  const favs = await client.from('user_favorites').select('exercise_id').eq('user_id', userId);
  if (favs.error) throw favs.error;
  const local = new Set(await listFavorites(userId));
  for (const f of favs.data ?? []) {
    if (!local.has(f.exercise_id)) await setFavorite(userId, f.exercise_id, true);
  }

  const profile = await client.from('profiles').select('*, user_goals(goal, is_primary)').eq('id', userId).maybeSingle();
  if (profile.error) throw profile.error;
  if (profile.data) {
    const current = await getProfile(userId);
    const p = profile.data;
    await saveProfile(
      {
        ...current,
        name: p.full_name ?? current.name,
        avatarUri: p.avatar_url ?? current.avatarUri,
        age: p.age ?? current.age,
        heightCm: p.height_cm == null ? current.heightCm : Number(p.height_cm),
        weightKg: p.weight_kg == null ? current.weightKg : Number(p.weight_kg),
        experience: p.experience ?? current.experience,
        preferredDays: p.preferred_days ?? current.preferredDays,
        preferredDurationMinutes: p.preferred_duration_minutes ?? current.preferredDurationMinutes,
        trainingPreferences: p.training_preferences ?? current.trainingPreferences,
        goals: (p.user_goals ?? []).length
          ? [...p.user_goals].sort((a: any, b: any) => Number(b.is_primary) - Number(a.is_primary)).map((g: any) => g.goal)
          : current.goals,
      },
      { sync: false },
    );
  }

  await recomputePersonalRecords(userId);
  await kv.setItem(flag, '1');
}

export async function syncNow(userId: string | null): Promise<SyncResult> {
  if (!supabase || !userId || userId === GUEST_USER_ID) return { pushed: 0, failed: 0, skipped: 'offline-mode' };
  if (running) return running;
  running = (async () => {
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      setState({ status: 'offline' });
      return { pushed: 0, failed: 0, skipped: 'no-connection' };
    }
    setState({ status: 'syncing', error: undefined });
    let pushed = 0;
    let failed = 0;
    try {
      await pullOnce(userId);
      const items = await pendingSyncItems(userId, 200);
      for (const item of items) {
        try {
          await pushItem(item);
          await markSynced(item.id);
          pushed++;
        } catch (error) {
          failed++;
          await markFailed(item.id, toErrorMessage(error));
        }
      }
      if (pushed) await pushPersonalRecords(userId);
      setState({ status: failed ? 'error' : 'idle', lastSyncedAt: new Date().toISOString(), error: failed ? `${failed} changes will retry` : undefined });
    } catch (error) {
      setState({ status: 'error', error: toErrorMessage(error) });
      failed++;
    }
    return { pushed, failed };
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Starts background sync triggers: reconnect, app foreground and a periodic heartbeat. */
export function startSyncTriggers(getUserId: () => string | null) {
  let wasConnected = true;
  const netSub = NetInfo.addEventListener((s) => {
    const connected = Boolean(s.isConnected);
    if (connected && !wasConnected) void syncNow(getUserId());
    if (!connected) setState({ status: 'offline' });
    wasConnected = connected;
  });
  const appSub = AppState.addEventListener('change', (s) => {
    if (s === 'active') void syncNow(getUserId());
  });
  const timer = setInterval(() => void syncNow(getUserId()), 5 * 60 * 1000);
  void syncNow(getUserId());
  return () => {
    netSub();
    appSub.remove();
    clearInterval(timer);
  };
}
