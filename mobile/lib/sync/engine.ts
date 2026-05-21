import { client } from '@/lib/api/client';
import { toAppError, type AppError } from '@/lib/api/error';
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
  // Present on hardened backend; absent (treated as false) on legacy backend.
  hasMore?: boolean;
}

const PULL_PAGE_LIMIT = 500;
const MAX_PULL_PAGES = 50;   // safety net against runaway loops

// 4xx codes/statuses we never want to retry — they're permanent until the user fixes
// something on their end (deletes a favorite, fixes input, etc.).
const NON_RETRYABLE_CODES = new Set(['FREE_TIER_CAP', 'VALIDATION', 'DUPLICATE_FAVORITE_ID']);
const NON_RETRYABLE_STATUSES = new Set([400, 402, 403, 422]);

function isNonRetryable(appError: AppError): boolean {
  if (appError.code && NON_RETRYABLE_CODES.has(appError.code)) return true;
  if (appError.status && NON_RETRYABLE_STATUSES.has(appError.status)) return true;
  return false;
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
    // Permanently-blocked 4xx entries are skipped so newer writes can flush past them.
    // They still surface in useStuckOutbox.
    if (entry.blocked) continue;

    if (entry.attempts > 0 && entry.attempts < STUCK_THRESHOLD) {
      // Exponential backoff measured from the LAST attempt (not creation), so a stuck-then-foregrounded
      // app doesn't burn through the budget in seconds.
      const wait = Math.min(BACKOFF_BASE_MS * 2 ** (entry.attempts - 1), BACKOFF_CAP_MS);
      const lastAttempted = new Date(entry.lastAttemptedAt ?? entry.createdAt).getTime();
      if (Date.now() - lastAttempted < wait) continue;
    }

    try {
      await sendEntry(entry);
      await outbox.markDone(entry.id);
      await clearDirty(entry.favoriteId);
    } catch (e) {
      const appError = toAppError(e);
      // Format: "<status>:<code>: <message>" so useStuckOutbox can match either on status (402
      // legacy / 403 hardened) or on code ("FREE_TIER_CAP") without parsing JSON.
      const formatted = appError.status
        ? `${appError.status}:${appError.code}: ${appError.message}`
        : `${appError.code}: ${appError.message}`;
      await outbox.markFailed(entry.id, formatted, { blocked: isNonRetryable(appError) });
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
  // Loop through pages until the backend signals there's nothing more. Legacy backend never
  // sends hasMore=true, so the loop exits after one iteration there.
  let since = await getSyncState('last_synced_at');
  let nextSince: string | null = since;
  let pages = 0;

  while (pages < MAX_PULL_PAGES) {
    const params: Record<string, string | number> = { limit: PULL_PAGE_LIMIT };
    if (since) params.since = since;

    const resp = await client.get<FavoritesSyncResponse>('/favorites', { params });
    const { favorites, deletions, syncedAt, hasMore } = resp.data;

    await applyPage(favorites, deletions);
    pages += 1;

    if (!hasMore) {
      // Only persist the server's authoritative syncedAt when we've drained everything.
      // Persisting it mid-paging would mean a crash leaves us at the last full-sweep cursor,
      // skipping later pages on the next pull.
      nextSince = syncedAt;
      break;
    }

    // Advance the cursor to the latest row's updatedAt so the next page picks up from there.
    // Server uses >= comparator so any tie is included.
    const latest = favorites[favorites.length - 1];
    if (!latest) break;
    since = latest.updatedAt ?? latest.createdAt;
    nextSince = since;
  }

  if (nextSince) await setSyncState('last_synced_at', nextSince);
}

async function applyPage(favorites: ServerFavorite[], deletions: string[]): Promise<void> {
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
}
