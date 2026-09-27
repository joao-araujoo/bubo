// Node-only helpers (filesystem). Never import from the Worker or the mobile app.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

import { MIGRATION_FILE_PATTERN, type Migration } from './migrator';

export const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations', import.meta.url));

/** Same gitignored API configuration used by dev:api. Never return secrets in diagnostics. */
export function loadDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
  devVarsFile = fileURLToPath(new URL('../../../apps/api/.dev.vars', import.meta.url)),
): string | undefined {
  if (env.DATABASE_URL?.trim()) return env.DATABASE_URL.trim();
  if (!fs.existsSync(devVarsFile)) return undefined;
  return parseEnv(fs.readFileSync(devVarsFile, 'utf8')).DATABASE_URL?.trim() || undefined;
}

/** Migrations use the same Neon endpoint/database with a direct connection, only in memory. */
export function migrationDatabaseUrl(raw: string): string {
  const url = new URL(raw);
  if (url.hostname.endsWith('.neon.tech')) url.hostname = url.hostname.replace('-pooler.', '.');
  return url.toString();
}

/** Reads `NNNN_name.sql` files from the migrations directory, in order. */
export function loadMigrations(dir: string = MIGRATIONS_DIR): Migration[] {
  return fs
    .readdirSync(dir)
    .filter((file) => MIGRATION_FILE_PATTERN.test(file))
    .sort()
    .map((file) => ({ name: file, sql: fs.readFileSync(path.join(dir, file), 'utf8') }));
}

export { applyMigrations, type Migration, type MigrationClient } from './migrator';
