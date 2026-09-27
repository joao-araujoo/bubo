import { type ServerEnv } from '@bubo/config';
import { createMiddleware } from 'hono/factory';

import { type AppEnv } from '../env';
import { AppError } from '../lib/errors';

/** Fields Better Auth uses to redirect the user (query string or JSON body). */
const REDIRECT_FIELDS = [
  'callbackURL',
  'redirectTo',
  'newUserCallbackURL',
  'errorCallbackURL',
] as const;

/**
 * Only app deep links (bubo://, plus exp:// for Expo Go in development) and same-origin relative
 * paths may receive auth redirects — this is what carries password-reset tokens.
 * Native requests have no Origin header, so we cannot rely on Better Auth's origin check alone.
 */
export function isAllowedRedirect(value: string, appEnv: ServerEnv['APP_ENV']): boolean {
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return true;
  if (value.startsWith('bubo://')) return true;
  return appEnv === 'development' && value.startsWith('exp://');
}

async function readJsonFields(request: Request): Promise<Record<string, unknown>> {
  if (request.method !== 'POST') return {};
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) return {};
  try {
    const body: unknown = await request.clone().json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const authRedirectGuard = createMiddleware<AppEnv>(async (c, next) => {
  const config = c.get('config');
  const appEnv = config.ok ? config.env.APP_ENV : 'production';
  const body = await readJsonFields(c.req.raw);
  for (const field of REDIRECT_FIELDS) {
    const candidates = [c.req.query(field), body[field]];
    for (const candidate of candidates) {
      if (candidate === undefined || candidate === null || candidate === '') continue;
      if (typeof candidate !== 'string' || !isAllowedRedirect(candidate, appEnv)) {
        c.get('logger').warn('blocked auth redirect', { field, path: c.req.path });
        throw new AppError('FORBIDDEN', 'Redirect target is not allowed.');
      }
    }
  }
  await next();
});
