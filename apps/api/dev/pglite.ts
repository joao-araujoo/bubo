import { PGlite } from '@electric-sql/pglite';
import { type Database, type DatabaseHandle, schema } from '@bubo/database';
import { applyMigrations, loadMigrations } from '@bubo/database/node';
import { drizzle } from 'drizzle-orm/pglite';

import { type DatabasePinger } from '../src/routes/system';

/**
 * Embedded Postgres (PGlite, WASM) with every migration applied. Used by tests (in memory) and by
 * the local dev server (persisted on disk) so the full stack runs without any remote database.
 */
export async function createPgliteDatabase(dataDir?: string) {
  const pg = new PGlite(dataDir);
  await pg.waitReady;
  const applied = await applyMigrations(
    { exec: (sql) => pg.exec(sql), query: (sql, params) => pg.query(sql, params) },
    loadMigrations(),
  );
  // drizzle-orm/pglite and drizzle-orm/neon-serverless share the same pg-core query builder;
  // the cast only bridges their driver-specific type parameters.
  const db = drizzle({ client: pg, schema }) as unknown as Database;
  const handle: DatabaseHandle = { db, close: async () => undefined };
  const ping: DatabasePinger = async () => {
    const started = Date.now();
    try {
      await pg.query('select 1');
      return { ok: true, latencyMs: Date.now() - started };
    } catch {
      return { ok: false, latencyMs: Date.now() - started, error: 'Database unreachable (PGlite)' };
    }
  };
  return { pg, db, applied, provider: () => handle, ping, close: () => pg.close() };
}

/** Placeholder URL that satisfies config validation when PGlite stands in for Neon. */
export const PGLITE_DATABASE_URL = 'postgresql://pglite.local/bubo';
