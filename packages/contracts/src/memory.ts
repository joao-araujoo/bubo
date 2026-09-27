import { z } from 'zod';

/** Counts of recorded self-assessments, not an estimate of retention. */
export const memoryStatsResponseSchema = z.object({
  days: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        remembered: z.number().int().nonnegative(),
        almost: z.number().int().nonnegative(),
        forgot: z.number().int().nonnegative(),
      }),
    )
    .length(7),
});
export type MemoryStatsResponse = z.infer<typeof memoryStatsResponseSchema>;
