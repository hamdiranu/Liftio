import { uuid } from '@/lib/utils';
import { getDb, nowIso } from '@/services/db';
import { enqueueSync } from '@/services/sync-queue';
import type { ChatMessage, Conversation } from '@/types';

type MessageRow = { id: string; conversation_id: string; role: ChatMessage['role']; content: string; payload: string | null; created_at: string };

export async function listConversations(userId: string): Promise<Conversation[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; title: string; created_at: string; updated_at: string }>(
    'SELECT * FROM ai_conversations WHERE user_id = ? ORDER BY updated_at DESC',
    [userId],
  );
  return rows.map((r) => ({ id: r.id, title: r.title, createdAt: r.created_at, updatedAt: r.updated_at }));
}

export async function createConversation(userId: string, title = 'New chat'): Promise<Conversation> {
  const db = await getDb();
  const c: Conversation = { id: uuid(), title, createdAt: nowIso(), updatedAt: nowIso() };
  await db.runAsync('INSERT INTO ai_conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
    c.id,
    userId,
    c.title,
    c.createdAt,
    c.updatedAt,
  ]);
  return c;
}

export async function deleteConversation(userId: string, id: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM ai_conversations WHERE id = ? AND user_id = ?', [id, userId]);
  await enqueueSync(userId, 'conversation', id, 'delete');
}

export async function listMessages(conversationId: string): Promise<ChatMessage[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MessageRow>(
    'SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY created_at, rowid',
    [conversationId],
  );
  return rows.map((r) => {
    const payload = r.payload ? (JSON.parse(r.payload) as Partial<ChatMessage>) : {};
    return { id: r.id, conversationId: r.conversation_id, role: r.role, content: r.content, createdAt: r.created_at, ...payload };
  });
}

export async function addMessage(userId: string, message: ChatMessage, title?: string) {
  const db = await getDb();
  const { workout, exerciseIds, quickActions } = message;
  const payload = workout || exerciseIds || quickActions ? JSON.stringify({ workout, exerciseIds, quickActions }) : null;
  await db.runAsync(
    'INSERT OR REPLACE INTO ai_messages (id, conversation_id, role, content, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [message.id, message.conversationId, message.role, message.content, payload, message.createdAt],
  );
  if (title) {
    await db.runAsync('UPDATE ai_conversations SET updated_at = ?, title = ? WHERE id = ?', [nowIso(), title, message.conversationId]);
  } else {
    await db.runAsync('UPDATE ai_conversations SET updated_at = ? WHERE id = ?', [nowIso(), message.conversationId]);
  }
  await enqueueSync(userId, 'conversation', message.conversationId, 'upsert');
}
