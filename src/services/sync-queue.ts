import { getDb, nowIso } from './db';

export type SyncEntity = 'workout' | 'template' | 'favorite' | 'profile' | 'conversation';
export type SyncOp = 'upsert' | 'delete';

export interface SyncQueueItem {
  id: number;
  user_id: string;
  entity: SyncEntity;
  entity_id: string;
  op: SyncOp;
  created_at: string;
  attempts: number;
  last_error: string | null;
}

/**
 * Records a pending change. Upsert and delete for the same row collapse so the queue
 * never pushes stale data — the latest local state is read at push time.
 */
export async function enqueueSync(userId: string, entity: SyncEntity, entityId: string, op: SyncOp) {
  const db = await getDb();
  const opposite: SyncOp = op === 'upsert' ? 'delete' : 'upsert';
  await db.runAsync('DELETE FROM sync_queue WHERE entity = ? AND entity_id = ? AND op = ?', [
    entity,
    entityId,
    opposite,
  ]);
  await db.runAsync(
    `INSERT OR REPLACE INTO sync_queue (user_id, entity, entity_id, op, created_at, attempts, last_error)
     VALUES (?, ?, ?, ?, ?, 0, NULL)`,
    [userId, entity, entityId, op, nowIso()],
  );
}

export async function pendingSyncItems(userId: string, limit = 50) {
  const db = await getDb();
  return db.getAllAsync<SyncQueueItem>(
    'SELECT * FROM sync_queue WHERE user_id = ? ORDER BY id LIMIT ?',
    [userId, limit],
  );
}

export async function pendingSyncCount(userId: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sync_queue WHERE user_id = ?', [
    userId,
  ]);
  return row?.n ?? 0;
}

export async function markSynced(id: number) {
  const db = await getDb();
  await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
}

export async function markFailed(id: number, error: string) {
  const db = await getDb();
  await db.runAsync('UPDATE sync_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?', [error, id]);
}
