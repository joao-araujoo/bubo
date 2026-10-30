import { isIsoDate, isReplayTimeZone } from '@bubo/domain';
import { z } from 'zod';

import { bookSchema } from './me';

const calendarDate = z.string().refine(isIsoDate, 'Must be a calendar date.');
const count = z.number().int().nonnegative();
const month = z.number().int().min(1).max(12);

/** Calendar periods are explicit; changing the device timezone also changes the aggregation. */
export const replayQuerySchema = z
  .object({
    kind: z.enum(['month', 'year']),
    year: z.coerce.number().int().min(2020).max(2100),
    month: z.coerce.number().int().min(1).max(12).optional(),
    timeZone: z.string().trim().min(1).max(100).refine(isReplayTimeZone, 'Invalid IANA timezone.'),
  })
  .refine(
    (value) => (value.kind === 'month' ? value.month !== undefined : value.month === undefined),
    {
      path: ['month'],
      message: 'Month is required for monthly Replay and absent for annual Replay.',
    },
  );
export type ReplayQuery = z.infer<typeof replayQuerySchema>;

export const replayBookSchema = z.object({
  shelfEntryId: z.string(),
  book: bookSchema,
  pagesRead: count,
  focusedSeconds: count,
  sessionsCount: count,
  readingDays: count,
  /** First/last accepted session ever recorded, not shelf status declarations. */
  firstReadDate: calendarDate,
  lastReadDate: calendarDate,
  startedInPeriod: z.boolean(),
  finishedInPeriod: z.boolean(),
  /** First session that crossed this book's currently known page count, if any. */
  completionDate: calendarDate.nullable(),
});
export type ReplayBook = z.infer<typeof replayBookSchema>;

const replayMonthSchema = z.object({
  month,
  booksRead: count,
  booksStarted: count,
  booksFinished: count,
  pagesRead: count,
  focusedSeconds: count,
  sessionsCount: count,
  readingDays: count,
});

/** Own private history only; sharing happens separately after preview in the app. */
export const replayResponseSchema = z.object({
  /** Server snapshot time. Cached aggregates must never be presented as today's live totals. */
  generatedAt: z.iso.datetime(),
  period: z.object({
    kind: z.enum(['month', 'year']),
    year: z.number().int(),
    month: month.nullable(),
    startDate: calendarDate,
    endDate: calendarDate,
    timeZone: z.string(),
    inProgress: z.boolean(),
  }),
  coverage: z.object({
    firstSessionDate: calendarDate.nullable(),
    partialHistory: z.boolean(),
    source: z.literal('accepted_reading_sessions'),
  }),
  totals: z.object({
    booksRead: count,
    booksStarted: count,
    booksFinished: count,
    pagesRead: count,
    focusedSeconds: count,
    focusedMinutes: count,
    sessionsCount: count,
    readingDays: count,
    bestStreakDays: count,
  }),
  books: z.array(replayBookSchema),
  topAuthors: z.array(
    z.object({
      author: z.string(),
      booksRead: count,
      pagesRead: count,
      focusedSeconds: count,
      sessionsCount: count,
    }),
  ),
  months: z.array(replayMonthSchema),
  highlights: z.object({
    /** At least two reading sessions. This is not a count of recall reviews. */
    mostReadBookId: z.string().nullable(),
    /** At least five sessions and a unique most frequent starting hour. */
    favoriteHour: z
      .object({ hour: z.number().int().min(0).max(23), sessionsCount: count })
      .nullable(),
    longestSession: z
      .object({ shelfEntryId: z.string(), focusedSeconds: count, localDate: calendarDate })
      .nullable(),
    longestBook: z.object({ shelfEntryId: z.string(), spanDays: count }).nullable(),
    bestMonth: month.nullable(),
  }),
  unavailableDimensions: z.array(z.enum(['genres', 'quotations', 'bridges', 'reflections'])),
});
export type ReplayResponse = z.infer<typeof replayResponseSchema>;
