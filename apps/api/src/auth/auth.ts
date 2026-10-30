import { expo } from '@better-auth/expo';
import { type ServerEnv } from '@bubo/config';
import { API_PREFIX } from '@bubo/config';
import { API_ROUTES } from '@bubo/contracts';
import { type Database, schema } from '@bubo/database';
import { EMAIL_CODE_LENGTH, EMAIL_CODE_TTL_MINUTES, TRUSTED_DEVICE_DAYS } from '@bubo/domain';
import { type User, betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import { emailOTP, twoFactor } from 'better-auth/plugins';
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
 * - e-mailed login code on untrusted devices (two-factor, OTP only) when e-mail can be delivered
 * - password reset by e-mailed code (email-otp); the link flow stays for older app versions.
 *   A successful reset signs the reader in on that device (ADR-040): the code already proved the
 *   e-mail, so asking for a second code right away only confused readers.
 * - rate limits persisted in Postgres (isolates are short-lived)
 * - telemetry disabled: nothing leaves our infrastructure
 */
export function createAuth({ db, config, email, logger }: AuthDeps) {
  if (!config.BETTER_AUTH_SECRET) {
    throw new AppError('SERVICE_UNAVAILABLE', 'Authentication is not configured.');
  }
  const production = config.APP_ENV === 'production';
  // Without a provider nobody could receive a code, so the second step is not enforced (ADR-038).
  const loginCodes = email.canDeliver;
  // The instance lives for one request, so this is the reader whose password this request reset.
  let resetReader: User | null = null;

  const loginCodePlugin = twoFactor({
    issuer: 'Bubo',
    skipVerificationOnEnable: true,
    totpOptions: { disable: true },
    twoFactorCookieMaxAge: EMAIL_CODE_TTL_MINUTES * 60,
    trustDeviceMaxAge: TRUSTED_DEVICE_DAYS * 24 * 60 * 60,
    otpOptions: {
      period: EMAIL_CODE_TTL_MINUTES,
      digits: EMAIL_CODE_LENGTH,
      allowedAttempts: 5,
      storeOTP: 'hashed',
      sendOTP: async ({ user, otp }) => {
        await email.sendLoginCode({ to: user.email, name: user.name, code: otp });
      },
    },
  });

  const resetCodePlugin = emailOTP({
    otpLength: EMAIL_CODE_LENGTH,
    expiresIn: EMAIL_CODE_TTL_MINUTES * 60,
    allowedAttempts: 5,
    storeOTP: 'hashed',
    disableSignUp: true,
    sendVerificationOTP: async ({ email: to, otp, type }) => {
      // Bubo has no passwordless sign-in and keeps the signed link for e-mail verification: only
      // password-reset codes are ever sent. Other types stay stored, hashed and unreachable.
      if (type !== 'forget-password') {
        logger.warn('email otp type not offered', { type });
        return;
      }
      const [user] = await db
        .select({ name: schema.users.name })
        .from(schema.users)
        .where(eq(schema.users.email, to))
        .limit(1);
      await email.sendPasswordResetCode({ to, name: user?.name ?? '', code: otp });
    },
  });

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
        twoFactors: schema.twoFactors,
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
        resetReader = user;
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
    databaseHooks: {
      user: {
        create: {
          // Every new account asks for a code on untrusted devices (the column also defaults to
          // true, which covers accounts created while the plugin was not registered).
          before: async (user) => ({ data: { ...user, twoFactorEnabled: true } }),
        },
      },
    },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        const returned: unknown = ctx.context.returned;
        // Reset by code (or by the old link): every session was revoked; open a fresh one here.
        if (
          (ctx.path === '/email-otp/reset-password' || ctx.path === '/reset-password') &&
          resetReader &&
          returned &&
          typeof returned === 'object' &&
          !(returned instanceof APIError)
        ) {
          const user = resetReader;
          resetReader = null;
          const session = await ctx.context.internalAdapter.createSession(user.id);
          await setSessionCookie(ctx, { session, user });
          return;
        }
        // In-app password change: same security notice as a reset, never blocking the change.
        if (ctx.path !== '/change-password' || !email.canDeliver) return;
        if (
          !returned ||
          typeof returned !== 'object' ||
          returned instanceof APIError ||
          !('user' in returned)
        )
          return;
        const user: unknown = returned.user;
        if (
          !user ||
          typeof user !== 'object' ||
          !('email' in user) ||
          typeof user.email !== 'string'
        )
          return;
        const name = 'name' in user && typeof user.name === 'string' ? user.name : '';
        try {
          await email.sendPasswordChanged({ to: user.email, name, eventId: crypto.randomUUID() });
        } catch {
          logger.warn('security email unavailable after password change');
        }
      }),
    },
    user: {
      // In-app account deletion (App Store / Google Play requirement, LGPD). The password is
      // re-checked by Better Auth; every row owned by the user cascades from "users".
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          // Books the reader typed in manually are personal data too.
          await db.delete(schema.books).where(eq(schema.books.createdByUserId, user.id));
          // The optional recall coach quota also belongs to this account (no retained user id).
          await db
            .delete(schema.rateLimits)
            .where(eq(schema.rateLimits.key, `recall-coach:${user.id}`));
        },
        afterDelete: async (user) => {
          if (!email.canDeliver) return;
          try {
            await email.sendAccountDeleted({
              to: user.email,
              name: user.name,
              eventId: crypto.randomUUID(),
            });
          } catch {
            logger.warn('farewell email unavailable after account deletion');
          }
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
        '/two-factor/send-otp': { window: 60, max: 3 },
        '/two-factor/verify-otp': { window: 60, max: 10 },
        '/email-otp/request-password-reset': { window: 60, max: 3 },
        '/email-otp/reset-password': { window: 60, max: 5 },
        '/change-password': { window: 60, max: 5 },
      },
    },
    trustedOrigins: trustedOriginsFor(config.APP_ENV),
    plugins: loginCodes ? [expo(), resetCodePlugin, loginCodePlugin] : [expo(), resetCodePlugin],
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

/** Whether this instance enforces the e-mailed login code (provider configured). */
export function hasLoginCodes(auth: Auth): boolean {
  return auth.options.plugins.some((plugin) => plugin.id === 'two-factor');
}
