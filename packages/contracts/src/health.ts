import { z } from 'zod';

/** GET /v1/health — liveness. Never touches the database or external services. */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  version: z.string(),
  environment: z.enum(['development', 'preview', 'production']),
  timestamp: z.iso.datetime(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const dependencyCheckSchema = z.object({
  status: z.enum(['ok', 'error', 'not_configured']),
  latencyMs: z.number().nonnegative().optional(),
  message: z.string().optional(),
});
export type DependencyCheck = z.infer<typeof dependencyCheckSchema>;

/** GET /v1/ready — readiness. 200 when ready, 503 otherwise (same body shape). */
export const readyResponseSchema = z.object({
  status: z.enum(['ready', 'not_ready']),
  checks: z.object({
    config: dependencyCheckSchema,
    database: dependencyCheckSchema,
  }),
  timestamp: z.iso.datetime(),
});
export type ReadyResponse = z.infer<typeof readyResponseSchema>;
