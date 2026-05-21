import { getDb } from '@/lib/db';
import { emit } from '@/lib/events';
import * as outbox from '@/lib/sync/outbox';
import { uuidv4 } from '@/lib/uuid';

export interface Favorite {
  id: string;
  displayName: string;
  namedayKey: string;
  birthDate: string | null;
  relationship: string | null;
  notes: string | null;
  updatedAt: string;
  deletedAt: string | null;
  dirty: boolean;
}

interface FavoriteRow {
  id: string;
  display_name: string;
  nameday_key: string;
  birth_date: string | null;
  relationship: string | null;
  notes: string | null;
  updated_at: string;
  deleted_at: string | null;
  dirty: number;
}

export interface FavoriteInput {
  displayName: string;
  namedayKey: string;
  birthDate: string | null;
  relationship: string | null;
  notes: string | null;
}

function rowToFavorite(r: FavoriteRow): Favorite {
  return {
    id: r.id,
    displayName: r.display_name,
    namedayKey: r.nameday_key,
    birthDate: r.birth_date,
    relationship: r.relationship,
    notes: r.notes,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    dirty: r.dirty === 1,
  };
}

export async function listLive(): Promise<Favorite[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<FavoriteRow>(
    `SELECT * FROM favorites WHERE deleted_at IS NULL ORDER BY display_name COLLATE NOCASE ASC`,
  );
  return rows.map(rowToFavorite);
}

export async function getById(id: string): Promise<Favorite | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<FavoriteRow>(
    'SELECT * FROM favorites WHERE id = ?',
    id,
  );
  return row ? rowToFavorite(row) : null;
}

export async function countLive(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM favorites WHERE deleted_at IS NULL',
  );
  return row?.n ?? 0;
}

export async function create(input: FavoriteInput): Promise<Favorite> {
  const db = await getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO favorites
        (id, display_name, nameday_key, birth_date, relationship, notes, updated_at, deleted_at, dirty)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
      id,
      input.displayName,
      input.namedayKey,
      input.birthDate,
      input.relationship,
      input.notes,
      now,
    );

    await outbox.enqueue({
      op: 'create',
      favoriteId: id,
      payload: {
        id,
        displayName: input.displayName,
        nameDayKey: input.namedayKey || null,
        birthdayDate: input.birthDate,
        relationship: input.relationship,
      },
    });
  });

  emit('favorites:changed');
  return (await getById(id))!;
}

export async function update(id: string, input: FavoriteInput): Promise<Favorite> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE favorites SET
        display_name = ?, nameday_key = ?, birth_date = ?,
        relationship = ?, notes = ?, updated_at = ?, dirty = 1
        WHERE id = ?`,
      input.displayName,
      input.namedayKey,
      input.birthDate,
      input.relationship,
      input.notes,
      now,
      id,
    );

    await outbox.enqueue({
      op: 'update',
      favoriteId: id,
      payload: {
        displayName: input.displayName,
        nameDayKey: input.namedayKey || null,
        birthdayDate: input.birthDate,
        relationship: input.relationship,
      },
    });
  });

  emit('favorites:changed');
  return (await getById(id))!;
}

export async function softDelete(id: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE favorites SET deleted_at = ?, dirty = 1 WHERE id = ?',
      now,
      id,
    );
    await outbox.enqueue({ op: 'delete', favoriteId: id });
  });

  emit('favorites:changed');
}
