import { expo } from '@better-auth/expo';
import { type ServerEnv } from '@bubo/config';
import { API_PREFIX } from '@bubo/config';
import { API_ROUTES } from '@bubo/contracts';
import { type Database, schema } from '@bubo/database';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { eq } from 'drizzle-orm';

import { AppError } from '../lib/errors';
import { type Logger } from '../lib/logger';
import { type EmailSender } from '../services/email';
import { AUTH_EMAIL_LINK_TTL_SECONDS } from '../services/email-templates';

export const AUTH_BASE_PATH = `${API_PREFIX}${API_ROUTES.auth}`;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

/** Deep-link origins allowed as redirect targets. `exp://` only exists in Expo Go (development). */
export function trustedOriginsFor(appEnv: ServerEnv['APP_ENV']): string[] {
  const origins = ['bubo://', 'bubo://*'];
  return appEnv === 'development' ? [...origins, 'exp://', 'exp://**'] : origins;
}

export type AuthDeps = { db: Database; config: ServerEnv; email: EmailSender; logger: Logger };

/**
 * Better Auth instance for one request (the DB handle is request-scoped on Workers).
 * - e-mail + password, auto sign-in after sign-up, 30-day sessions
 * - Expo plugin (native cookie handling via SecureStore on the client)
 * - rate limits persisted in Postgres (isolates are short-lived)
 * - telemetry disabled: nothing leaves our infrastructure
 */
export function createAuth({ db, config, email, logger }: AuthDeps) {
  if (!config.BETTER_AUTH_SECRET) {
    throw new AppError('SERVICE_UNAVAILABLE', 'Authentication is not configured.');
  }
  const production = config.APP_ENV === 'production';

  return betterAuth({
    appName: 'Bubo',
    baseURL: config.BETTER_AUTH_URL ?? 'http://localhost:8787',
    basePath: AUTH_BASE_PATH,
    secret: config.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: 'pg',
      usePlural: true,
      schema: {
        users: schema.users,
        sessions: schema.sessions,
        accounts: schema.accounts,
        verifications: schema.verifications,
        rateLimits: schema.rateLimits,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      autoSignIn: true,
      requireEmailVerification: false,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: AUTH_EMAIL_LINK_TTL_SECONDS,
      sendResetPassword: async ({ user, url }) => {
        await email.sendPasswordReset({ to: user.email, name: user.name, url });
      },
      onPasswordReset: async ({ user }) => {
        if (!email.canDeliver) return;
        // Better Auth invokes this before revoking sessions. Delivery must never interrupt revocation.
        try {
          await email.sendPasswordChanged({
            to: user.email,
            name: user.name,
            eventId: crypto.randomUUID(),
          });
        } catch {
          logger.warn('security email unavailable after password reset', { userId: user.id });
        }
      },
    },
    emailVerification: {
      sendOnSignUp: email.canDeliver,
      sendOnSignIn: false,
      expiresIn: AUTH_EMAIL_LINK_TTL_SECONDS,
      sendVerificationEmail: async ({ user, url }, request) => {
        const link = new URL(url);
        // Default native callback; preserve explicit trusted callbacks already validated by the guard.
        if (link.searchParams.get('callbackURL') === '/')
          link.searchParams.set('callbackURL', 'bubo:///');
        try {
          await email.sendVerification({ to: user.email, name: user.name, url: link.href });
        } catch (error) {
          if (!request || !new URL(request.url).pathname.endsWith('/sign-up/email')) throw error;
          logger.warn('signup verification email unavailable', { userId: user.id });
        }
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    user: {
      // In-app account deletion (App Store / Google Play requirement, LGPD). The password is
      // re-checked by Better Auth; every row owned by the user cascades from "users".
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          // Books the reader typed in manually are personal data too.
          await db.delete(schema.books).where(eq(schema.books.createdByUserId, user.id));
        },
      },
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 5 },
        '/request-password-reset': { window: 60, max: 3 },
        '/send-verification-email': { window: 60, max: 3 },
      },
    },
    trustedOrigins: trustedOriginsFor(config.APP_ENV),
    plugins: [expo()],
    telemetry: { enabled: false },
    advanced: {
      // Always enforce the Origin/CSRF check (Better Auth skips it when NODE_ENV=test otherwise,
      // which would make our tests less strict than production).
      disableOriginCheck: false,
      useSecureCookies: production,
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'] },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthSession = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>;
