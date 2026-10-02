import {
  MAX_BOOK_PAGES,
  MAX_REFLECTION_LENGTH,
  MAX_SESSION_SECONDS,
  MIN_SESSION_SECONDS,
  isIsoDate,
} from '@bubo/domain';
import { z } from 'zod';

import { catalogIdSchema } from './catalog';
import { newBookSchema, readingStatusSchema, shelfEntrySchema } from './me';
import { recallCardSchema } from './recall';

const localDateSchema = z.string().refine(isIsoDate, 'Must be a calendar date (YYYY-MM-DD).');
const pageSchema = z.number().int().min(0).max(MAX_BOOK_PAGES);

const addStatusSchema = z.enum(['reading', 'want_to_read']).default('want_to_read');

/** POST /v1/shelf — a catalog pick (the server resolves the metadata, never the client). */
export const addCatalogBookRequestSchema = z.object({
  catalogId: catalogIdSchema,
  status: addStatusSchema,
});

/** POST /v1/shelf — a book typed in manually. */
export const addManualBookRequestSchema = newBookSchema.extend({ status: addStatusSchema });

/** POST /v1/shelf — either a catalog pick (`catalogId`) or a manual entry (`title`, …). */
export const addBookRequestSchema = z.union([
  addCatalogBookRequestSchema,
  addManualBookRequestSchema,
]);
export type AddBookRequest = z.input<typeof addBookRequestSchema>;
export type AddBookInput = z.output<typeof addBookRequestSchema>;

/** PATCH /v1/shelf/:id — change status, current page and/or page count. */
export const updateShelfEntryRequestSchema = z
  .object({
    status: readingStatusSchema.optional(),
    currentPage: pageSchema.optional(),
    totalPages: z.number().int().min(1).max(MAX_BOOK_PAGES).nullable().optional(),
  })
  .refine(
    (v) => v.status !== undefined || v.currentPage !== undefined || v.totalPages !== undefined,
    {
      message: 'Nothing to update.',
    },
  );
export type UpdateShelfEntryRequest = z.infer<typeof updateShelfEntryRequestSchema>;

export const readingSessionSchema = z.object({
  id: z.string(),
  shelfEntryId: z.string(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime(),
  focusedSeconds: z.number().int(),
  startPage: z.number().int(),
  endPage: z.number().int(),
  pagesRead: z.number().int().nonnegative(),
  reflection: z.string().nullable(),
  localDate: localDateSchema,
  xpEarned: z.number().int().nonnegative(),
});
export type ReadingSession = z.infer<typeof readingSessionSchema>;

/** POST /v1/sessions — a finished focused reading session. The start page comes from the shelf. */
export const createSessionRequestSchema = z
  .object({
    /** Client-generated UUID: retrying the same session never records it twice. */
    id: z.uuid(),
    shelfEntryId: z.string().min(1),
    startedAt: z.iso.datetime(),
    endedAt: z.iso.datetime(),
    focusedSeconds: z.number().int().min(MIN_SESSION_SECONDS).max(MAX_SESSION_SECONDS),
    endPage: pageSchema,
    reflection: z.string().trim().max(MAX_REFLECTION_LENGTH).nullable().optional(),
    /** Reader's local calendar day when the session ended. */
    localDate: localDateSchema,
  })
  .refine((v) => Date.parse(v.endedAt) >= Date.parse(v.startedAt), {
    path: ['endedAt'],
    message: 'endedAt must not be before startedAt.',
  })
  .refine(
    (v) => v.focusedSeconds <= (Date.parse(v.endedAt) - Date.parse(v.startedAt)) / 1000 + 60,
    {
      path: ['focusedSeconds'],
      message: 'Focused time cannot exceed the session duration.',
    },
  );
export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;

/** GET /v1/me/stats?today=YYYY-MM-DD — computed from real sessions only. */
export const statsResponseSchema = z.object({
  today: localDateSchema,
  xpTotal: z.number().int().nonnegative(),
  streakDays: z.number().int().nonnegative(),
  sessionsCount: z.number().int().nonnegative(),
  focusedMinutesThisWeek: z.number().int().nonnegative(),
  /** Focused minutes on `today` (the daily focus goal, Task 09). */
  focusedMinutesToday: z.number().int().nonnegative(),
  /** Local dates (this Monday→Sunday) with a reading session or a review. */
  weekActiveDates: z.array(localDateSchema),
  /** Local dates this month (up to today) with a session or a review: the widget calendar. Defaults to [] for older APIs. */
  monthActiveDates: z.array(localDateSchema).default([]),
  /** Reading-only days for the system widget; reviews never count as reading. */
  weekReadingDates: z.array(localDateSchema),
  /** Whether there was a reading session on `today`. */
  readToday: z.boolean(),
  /** Whether there was at least one review on `today`. */
  reviewedToday: z.boolean(),
  /** Recall cards due on or before `today`. */
  dueCards: z.number().int().nonnegative(),
});
export type StatsResponse = z.infer<typeof statsResponseSchema>;

export const sessionResultSchema = z.object({
  session: readingSessionSchema,
  entry: shelfEntrySchema,
  xpEarned: z.number().int().nonnegative(),
  stats: statsResponseSchema,
});
export type SessionResult = z.infer<typeof sessionResultSchema>;

/** One graded recall attempt on a card of this book (a `review_logs` row). */
export const bookReviewSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  grade: z.number().int().min(0).max(5),
  localDate: localDateSchema,
  reviewedAt: z.iso.datetime(),
});
export type BookReview = z.infer<typeof bookReviewSchema>;

/** GET /v1/shelf/:id — one book with its recent sessions, cards and reviews. */
export const shelfEntryDetailSchema = z.object({
  entry: shelfEntrySchema,
  sessions: z.array(readingSessionSchema),
  cards: z.array(recallCardSchema),
  /** Most recent reviews first. Defaults to [] for API versions without the field. */
  reviews: z.array(bookReviewSchema).default([]),
  /** All graded attempts on this book's cards (not only the last 20). */
  reviewTotals: z
    .object({ total: z.number().int().nonnegative(), remembered: z.number().int().nonnegative() })
    .default({ total: 0, remembered: 0 }),
});
export type ShelfEntryDetail = z.infer<typeof shelfEntryDetailSchema>;

export const statsQuerySchema = z.object({ today: localDateSchema });

/** POST /v1/recall/cards/:id/review result. */
export const reviewResultSchema = z.object({
  card: recallCardSchema,
  xpEarned: z.number().int().nonnegative(),
  stats: statsResponseSchema,
});
export type ReviewResult = z.infer<typeof reviewResultSchema>;
