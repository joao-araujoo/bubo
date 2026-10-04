import { DELAYED_RECALL_WINDOWS, MEMORY_PERIODS } from '@bubo/domain';
import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const count = z.number().int().nonnegative();
const tally = z.object({ total: count, remembered: count });

export const delayedRecallStatsSchema = z.object({
  version: z.literal('observed-v1'),
  windows: z
    .array(
      z
        .object({ window: z.enum(DELAYED_RECALL_WINDOWS), total: count, remembered: count })
        .refine((row) => row.remembered <= row.total, 'Remembered cannot exceed attempts.'),
    )
    .length(DELAYED_RECALL_WINDOWS.length)
    .refine(
      (rows) => rows.every((row, index) => row.window === DELAYED_RECALL_WINDOWS[index]),
      'Use each delay window once, in chronological order.',
    ),
});
export type DelayedRecallStats = z.infer<typeof delayedRecallStatsSchema>;

/** GET /v1/me/memory query: local today, period in days, UTC offset of the device in minutes. */
export const memoryStatsQuerySchema = z.object({
  today: isoDate,
  days: z.coerce
    .number()
    .int()
    .refine((n) => (MEMORY_PERIODS as readonly number[]).includes(n), 'Use 7, 30, 90 or 365.')
    .default(7),
  tz: z.coerce.number().int().min(-840).max(840).default(0),
});

/**
 * Counts of recorded self-assessments (Lembrei/Quase/Esqueci), never an estimate of retention.
 * `days` has one entry per day of the period, oldest first.
 */
export const memoryStatsResponseSchema = z.object({
  days: z
    .array(
      z.object({
        date: isoDate,
        remembered: count,
        almost: count,
        forgot: count,
      }),
    )
    .min(7)
    .max(365),
  /** Per book in the period, most reviewed first (Stitch "Retenção por obra"). */
  books: z
    .array(
      z.object({
        shelfEntryId: z.string(),
        title: z.string(),
        author: z.string().nullable(),
        coverUrls: z.array(z.string()),
        cards: count,
        total: count,
        remembered: count,
      }),
    )
    .default([]),
  /** Attempts by the reader's local time of day (Stitch "Horário de ouro"). */
  dayParts: z.object({ morning: tally, afternoon: tally, evening: tally, dawn: tally }).default({
    morning: { total: 0, remembered: 0 },
    afternoon: { total: 0, remembered: 0 },
    evening: { total: 0, remembered: 0 },
    dawn: { total: 0, remembered: 0 },
  }),
  /** Recall cards and books with cards right now. */
  cardsTotal: count.default(0),
  booksWithCards: count.default(0),
  /** Self-assessments grouped by elapsed time; no predictions or inferred stability. */
  delayedRecall: delayedRecallStatsSchema.default({
    version: 'observed-v1',
    windows: DELAYED_RECALL_WINDOWS.map((window) => ({ window, total: 0, remembered: 0 })),
  }),
  /** Reading sessions in the period (Stitch "Hábito & foco"). */
  focus: z
    .object({ focusedMinutes: count, readingDays: count })
    .default({ focusedMinutes: 0, readingDays: 0 }),
});
export type MemoryStatsResponse = z.infer<typeof memoryStatsResponseSchema>;
