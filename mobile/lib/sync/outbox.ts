import { getDb } from '@/lib/db';

import type { OutboxEntry, OutboxOp } from './types';

interface EnqueueInput {
  op: OutboxOp;
  favoriteId: string;
  payload?: unknown;
}

export async function enqueue(input: EnqueueInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO outbox (op, favorite_id, payload_json, created_at) VALUES (?, ?, ?, ?)',
    input.op,
    input.favoriteId,
    input.payload === undefined ? null : JSON.stringify(input.payload),
    new Date().toISOString(),
  );
}

export async function peek(limit = 50): Promise<OutboxEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: number;
    op: OutboxOp;
    favorite_id: string;
    payload_json: string | null;
    created_at: string;
    attempts: number;
    last_error: string | null;
    last_attempted_at: string | null;
    blocked: number;
  }>(
    'SELECT * FROM outbox ORDER BY created_at ASC, id ASC LIMIT ?',
    limit,
  );

  return rows.map((r) => ({
    id: r.id,
    op: r.op,
    favoriteId: r.favorite_id,
    payload: r.payload_json ? JSON.parse(r.payload_json) : null,
    createdAt: r.created_at,
    attempts: r.attempts,
    lastError: r.last_error,
    lastAttemptedAt: r.last_attempted_at,
    blocked: r.blocked === 1,
  }));
}

export async function markDone(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM outbox WHERE id = ?', id);
}

export async function markFailed(
  id: number,
  error: string,
  options?: { blocked?: boolean },
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE outbox SET attempts = attempts + 1, last_error = ?, last_attempted_at = ?, blocked = ? WHERE id = ?',
    error,
    now,
    options?.blocked ? 1 : 0,
    id,
  );
}

export async function count(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM outbox');
  return row?.n ?? 0;
}
