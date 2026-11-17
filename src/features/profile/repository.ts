import { getDb, nowIso } from '@/services/db';
import { enqueueSync } from '@/services/sync-queue';
import type { Profile } from '@/types';

export function defaultProfile(id: string, name = 'Athlete'): Profile {
  return {
    id,
    name,
    avatarUri: null,
    age: null,
    heightCm: null,
    weightKg: null,
    experience: 'intermediate',
    goals: ['build_muscle'],
    preferredDays: ['mon', 'wed', 'fri'],
    preferredDurationMinutes: 60,
    trainingPreferences: ['Free weights'],
    updatedAt: nowIso(),
  };
}

export async function getProfile(userId: string): Promise<Profile> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM profiles WHERE id = ?', [userId]);
  if (!row) return defaultProfile(userId);
  return { ...defaultProfile(userId), ...(JSON.parse(row.data) as Profile), id: userId };
}

export async function saveProfile(profile: Profile, options: { sync?: boolean } = {}) {
  const db = await getDb();
  const next = { ...profile, updatedAt: nowIso() };
  await db.runAsync('INSERT OR REPLACE INTO profiles (id, data, updated_at) VALUES (?, ?, ?)', [
    profile.id,
    JSON.stringify(next),
    next.updatedAt,
  ]);
  if (options.sync !== false) await enqueueSync(profile.id, 'profile', profile.id, 'upsert');
  return next;
}
