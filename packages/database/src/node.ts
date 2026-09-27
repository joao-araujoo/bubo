// Node-only helpers (filesystem). Never import from the Worker or the mobile app.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MIGRATION_FILE_PATTERN, type Migration } from './migrator';

export const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations', import.meta.url));

/** Reads `NNNN_name.sql` files from the migrations directory, in order. */
export function loadMigrations(dir: string = MIGRATIONS_DIR): Migration[] {
  return fs
    .readdirSync(dir)
    .filter((file) => MIGRATION_FILE_PATTERN.test(file))
    .sort()
    .map((file) => ({ name: file, sql: fs.readFileSync(path.join(dir, file), 'utf8') }));
}

export { applyMigrations, type Migration, type MigrationClient } from './migrator';
