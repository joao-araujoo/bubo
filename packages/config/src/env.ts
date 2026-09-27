import { z } from 'zod';

import { APP_ENVS, DEFAULT_GEMINI_MODEL } from './app';

/** Treats empty strings (common in .env templates) as "not set". */
const optionalString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().optional(),
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.url().optional(),
);

const postgresUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z
    .string()
    .regex(/^postgres(ql)?:\/\//, 'DATABASE_URL must be a postgres:// or postgresql:// URL')
    .optional(),
);

/**
 * Server (Cloudflare Worker) environment. Values that are secrets are optional in development so
 * the API boots without them; production requires them (see refinement below).
 */
export const serverEnvSchema = z
  .object({
    APP_ENV: z.enum(APP_ENVS).default('development'),
    DATABASE_URL: postgresUrl,
    BETTER_AUTH_SECRET: optionalString.pipe(
      z.string().min(32, 'BETTER_AUTH_SECRET must have at least 32 characters').optional(),
    ),
    BETTER_AUTH_URL: optionalUrl,
    GEMINI_API_KEY: optionalString,
    GEMINI_MODEL: optionalString.transform((value) => value ?? DEFAULT_GEMINI_MODEL),
    /** Transactional e-mail (password reset) via Resend. */
    RESEND_API_KEY: optionalString,
    /** Sender, e.g. "Bubo <nao-responda@seu-dominio.com>" (domain verified in Resend). */
    EMAIL_FROM: optionalString,
    /** Optional Google Books API key (raises the shared per-IP quota). Open Library needs none. */
    GOOGLE_BOOKS_API_KEY: optionalString,
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV !== 'production') return;
    for (const key of [
      'DATABASE_URL',
      'BETTER_AUTH_SECRET',
      'BETTER_AUTH_URL',
      'RESEND_API_KEY',
      'EMAIL_FROM',
    ] as const) {
      if (!env[key]) {
        ctx.addIssue({ code: 'custom', path: [key], message: `${key} is required in production` });
      }
    }
    if (env.BETTER_AUTH_URL && !env.BETTER_AUTH_URL.startsWith('https://')) {
      ctx.addIssue({
        code: 'custom',
        path: ['BETTER_AUTH_URL'],
        message: 'BETTER_AUTH_URL must use https:// in production',
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Public mobile configuration. Everything here is embedded in the app bundle, so it must never
 * contain secrets.
 */
export const publicEnvSchema = z.object({
  EXPO_PUBLIC_API_URL: z.url().default('http://localhost:8787'),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export type EnvIssue = { path: string; message: string };

export type EnvParseResult<T> = { ok: true; env: T } | { ok: false; issues: EnvIssue[] };

function toIssues(error: z.ZodError): EnvIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.') || '(root)',
    message: issue.message,
  }));
}

/** Validates server bindings. Never includes secret values in the returned issues. */
export function parseServerEnv(input: Record<string, unknown>): EnvParseResult<ServerEnv> {
  const result = serverEnvSchema.safeParse(input);
  return result.success
    ? { ok: true, env: result.data }
    : { ok: false, issues: toIssues(result.error) };
}

export function parsePublicEnv(input: Record<string, unknown>): EnvParseResult<PublicEnv> {
  const result = publicEnvSchema.safeParse(input);
  return result.success
    ? { ok: true, env: result.data }
    : { ok: false, issues: toIssues(result.error) };
}
