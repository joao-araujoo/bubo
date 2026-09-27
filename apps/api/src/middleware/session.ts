import { type ServerEnv } from '@bubo/config';
import { type DatabaseHandle } from '@bubo/database';
import { type Context } from 'hono';
import { createMiddleware } from 'hono/factory';

import { createAuth } from '../auth/auth';
import { type AppEnv } from '../env';
import { AppError } from '../lib/errors';
import { createEmailSender, type EmailSender } from '../services/email';

export type DatabaseProvider = (databaseUrl: string) => DatabaseHandle;
export type EmailSenderFactory = (c: Context<AppEnv>, config: ServerEnv) => EmailSender;

function requireConfig(c: Context<AppEnv>): ServerEnv {
  const config = c.get('config');
  if (!config.ok) {
    throw new AppError('SERVICE_UNAVAILABLE', 'Service configuration is invalid.');
  }
  return config.env;
}

/** Runs cleanup after the response: `waitUntil` on Workers, awaited elsewhere (Node, tests). */
async function afterResponse(c: Context<AppEnv>, task: Promise<void>) {
  let waitUntil: ((promise: Promise<unknown>) => void) | undefined;
  try {
    // Hono throws when there is no execution context (Node server, tests).
    const executionCtx = c.executionCtx;
    waitUntil = (promise) => executionCtx.waitUntil(promise);
  } catch {
    waitUntil = undefined;
  }
  const safeTask = task.catch(() => undefined);
  if (waitUntil) waitUntil(safeTask);
  else await safeTask;
}

/** Opens a request-scoped database handle (closed after the response). */
export function withDatabase(provider: DatabaseProvider) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const config = requireConfig(c);
    if (!config.DATABASE_URL) {
      throw new AppError('SERVICE_UNAVAILABLE', 'The database is not configured.');
    }
    const handle = provider(config.DATABASE_URL);
    c.set('db', handle.db);
    try {
      await next();
    } finally {
      await afterResponse(c, handle.close());
    }
  });
}

/** Builds the request-scoped Better Auth instance. Requires `withDatabase` first. */
export function withAuth(emailFactory?: EmailSenderFactory) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const config = requireConfig(c);
    const email = emailFactory
      ? emailFactory(c, config)
      : createEmailSender({ config, logger: c.get('logger') });
    c.set('auth', createAuth({ db: c.get('db'), config, email }));
    await next();
  });
}

/** Rejects requests without a valid session (401) and exposes it as `c.var.session`. */
export const requireSession = createMiddleware<AppEnv>(async (c, next) => {
  const session = await c.get('auth').api.getSession({ headers: c.req.raw.headers });
  if (!session) throw new AppError('UNAUTHORIZED', 'Sign in to continue.');
  c.set('session', session);
  await next();
});
