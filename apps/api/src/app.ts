import { API_PREFIX, AUTH_CLIENT_HEADER, AUTH_CLIENT_LOGIN_CODE } from '@bubo/config';
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
import { emailRoutes } from './routes/email';
import { notificationRoutes } from './routes/notifications';
import { readerRoutes } from './routes/me';
import { recallRoutes } from './routes/recall';
import { replayRoutes } from './routes/replay';
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
  const catalogCache =
    deps.catalogCache ?? createLayeredCache(createMemoryCache(), findEdgeCache());
  const catalog = createCatalogProvider({
    fetch: deps.catalogFetch ?? ((input, init) => fetch(input, init)),
    cache: catalogCache,
  });

  app.use('*', requestContext({ sink: deps.logSink }));
  // E-mail pictures are embedded by mail clients and webmails on other origins (ADR-041).
  const emailArtPath = `${API_PREFIX}${API_ROUTES.emailArt.replace(':file', '')}`;
  const pageHeaders = secureHeaders();
  const emailArtHeaders = secureHeaders({ crossOriginResourcePolicy: 'cross-origin' });
  app.use('*', (c, next) =>
    c.req.path.startsWith(emailArtPath) ? emailArtHeaders(c, next) : pageHeaders(c, next),
  );
  // Native apps do not need CORS; allow browsers (Expo web, tooling) only in development.
  app.use('*', async (c, next) => {
    const config = c.get('config');
    if (config.ok && config.env.APP_ENV === 'development') {
      return cors({ origin: '*', exposeHeaders: [REQUEST_ID_HEADER] })(c, next);
    }
    return next();
  });

  app.route(API_PREFIX, systemRoutes({ pingDatabase: deps.pingDatabase ?? pingDatabase, now }));

  // Better Auth: sign-up, sign-in, sign-out, session, password reset, login codes.
  const authPath = `${API_PREFIX}${API_ROUTES.auth}/*`;
  // Better Auth sends e-mails in a background task and always answers 200, so without a provider
  // the reader would wait for a message that never comes. Refuse up front instead (the same 503
  // for every address, so it reveals nothing about which accounts exist).
  for (const action of [
    'request-password-reset',
    'send-verification-email',
    'email-otp/request-password-reset',
    'email-otp/send-verification-otp',
    'two-factor/send-otp',
  ]) {
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
  // App builds from before login codes ignore the code challenge and wait for a session that never
  // comes (ADR-040). Tell them to update instead of failing silently; current builds send the
  // header and get the challenge as usual.
  app.use(`${API_PREFIX}${API_ROUTES.auth}/sign-in/email`, async (c, next) => {
    await next();
    if (c.req.header(AUTH_CLIENT_HEADER)?.includes(AUTH_CLIENT_LOGIN_CODE)) return;
    if (c.res.status !== 200) return;
    const body: unknown = await c.res
      .clone()
      .json()
      .catch(() => null);
    if (!body || typeof body !== 'object' || !('twoFactorRedirect' in body)) return;
    c.res = new Response(
      JSON.stringify({
        code: 'APP_UPDATE_REQUIRED',
        message: 'Update the app to sign in with the e-mailed code.',
      }),
      { status: 426, headers: { 'content-type': 'application/json' } },
    );
    // Hono carries the original headers over; the half-started challenge cookie stays behind.
    c.res.headers.delete('set-cookie');
  });
  app.on(['GET', 'POST'], authPath, (c) => c.get('auth').handler(c.req.raw));

  // Public one-click opt-out from optional e-mails (signed token, no session; ADR-038) and the
  // pictures shown inside e-mails (static, no database; ADR-041).
  app.use(`${API_PREFIX}${API_ROUTES.emailUnsubscribe}`, database);
  app.route(API_PREFIX, emailRoutes({ now }));

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
  app.route(API_PREFIX, catalogRoutes({ catalog, cache: catalogCache, now }));
  app.route(API_PREFIX, recallRoutes({ now }));
  app.route(API_PREFIX, replayRoutes({ now }));
  app.route(
    API_PREFIX,
    communityRoutes({ now, pushFetch: deps.pushFetch ?? ((input, init) => fetch(input, init)) }),
  );
  app.route(API_PREFIX, notificationRoutes({ now }));

  app.notFound(handleNotFound);
  app.onError(handleError);
  return app;
}
