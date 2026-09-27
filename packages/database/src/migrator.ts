/**
 * Driver-agnostic SQL migration runner. Works with any client that can run multi-statement SQL
 * (`exec`) and parameterised queries (`query`): PGlite (tests, local dev) and Neon's Pool (remote).
 */
export type Migration = { name: string; sql: string };

export type MigrationClient = {
  exec(sql: string): Promise<unknown>;
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
};

export const MIGRATION_FILE_PATTERN = /^\d{4}_[a-z0-9_]+\.sql$/;
const TRACKING_TABLE = '_bubo_migrations';

/** Applies pending migrations in order, each in its own transaction. Returns the names applied. */
export async function applyMigrations(
  client: MigrationClient,
  migrations: Migration[],
): Promise<string[]> {
  const ordered = [...migrations].sort((a, b) => a.name.localeCompare(b.name));
  for (const migration of ordered) {
    if (!MIGRATION_FILE_PATTERN.test(migration.name)) {
      throw new Error(`Invalid migration name: ${migration.name}`);
    }
  }

  await client.exec(
    `CREATE TABLE IF NOT EXISTS "${TRACKING_TABLE}" ("name" text PRIMARY KEY, "applied_at" timestamptz NOT NULL DEFAULT now())`,
  );
  const { rows } = await client.query(`SELECT "name" FROM "${TRACKING_TABLE}"`);
  const applied = new Set(
    rows
      .map((row) => (row as { name?: unknown }).name)
      .filter((n): n is string => typeof n === 'string'),
  );

  const newlyApplied: string[] = [];
  for (const migration of ordered) {
    if (applied.has(migration.name)) continue;
    await client.exec('BEGIN');
    try {
      await client.exec(migration.sql);
      await client.query(`INSERT INTO "${TRACKING_TABLE}" ("name") VALUES ($1)`, [migration.name]);
      await client.exec('COMMIT');
      newlyApplied.push(migration.name);
    } catch (error) {
      await client.exec('ROLLBACK');
      throw error;
    }
  }
  return newlyApplied;
}
