import { MAX_BOOK_PAGES } from '@bubo/domain';
import { z } from 'zod';

export const createCycleRequestSchema = z.object({
  id: z.uuid(),
  goalPages: z.number().int().min(1).max(MAX_BOOK_PAGES),
  durationDays: z.union([z.literal(7), z.literal(14), z.literal(30), z.literal(60), z.literal(90)]),
});
export type CreateCycleRequest = z.infer<typeof createCycleRequestSchema>;
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
