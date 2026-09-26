import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createAuth } from './auth/create-auth';
import { database } from './db';
import {
  hasResetEmailTransport,
  type AppBindings,
} from './env';
import type { AppContext } from './middleware/auth-session';
import { openApiDocument } from './openapi';
import { meRoutes } from './routes/me';
import { onboardingRoutes } from './routes/onboarding';

export function createApp() {
  const app = new Hono<AppContext>();

  app.use('/api/auth/*', cors());
  app.use('/v1/*', cors());

  app.get('/health', (c) =>
    c.json({
      status: 'ok',
      service: 'bubo-api',
      environment: c.env.APP_ENV ?? 'unknown',
    }),
  );

  app.get('/ready', async (c) => {
    const missing = [
      !c.env.DATABASE_URL ? 'DATABASE_URL' : null,
      !c.env.BETTER_AUTH_SECRET ? 'BETTER_AUTH_SECRET' : null,
      !c.env.BETTER_AUTH_URL ? 'BETTER_AUTH_URL' : null,
      !hasResetEmailTransport(c.env) ? 'password-reset email transport' : null,
    ].filter(Boolean);

    if (missing.length) {
      return c.json(
        {
          status: 'not_ready',
          missing,
        },
        503,
      );
    }

    try {
      const sql = database(c.env.DATABASE_URL as string);
      await sql`select 1 as ok`;
      return c.json({ status: 'ready', database: 'connected' });
    } catch {
      return c.json(
        { status: 'not_ready', database: 'unavailable' },
        503,
      );
    }
  });

  app.get('/openapi.json', (c) => c.json(openApiDocument));

  app.get('/v1', (c) =>
    c.json({
      name: 'Bubo API',
      version: '4.0.0-alpha.0',
      message: 'Read deeply.',
    }),
  );

  app.on(['GET', 'POST'], '/api/auth/*', async (c) => {
    try {
      const auth = createAuth(
        c.env,
        (promise) => c.executionCtx.waitUntil(promise),
      );
      return auth.handler(c.req.raw);
    } catch (error) {
      console.error('[Bubo auth] handler unavailable', error);
      return c.json(
        {
          code: 'AUTH_UNAVAILABLE',
          message: 'A autenticação do Bubo está temporariamente indisponível.',
        },
        503,
      );
    }
  });

  app.route('/v1/me', meRoutes);
  app.route('/v1/onboarding', onboardingRoutes);

  app.notFound((c) =>
    c.json({ code: 'NOT_FOUND', message: 'Rota não encontrada.' }, 404),
  );

  return app;
}
