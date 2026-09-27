// Applies pending SQL migrations to the database in DATABASE_URL (Neon). Idempotent.
// Usage: npm run db:migrate --workspace @bubo/database
// Never run against production without an explicit, reviewed release step.
import { Pool } from '@neondatabase/serverless';

import { applyMigrations, loadMigrations } from '../src/node';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Aborting (no changes made).');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });
const client = await pool.connect();
try {
  const applied = await applyMigrations(
    { exec: (sql) => client.query(sql), query: (sql, params) => client.query(sql, params) },
    loadMigrations(),
  );
  console.log(applied.length ? `applied: ${applied.join(', ')}` : 'migrations up to date');
} finally {
  client.release();
  await pool.end();
}
