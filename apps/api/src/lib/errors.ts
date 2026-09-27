import { ERROR_STATUS, type ErrorCode, type ErrorIssue, type ErrorResponse } from '@bubo/contracts';
import { type Context } from 'hono';
import { type ContentfulStatusCode } from 'hono/utils/http-status';

import { type AppEnv } from '../env';

/** Expected, client-facing failure. Anything else thrown is treated as INTERNAL_ERROR. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: ContentfulStatusCode;
  readonly issues: ErrorIssue[] | undefined;

  constructor(
    code: ErrorCode,
    message: string,
    options: { status?: ContentfulStatusCode; issues?: ErrorIssue[]; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = options.status ?? (ERROR_STATUS[code] as ContentfulStatusCode);
    this.issues = options.issues;
  }
}

export function errorBody(
  code: ErrorCode,
  message: string,
  requestId: string,
  issues?: ErrorIssue[],
): ErrorResponse {
  return { error: { code, message, requestId, ...(issues ? { issues } : {}) } };
}

/** Global error handler: stable envelope, no stack traces or internals leaked to clients. */
export function handleError(error: Error, c: Context<AppEnv>) {
  const requestId = c.get('requestId') ?? 'unknown';
  if (error instanceof AppError) {
    if (error.status >= 500) c.get('logger')?.error('request failed', { code: error.code });
    return c.json(errorBody(error.code, error.message, requestId, error.issues), error.status);
  }
  c.get('logger')?.error('unhandled error', { errorName: error.name, errorMessage: error.message });
  return c.json(errorBody('INTERNAL_ERROR', 'Something went wrong.', requestId), 500);
}

export function handleNotFound(c: Context<AppEnv>) {
  return c.json(
    errorBody(
      'NOT_FOUND',
      `Route ${c.req.method} ${c.req.path} not found.`,
      c.get('requestId') ?? 'unknown',
    ),
    404,
  );
}
