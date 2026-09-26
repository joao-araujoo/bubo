export type AppBindings = {
  APP_ENV?: string;
  DATABASE_URL?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  RESEND_API_KEY?: string;
  AUTH_EMAIL_FROM?: string;
  AUTH_DEV_LOG_RESET_URLS?: string;
  MEDIA?: R2Bucket;
};

export type AuthRuntimeEnv = AppBindings & {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
};

export function requireAuthRuntimeEnv(env: AppBindings): AuthRuntimeEnv {
  const missing = [
    !env.DATABASE_URL ? 'DATABASE_URL' : null,
    !env.BETTER_AUTH_SECRET ? 'BETTER_AUTH_SECRET' : null,
    !env.BETTER_AUTH_URL ? 'BETTER_AUTH_URL' : null,
  ].filter(Boolean);

  if (missing.length) {
    throw new Error(`Missing auth environment: ${missing.join(', ')}`);
  }

  return env as AuthRuntimeEnv;
}

export function hasResetEmailTransport(env: AppBindings) {
  const resendConfigured = Boolean(env.RESEND_API_KEY && env.AUTH_EMAIL_FROM);
  const developmentLogger =
    env.APP_ENV !== 'production' && env.AUTH_DEV_LOG_RESET_URLS === 'true';

  return resendConfigured || developmentLogger;
}
