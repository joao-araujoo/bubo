import { isIsoDate } from '@bubo/domain';
import { z } from 'zod';

const localDateSchema = z.string().refine(isIsoDate, 'Must be a calendar date (YYYY-MM-DD).');

/**
 * GET /v1/me/league?today= — the weekly friends league (ADR-029). Participants are the reader and
 * accepted friends who share their activity; XP is the real XP of the reader's Monday→Sunday week
 * (sessions + reviews), counted for friends only from the moment they started sharing.
 */
export const leagueResponseSchema = z.object({
  today: localDateSchema,
  weekStart: localDateSchema,
  weekEnd: localDateSchema,
  /** Days left in the week, today included (Monday 7 … Sunday 1). */
  daysLeft: z.number().int().min(1).max(7),
  /** Whether the reader shares activity, i.e. appears in friends' leagues. */
  sharing: z.boolean(),
  me: z.object({
    rank: z.number().int().positive(),
    /** Rank with XP up to yesterday; null on the first day of the week. */
    previousRank: z.number().int().positive().nullable(),
    weeklyXp: z.number().int().nonnegative(),
  }),
  /** Every participant by rank (ties: earlier name, then id). */
  entries: z.array(
    z.object({
      rank: z.number().int().positive(),
      name: z.string(),
      weeklyXp: z.number().int().nonnegative(),
      me: z.boolean(),
    }),
  ),
});
export type LeagueResponse = z.infer<typeof leagueResponseSchema>;
