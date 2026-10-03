import { API_PREFIX } from '@bubo/config';
import { API_ROUTES } from '@bubo/contracts';
import { createDatabase, pingDatabase } from '@bubo/database';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';

import { authRedirectGuard } from './auth/redirect-guard';
import { type AppEnv } from './env';
import { AppError, handleError, handleNotFound } from './lib/errors';
import { type LogSink } from './lib/logger';
import { REQUEST_ID_HEADER, requestContext } from './middleware/request-context';
import {
  type DatabaseProvider,
  type EmailSenderFactory,
  requireSession,
  withAuth,
  withDatabase,
} from './middleware/session';
import { catalogRoutes, createCatalogProvider } from './routes/catalog';
import { communityRoutes } from './routes/community';
import { notificationRoutes } from './routes/notifications';
import { readerRoutes } from './routes/me';
import { recallRoutes } from './routes/recall';
import { shelfRoutes } from './routes/shelf';
import { type DatabasePinger, systemRoutes } from './routes/system';
import { type FetchLike } from './services/catalog';
import {
  type CatalogCache,
  createLayeredCache,
  createMemoryCache,
  findEdgeCache,
} from './services/catalog-cache';

export type AppDeps = {
  pingDatabase?: DatabasePinger;
  /** Request-scoped database handle (default: Neon Pool). Tests/local dev inject PGlite. */
  databaseProvider?: DatabaseProvider;
  emailSender?: EmailSenderFactory;
  now?: () => Date;
  logSink?: LogSink;
  /** Catalog upstream fetch + cache (tests inject a mock fetch; default: global fetch). */
  catalogFetch?: FetchLike;
  catalogCache?: CatalogCache;
  /** Expo push delivery (tests inject a mock; default: global fetch). */
  pushFetch?: FetchLike;
  /** Optional recall coach (tests inject a mock; mobile never reaches Gemini). */
  geminiFetch?: typeof fetch;
};

/** Builds the Hono app. Dependencies are injectable so tests never hit the network. */
export function createApp(deps: AppDeps = {}) {
  const app = new Hono<AppEnv>();
  const now = deps.now ?? (() => new Date());
  const database = withDatabase(deps.databaseProvider ?? createDatabase);
  const auth = withAuth(deps.emailSender);
  const catalog = createCatalogProvider({
    fetch: deps.catalogFetch ?? ((input, init) => fetch(input, init)),
    cache: deps.catalogCache ?? createLayeredCache(createMemoryCache(), findEdgeCache()),
  });

  app.use('*', requestContext({ sink: deps.logSink }));
  app.use('*', secureHeaders());
  // Native apps do not need CORS; allow browsers (Expo web, tooling) only in development.
  app.use('*', async (c, next) => {
    const config = c.get('config');
    if (config.ok && config.env.APP_ENV === 'development') {
      return cors({ origin: '*', exposeHeaders: [REQUEST_ID_HEADER] })(c, next);
    }
    return next();
  });

  app.route(API_PREFIX, systemRoutes({ pingDatabase: deps.pingDatabase ?? pingDatabase, now }));

  // Better Auth: sign-up, sign-in, sign-out, session, password reset.
  const authPath = `${API_PREFIX}${API_ROUTES.auth}/*`;
  // Better Auth sends the reset e-mail in a background task and always answers 200, so without a
  // provider the reader would wait for a message that never comes. Refuse up front instead (the
  // same 503 for every address, so it reveals nothing about which accounts exist).
  for (const action of ['request-password-reset', 'send-verification-email']) {
    app.post(`${API_PREFIX}${API_ROUTES.auth}/${action}`, async (c, next) => {
      const config = c.get('config');
      const emailReady =
        deps.emailSender !== undefined ||
        (config.ok &&
          (config.env.APP_ENV === 'development' ||
            Boolean(config.env.RESEND_API_KEY && config.env.EMAIL_FROM)));
      if (!emailReady) {
        throw new AppError('SERVICE_UNAVAILABLE', 'E-mail delivery is not available yet.');
      }
      await next();
    });
  }
  app.use(authPath, authRedirectGuard, database, auth);
  app.on(['GET', 'POST'], authPath, (c) => c.get('auth').handler(c.req.raw));

  // Session-protected reader routes.
  for (const path of [
    API_ROUTES.me,
    `${API_ROUTES.me}/*`,
    API_ROUTES.shelf,
    `${API_ROUTES.shelf}/*`,
    API_ROUTES.sessions,
    `${API_ROUTES.sessions}/*`,
    '/recall/*',
    '/catalog/*',
    API_ROUTES.clubs,
    `${API_ROUTES.clubs}/*`,
    API_ROUTES.reports,
    API_ROUTES.blocks,
    `${API_ROUTES.blocks}/*`,
    API_ROUTES.reactions,
    '/community/*',
    API_ROUTES.notifications,
    `${API_ROUTES.notifications}/*`,
  ]) {
    app.use(`${API_PREFIX}${path}`, database, auth, requireSession);
  }
  app.route(API_PREFIX, readerRoutes({ catalog }));
  app.route(
    API_PREFIX,
    shelfRoutes({
      now,
      catalog,
      geminiFetch: deps.geminiFetch ?? ((input, init) => fetch(input, init)),
    }),
  );
  app.route(API_PREFIX, catalogRoutes({ catalog, now }));
  app.route(API_PREFIX, recallRoutes({ now }));
  app.route(
    API_PREFIX,
    communityRoutes({ now, pushFetch: deps.pushFetch ?? ((input, init) => fetch(input, init)) }),
  );
  app.route(API_PREFIX, notificationRoutes({ now }));

  app.notFound(handleNotFound);
  app.onError(handleError);
  return app;
}
