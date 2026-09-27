import { API_PREFIX, API_SERVICE_NAME, APP_NAME } from '@bubo/config';
import {
  API_ROUTES,
  buildOpenApiDocument,
  type DependencyCheck,
  type HealthResponse,
  type ReadyResponse,
} from '@bubo/contracts';
import { Hono } from 'hono';

import { type AppEnv } from '../env';
import { API_VERSION } from '../version';

export type DatabasePinger = (
  databaseUrl: string,
) => Promise<{ ok: true; latencyMs: number } | { ok: false; latencyMs: number; error: string }>;

export type SystemRouteDeps = { pingDatabase: DatabasePinger; now: () => Date };

export function systemRoutes(deps: SystemRouteDeps) {
  const routes = new Hono<AppEnv>();

  // Liveness: must stay cheap and never touch the database or third parties.
  routes.get(API_ROUTES.health, (c) => {
    const config = c.get('config');
    const body: HealthResponse = {
      status: 'ok',
      service: API_SERVICE_NAME,
      version: API_VERSION,
      environment: config.ok ? config.env.APP_ENV : 'development',
      timestamp: deps.now().toISOString(),
    };
    return c.json(body);
  });

  // Readiness: configuration valid + database reachable.
  routes.get(API_ROUTES.ready, async (c) => {
    const config = c.get('config');
    const configCheck: DependencyCheck = config.ok
      ? { status: 'ok' }
      : {
          status: 'error',
          // Only variable names are reported — never values.
          message: `Invalid configuration: ${config.issues.map((i) => i.path).join(', ')}`,
        };

    let databaseCheck: DependencyCheck;
    const databaseUrl = config.ok ? config.env.DATABASE_URL : undefined;
    if (!databaseUrl) {
      databaseCheck = { status: 'not_configured', message: 'DATABASE_URL is not set.' };
    } else {
      const ping = await deps.pingDatabase(databaseUrl);
      databaseCheck = ping.ok
        ? { status: 'ok', latencyMs: ping.latencyMs }
        : { status: 'error', latencyMs: ping.latencyMs, message: ping.error };
      if (!ping.ok) c.get('logger').warn('database not ready', { latencyMs: ping.latencyMs });
    }

    const ready = configCheck.status === 'ok' && databaseCheck.status === 'ok';
    const body: ReadyResponse = {
      status: ready ? 'ready' : 'not_ready',
      checks: { config: configCheck, database: databaseCheck },
      timestamp: deps.now().toISOString(),
    };
    return c.json(body, ready ? 200 : 503);
  });

  routes.get(API_ROUTES.openapi, (c) =>
    c.json(
      buildOpenApiDocument({
        title: `${APP_NAME} API`,
        version: API_VERSION,
        prefix: API_PREFIX,
        serverUrl: new URL(c.req.url).origin,
      }),
    ),
  );

  return routes;
}
