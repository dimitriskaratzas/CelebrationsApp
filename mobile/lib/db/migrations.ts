import type { SQLiteDatabase } from 'expo-sqlite';

interface Migration {
  version: number;
  name: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'init',
    sql: `
      CREATE TABLE IF NOT EXISTS favorites (
        id            TEXT PRIMARY KEY,
        display_name  TEXT NOT NULL,
        nameday_key   TEXT NOT NULL,
        birth_date    TEXT,
        relationship  TEXT,
        notes         TEXT,
        updated_at    TEXT NOT NULL,
        deleted_at    TEXT,
        dirty         INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_favorites_live_nameday
        ON favorites (deleted_at, nameday_key);

      CREATE INDEX IF NOT EXISTS idx_favorites_dirty
        ON favorites (dirty);

      CREATE TABLE IF NOT EXISTS outbox (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        op           TEXT NOT NULL CHECK (op IN ('create', 'update', 'delete')),
        favorite_id  TEXT NOT NULL,
        payload_json TEXT,
        created_at   TEXT NOT NULL,
        attempts     INTEGER NOT NULL DEFAULT 0,
        last_error   TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_outbox_fifo ON outbox (created_at);

      CREATE TABLE IF NOT EXISTS sync_state (
        key   TEXT PRIMARY KEY,
        value TEXT
      );
    `,
  },
];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations',
  );
  const appliedVersions = new Set(applied.map((r) => r.version));

  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) continue;
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.sql);
      await db.runAsync(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        migration.version,
        migration.name,
        new Date().toISOString(),
      );
    });
  }
}
