import { getDb } from '@/lib/db';

// Per-favorite notification overrides. All fields are nullable: NULL means
// "inherit the corresponding global default". Stored locally only — notifications
// are a device-side concern and the backend doesn't care which favorite a user
// silenced on their phone.
export interface NotificationOverride {
  enabled: boolean | null;
  hour: number | null;
  minute: number | null;
  leadDays: number | null;
}

interface OverrideRow {
  favorite_id: string;
  enabled: number | null;
  hour: number | null;
  minute: number | null;
  lead_days: number | null;
}

export const EMPTY_OVERRIDE: NotificationOverride = {
  enabled: null,
  hour: null,
  minute: null,
  leadDays: null,
};

function rowToOverride(r: OverrideRow): NotificationOverride {
  return {
    enabled: r.enabled === null ? null : r.enabled === 1,
    hour: r.hour,
    minute: r.minute,
    leadDays: r.lead_days,
  };
}

export function isOverrideEmpty(o: NotificationOverride): boolean {
  return o.enabled === null && o.hour === null && o.minute === null && o.leadDays === null;
}

export async function getOverride(favoriteId: string): Promise<NotificationOverride> {
  const db = await getDb();
  const row = await db.getFirstAsync<OverrideRow>(
    'SELECT * FROM favorite_notification_overrides WHERE favorite_id = ?',
    favoriteId,
  );
  return row ? rowToOverride(row) : EMPTY_OVERRIDE;
}

export async function getAllOverrides(): Promise<Map<string, NotificationOverride>> {
  const db = await getDb();
  const rows = await db.getAllAsync<OverrideRow>(
    'SELECT * FROM favorite_notification_overrides',
  );
  const map = new Map<string, NotificationOverride>();
  for (const r of rows) map.set(r.favorite_id, rowToOverride(r));
  return map;
}

// Upserts the override; if every field is NULL we delete the row instead, so the
// table stays clean and "no override" is represented by absence.
export async function setOverride(
  favoriteId: string,
  override: NotificationOverride,
): Promise<void> {
  const db = await getDb();
  if (isOverrideEmpty(override)) {
    await db.runAsync(
      'DELETE FROM favorite_notification_overrides WHERE favorite_id = ?',
      favoriteId,
    );
    return;
  }
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO favorite_notification_overrides
      (favorite_id, enabled, hour, minute, lead_days, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(favorite_id) DO UPDATE SET
        enabled    = excluded.enabled,
        hour       = excluded.hour,
        minute     = excluded.minute,
        lead_days  = excluded.lead_days,
        updated_at = excluded.updated_at`,
    favoriteId,
    override.enabled === null ? null : override.enabled ? 1 : 0,
    override.hour,
    override.minute,
    override.leadDays,
    now,
  );
}
