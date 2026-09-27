import { type Context } from 'hono';
import { type z } from 'zod';

import { AppError } from './errors';

/**
 * Parses and validates a JSON body. Issues report paths and messages only — never the submitted
 * values (they may contain personal data).
 */
export async function parseJsonBody<S extends z.ZodType>(
  c: Context,
  schema: S,
): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new AppError('BAD_REQUEST', 'Request body must be valid JSON.');
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError('VALIDATION_FAILED', 'Some fields are invalid.', {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.') || '(root)',
        message: issue.message,
      })),
    });
  }
  return result.data;
}
