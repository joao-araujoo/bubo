import { parseServerEnv } from '@bubo/config';
import { createMiddleware } from 'hono/factory';

import { type AppEnv } from '../env';
import { type LogSink, createLogger } from '../lib/logger';

export const REQUEST_ID_HEADER = 'X-Request-Id';
const VALID_INCOMING_ID = /^[A-Za-z0-9._:-]{8,128}$/;

/**
 * Per-request context: correlation id (reuses a well-formed incoming X-Request-Id), structured
 * logger, validated config and an access log line with duration.
 */
export function requestContext(options: { sink?: LogSink; now?: () => number } = {}) {
  const now = options.now ?? Date.now;
  return createMiddleware<AppEnv>(async (c, next) => {
    const incoming = c.req.header(REQUEST_ID_HEADER);
    const requestId = incoming && VALID_INCOMING_ID.test(incoming) ? incoming : crypto.randomUUID();
    const config = parseServerEnv({ ...c.env, MEDIA: undefined });
    const appEnv = config.ok ? config.env.APP_ENV : 'development';
    const logger = createLogger({ requestId, env: appEnv }, options.sink);

    c.set('requestId', requestId);
    c.set('logger', logger);
    c.set('config', config);
    c.header(REQUEST_ID_HEADER, requestId);

    const started = now();
    await next();
    c.header(REQUEST_ID_HEADER, requestId);
    logger.info('request', {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: now() - started,
    });
  });
}
