import type { AppBindings } from '../env';

export function buildTrustedOrigins(env: AppBindings) {
  const origins = ['bubo://'];

  if (env.APP_ENV !== 'production') {
    origins.push('exp://', 'exp://**', 'exp://192.168.*.*:*/**');
  }

  if (env.BETTER_AUTH_URL) {
    try {
      origins.push(new URL(env.BETTER_AUTH_URL).origin);
    } catch {
      // requireAuthRuntimeEnv surfaces an invalid deployment configuration later.
    }
  }

  return [...new Set(origins)];
}
