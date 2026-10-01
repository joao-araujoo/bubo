import { CYCLE_DURATIONS_DAYS, MAX_BOOK_PAGES } from '@bubo/domain';
import { z } from 'zod';

/** POST /v1/clubs/:id/cycles — owner only, idempotent on the client id. */
export const createCycleRequestSchema = z.object({
  id: z.uuid(),
  goalPages: z.number().int().min(1).max(MAX_BOOK_PAGES),
  durationDays: z.union(CYCLE_DURATIONS_DAYS.map((days) => z.literal(days))),
});
export type CreateCycleRequest = z.infer<typeof createCycleRequestSchema>;
/** GET /v1/clubs/:id/cycles — newest first, at most 50, progress derived from sessions. */
export const clubCyclesResponseSchema = z.object({
  cycles: z.array(
    z.object({
      id: z.string(),
      goalPages: z.number().int().positive(),
      startedAt: z.iso.datetime(),
      endsAt: z.iso.datetime(),
      closedAt: z.iso.datetime().nullable(),
      active: z.boolean(),
      participantCount: z.number().int().nonnegative(),
      participantsAtGoal: z.number().int().nonnegative(),
      totalPagesRead: z.number().int().nonnegative(),
      myPagesRead: z.number().int().nonnegative(),
      participating: z.boolean(),
    }),
  ),
});
export type ClubCyclesResponse = z.infer<typeof clubCyclesResponseSchema>;
