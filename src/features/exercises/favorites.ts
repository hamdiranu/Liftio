import { getDb, nowIso } from '@/services/db';
import { enqueueSync } from '@/services/sync-queue';

export async function listFavorites(userId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ exercise_id: string }>(
    'SELECT exercise_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC',
    [userId],
  );
  return rows.map((r) => r.exercise_id);
}

export async function setFavorite(userId: string, exerciseId: string, favorite: boolean) {
  const db = await getDb();
  if (favorite) {
    await db.runAsync('INSERT OR IGNORE INTO favorites (user_id, exercise_id, created_at) VALUES (?, ?, ?)', [
      userId,
      exerciseId,
      nowIso(),
    ]);
  } else {
    await db.runAsync('DELETE FROM favorites WHERE user_id = ? AND exercise_id = ?', [userId, exerciseId]);
  }
  await enqueueSync(userId, 'favorite', exerciseId, favorite ? 'upsert' : 'delete');
}
