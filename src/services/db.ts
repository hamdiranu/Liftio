import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

/**
 * Local SQLite database. It is the offline source of truth for everything a user logs;
 * Supabase is synced from it through the `sync_queue` outbox (see services/sync.ts).
 */
const DB_NAME = 'reptrack.db';

const MIGRATIONS: string[] = [
  // v1 — initial schema
  `
  CREATE TABLE IF NOT EXISTS workouts (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    template_id TEXT,
    is_sample INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_workouts_user_started ON workouts (user_id, started_at DESC);

  CREATE TABLE IF NOT EXISTS workout_exercises (
    id TEXT PRIMARY KEY NOT NULL,
    workout_id TEXT NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    rest_seconds INTEGER NOT NULL DEFAULT 90
  );
  CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout ON workout_exercises (workout_id);
  CREATE INDEX IF NOT EXISTS idx_workout_exercises_exercise ON workout_exercises (exercise_id);

  CREATE TABLE IF NOT EXISTS workout_sets (
    id TEXT PRIMARY KEY NOT NULL,
    workout_exercise_id TEXT NOT NULL REFERENCES workout_exercises (id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    set_type TEXT NOT NULL DEFAULT 'working',
    weight_kg REAL,
    reps INTEGER,
    duration_seconds INTEGER,
    completed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise ON workout_sets (workout_exercise_id);

  CREATE TABLE IF NOT EXISTS workout_templates (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    focus TEXT NOT NULL DEFAULT '[]',
    estimated_minutes INTEGER NOT NULL DEFAULT 45,
    exercises TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_templates_user ON workout_templates (user_id);

  CREATE TABLE IF NOT EXISTS personal_records (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    record_type TEXT NOT NULL,
    value REAL NOT NULL,
    reps INTEGER,
    workout_id TEXT NOT NULL,
    achieved_at TEXT NOT NULL,
    UNIQUE (user_id, exercise_id, record_type)
  );

  CREATE TABLE IF NOT EXISTS favorites (
    user_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, exercise_id)
  );

  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY NOT NULL,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ai_conversations (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ai_messages (
    id TEXT PRIMARY KEY NOT NULL,
    conversation_id TEXT NOT NULL REFERENCES ai_conversations (id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    payload TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages (conversation_id, created_at);

  CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    op TEXT NOT NULL,
    created_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue (entity, entity_id, op);
  `,
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrate(db: SQLite.SQLiteDatabase) {
  // WAL improves concurrent reads on device; the web VFS (OPFS access handles) doesn't support it.
  if (Platform.OS !== 'web') {
    await db.execAsync('PRAGMA journal_mode = WAL;');
  }
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const next = version + 1;
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
      await db.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
}

async function openAndMigrate() {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  try {
    await migrate(db);
    return db;
  } catch (error) {
    // Close so a retry doesn't reuse a connection left inside a failed transaction.
    await db.closeAsync().catch(() => undefined);
    throw error;
  }
}

/** Errors that mean the file itself is unusable, as opposed to briefly locked or busy. */
const CORRUPTION = /malformed|not a database/i;
/**
 * Web: the previous page's SQLite worker can still hold the OPFS file handles when a new page
 * starts (fast reloads and navigations). expo-sqlite's worker then fails to start its storage
 * layer and never retries, reporting "Invalid VFS state" for the rest of that page, so retrying
 * in place can't help. One delayed reload sometimes clears it; if not, the app falls back to the
 * sign-in screen until the old handles are released (closing the tab always does).
 * Native platforms are unaffected.
 */
const WEB_STORAGE_BUSY = /invalid vfs state/i;
const RELOAD_KEY = 'reptrack.db-reload-at';

function reloadOnceForBusyStorage() {
  if (typeof window === 'undefined') return false;
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 15_000) return false; // already tried; don't loop
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  // Give the previous page's worker a moment to release its handles before starting over.
  setTimeout(() => window.location.reload(), 1500);
  return true;
}

async function openWithRetry() {
  let lastError: unknown;
  // A reload can start while the previous page's worker still holds the OPFS handles (web), or
  // the file can be briefly busy; wait and retry before treating the failure as real.
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await openAndMigrate();
    } catch (error) {
      lastError = error;
      // Busy web storage stays broken for this page; go straight to the reload below.
      if (Platform.OS === 'web' && WEB_STORAGE_BUSY.test(String((error as Error)?.message ?? error))) break;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  const message = String((lastError as Error)?.message ?? lastError);
  if (Platform.OS === 'web' && WEB_STORAGE_BUSY.test(message) && reloadOnceForBusyStorage()) {
    // The page is reloading; never resolve so nothing renders against a broken database.
    return new Promise<never>(() => undefined);
  }
  // Web only, and only for clear corruption: the browser copy is a local cache, so reset it
  // rather than leave the app unusable. Native databases are never deleted automatically.
  if (Platform.OS === 'web' && CORRUPTION.test(message)) {
    console.warn('[db] resetting corrupted web database', lastError);
    await SQLite.deleteDatabaseAsync(DB_NAME).catch(() => undefined);
    return openAndMigrate();
  }
  throw lastError;
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openWithRetry().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

export const bool = (value: number | null | undefined) => value === 1;
export const nowIso = () => new Date().toISOString();
