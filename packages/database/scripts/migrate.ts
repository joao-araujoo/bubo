// Applies pending SQL migrations to the database in DATABASE_URL (Neon). Idempotent.
// Usage: npm run db:migrate --workspace @bubo/database
// Never run against production without an explicit, reviewed release step.
import { Pool } from '@neondatabase/serverless';

import {
  applyMigrations,
  loadMigrations,
  loadDatabaseUrl,
  migrationDatabaseUrl,
} from '../src/node';

async function main() {
  const databaseUrl = loadDatabaseUrl();
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Aborting (no changes made).');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: migrationDatabaseUrl(databaseUrl) });
  try {
    const client = await pool.connect();
    try {
      if (process.argv.includes('--check')) {
        const table = await client.query("select to_regclass('public._bubo_migrations') as name");
        const records = table.rows[0]?.name
          ? await client.query('select name from _bubo_migrations')
          : { rows: [] };
        const names = new Set(records.rows.map((row: { name: string }) => row.name));
        const pending = loadMigrations()
          .filter((migration) => !names.has(migration.name))
          .map((migration) => migration.name);
        console.log(JSON.stringify({ pending, changesMade: false }));
      } else {
        const applied = await applyMigrations(
          { exec: (sql) => client.query(sql), query: (sql, params) => client.query(sql, params) },
          loadMigrations(),
        );
        console.log(applied.length ? `applied: ${applied.join(', ')}` : 'migrations up to date');
      }
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    'Database migration/check failed. Confirm connectivity and schema; credentials were not logged.',
  );
  // SQL errors (5-char SQLSTATE) are safe to show and say which statement failed. Connection
  // errors are not printed: they can include the host or user.
  const pg = error as { code?: unknown; message?: unknown };
  if (typeof pg.code === 'string' && /^[0-9A-Z]{5}$/.test(pg.code)) {
    console.error(`Postgres ${pg.code}: ${String(pg.message)}`);
  }
  process.exitCode = 1;
});
