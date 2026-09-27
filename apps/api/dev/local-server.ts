// Local API without any cloud resource: the same Hono app on Node, with PGlite (embedded
// Postgres persisted in apps/api/.local/) instead of Neon and an in-memory R2 bucket.
// Used by `npm run dev:api` when apps/api/.dev.vars has no DATABASE_URL.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { serve } from '@hono/node-server';

import { createApp } from '../src/app';
import { type Bindings } from '../src/env';
import { createLogger } from '../src/lib/logger';
import { createMemoryBucket } from './memory-bucket';
import { PGLITE_DATABASE_URL, createPgliteDatabase } from './pglite';

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const log = createLogger({ service: 'bubo-api-local' });

function readDevVars(): Record<string, string> {
  const file = path.join(apiDir, '.dev.vars');
  if (!fs.existsSync(file)) return {};
  const vars: Record<string, string> = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match?.[1] && match[2] !== undefined && match[2] !== '') {
      vars[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
  return vars;
}

const port = Number(process.env.PORT ?? 8787);
const dataDir = path.join(apiDir, '.local', 'pglite');
fs.mkdirSync(dataDir, { recursive: true });

const database = await createPgliteDatabase(dataDir);
if (database.applied.length > 0) log.info('migrations applied', { applied: database.applied });

const bindings: Bindings = {
  APP_ENV: 'development',
  BETTER_AUTH_URL: `http://localhost:${port}`,
  GEMINI_MODEL: 'gemini-2.5-flash',
  ...readDevVars(),
  // PGlite stands in for Neon locally.
  DATABASE_URL: PGLITE_DATABASE_URL,
  MEDIA: createMemoryBucket(),
};

if (!bindings.BETTER_AUTH_SECRET) {
  log.warn('BETTER_AUTH_SECRET is not set in apps/api/.dev.vars — auth routes will return 503');
}

const app = createApp({ databaseProvider: database.provider, pingDatabase: database.ping });

const server = serve(
  { fetch: (request) => app.fetch(request, bindings), port, hostname: '0.0.0.0' },
  (info) => {
    log.info('local API ready (PGlite)', {
      url: `http://localhost:${info.port}/v1/health`,
      dataDir,
    });
  },
);

async function shutdown() {
  server.close();
  await database.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
