import { Pool, neon } from '@neondatabase/serverless';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';

import * as schema from './schema';

export type Schema = typeof schema;
export type Database = NeonDatabase<Schema>;
/** The `tx` handle inside `db.transaction(async (tx) => …)`. */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
/** Anything that can run queries: the database or an open transaction. */
export type Executor = Database | Transaction;

export type DatabaseHandle = {
  db: Database;
  /** Releases the connection. In a Worker call it via `ctx.waitUntil(close())`. */
  close: () => Promise<void>;
};

/**
 * Drizzle over Neon's WebSocket Pool (supports interactive transactions). Create one per request
 * inside a Worker — never share a Pool across requests — and close it when the response is done.
 */
export function createDatabase(databaseUrl: string): DatabaseHandle {
  const pool = new Pool({ connectionString: databaseUrl });
  return { db: drizzle({ client: pool, schema }), close: () => pool.end() };
}

export type DatabasePing =
  { ok: true; latencyMs: number } | { ok: false; latencyMs: number; error: string };

/** Lightweight connectivity check (HTTP driver) used by GET /v1/ready. Never leaks the URL. */
export async function pingDatabase(
  databaseUrl: string,
  now: () => number = Date.now,
): Promise<DatabasePing> {
  const started = now();
  try {
    const sql = neon(databaseUrl);
    await sql`select 1`;
    return { ok: true, latencyMs: now() - started };
  } catch (error) {
    const message = error instanceof Error ? error.name : 'UnknownError';
    return { ok: false, latencyMs: now() - started, error: `Database unreachable (${message})` };
  }
}
