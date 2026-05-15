import axios from 'axios';

import { client } from '@/lib/api/client';
import { getDb } from '@/lib/db';
import { getSyncState, setSyncState } from '@/lib/db/sync-state';

import * as outbox from './outbox';
import type { OutboxEntry } from './types';

const STUCK_THRESHOLD = 5;
const BACKOFF_BASE_MS = 2_000;
const BACKOFF_CAP_MS = 5 * 60 * 1_000;

interface ServerFavorite {
  id: string;
  displayName: string;
  nameDayKey: string | null;
  birthdayDate: string | null;
  relationship: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface FavoritesSyncResponse {
  favorites: ServerFavorite[];
  deletions: string[];
  syncedAt: string;
}

let flushInFlight: Promise<void> | null = null;
let pullInFlight: Promise<void> | null = null;

export function flushOutbox(): Promise<void> {
  flushInFlight ??= doFlush().finally(() => {
    flushInFlight = null;
  });
  return flushInFlight;
}

export function pull(): Promise<void> {
  pullInFlight ??= doPull().finally(() => {
    pullInFlight = null;
  });
  return pullInFlight;
}

export async function pendingCount(): Promise<number> {
  return outbox.count();
}

async function doFlush(): Promise<void> {
  const entries = await outbox.peek();
  for (const entry of entries) {
    if (entry.attempts > 0) {
      const wait = Math.min(BACKOFF_BASE_MS * 2 ** (entry.attempts - 1), BACKOFF_CAP_MS);
      const lastAttempted = new Date(entry.createdAt).getTime();
      if (Date.now() - lastAttempted < wait && entry.attempts < STUCK_THRESHOLD) {
        continue;
      }
    }

    try {
      await sendEntry(entry);
      await outbox.markDone(entry.id);
      await clearDirty(entry.favoriteId);
    } catch (e) {
      const status = axios.isAxiosError(e) ? e.response?.status : undefined;
      const message = axios.isAxiosError(e)
        ? (e.response?.data as { error?: string } | undefined)?.error ?? e.message
        : e instanceof Error
          ? e.message
          : String(e);

      if (status && status >= 400 && status < 500) {
        await outbox.markFailed(entry.id, `${status}: ${message}`);
      } else {
        await outbox.markFailed(entry.id, message);
      }
    }
  }
}

async function sendEntry(entry: OutboxEntry): Promise<void> {
  if (entry.op === 'create') {
    await client.post('/favorites', entry.payload);
  } else if (entry.op === 'update') {
    await client.put(`/favorites/${entry.favoriteId}`, entry.payload);
  } else {
    await client.delete(`/favorites/${entry.favoriteId}`);
  }
}

async function clearDirty(favoriteId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE favorites SET dirty = 0 WHERE id = ?', favoriteId);
}

async function doPull(): Promise<void> {
  const since = await getSyncState('last_synced_at');
  const resp = await client.get<FavoritesSyncResponse>('/favorites', {
    params: since ? { since } : undefined,
  });
  const { favorites, deletions, syncedAt } = resp.data;

  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const f of favorites) {
      const existing = await db.getFirstAsync<{ dirty: number }>(
        'SELECT dirty FROM favorites WHERE id = ?',
        f.id,
      );
      if (existing?.dirty === 1) continue;
      await db.runAsync(
        `INSERT INTO favorites (id, display_name, nameday_key, birth_date, relationship, notes, updated_at, deleted_at, dirty)
         VALUES (?, ?, ?, ?, ?, NULL, ?, NULL, 0)
         ON CONFLICT(id) DO UPDATE SET
           display_name = excluded.display_name,
           nameday_key = excluded.nameday_key,
           birth_date = excluded.birth_date,
           relationship = excluded.relationship,
           updated_at = excluded.updated_at,
           deleted_at = NULL
         WHERE favorites.dirty = 0`,
        f.id,
        f.displayName,
        f.nameDayKey ?? '',
        f.birthdayDate,
        f.relationship,
        f.updatedAt ?? f.createdAt,
      );
    }

    for (const id of deletions) {
      await db.runAsync('DELETE FROM favorites WHERE id = ? AND dirty = 0', id);
    }
  });

  await setSyncState('last_synced_at', syncedAt);
}
