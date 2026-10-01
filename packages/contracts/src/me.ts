import {
  GENRES,
  MAX_BOOK_PAGES,
  toIsbn13,
  READING_GOALS,
  READING_HABITS,
  READING_STATUSES,
} from '@bubo/domain';
import { z } from 'zod';

import { catalogIdSchema } from './catalog';

export const readingHabitSchema = z.enum(READING_HABITS);
export const readingGoalSchema = z.enum(READING_GOALS);
export const genreSchema = z.enum(GENRES);
export const readingStatusSchema = z.enum(READING_STATUSES);

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type User = z.infer<typeof userSchema>;

export const readerProfileSchema = z.object({
  readingHabit: readingHabitSchema.nullable(),
  goals: z.array(readingGoalSchema),
  interests: z.array(genreSchema),
  onboardingCompletedAt: z.iso.datetime().nullable(),
});
export type ReaderProfile = z.infer<typeof readerProfileSchema>;

/** GET /v1/me — the signed-in reader. */
export const meResponseSchema = z.object({
  user: userSchema,
  profile: readerProfileSchema,
  onboardingCompleted: z.boolean(),
  isModerator: z.boolean().default(false),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);

export const newBookSchema = z.object({
  title: trimmed(1, 300),
  author: trimmed(1, 200).nullable().optional(),
  totalPages: z.number().int().min(1).max(MAX_BOOK_PAGES).nullable().optional(),
  publisher: trimmed(1, 200).nullable().optional(),
  publishedYear: z.number().int().min(1).max(2100).nullable().optional(),
  /** ISBN-10 or ISBN-13 (hyphens allowed); stored normalized as ISBN-13. */
  isbn: z
    .string()
    .trim()
    .refine((value) => toIsbn13(value) !== null, 'Invalid ISBN.')
    .transform((value) => toIsbn13(value) ?? value)
    .nullable()
    .optional(),
});
export type NewBook = z.infer<typeof newBookSchema>;

/** PUT /v1/me/onboarding — all answers at once (idempotent: re-submitting replaces them). */
export const onboardingRequestSchema = z.object({
  readingHabit: readingHabitSchema,
  goals: z.array(readingGoalSchema).min(1).max(READING_GOALS.length),
  interests: z.array(genreSchema).min(1).max(GENRES.length),
  /** `null` = "Pular por enquanto". A catalog pick sends only its id (the server resolves it). */
  firstBook: z.union([z.object({ catalogId: catalogIdSchema }), newBookSchema]).nullable(),
});
export type OnboardingRequest = z.infer<typeof onboardingRequestSchema>;

export const bookSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string().nullable(),
  totalPages: z.number().int().nullable(),
  /** Set for shared catalog books; null for books typed in manually. */
  catalogId: z.string().nullable(),
  isbn13: z.string().nullable(),
  publisher: z.string().nullable(),
  publishedYear: z.number().int().nullable(),
  /** Ordered https cover candidates (may be empty). Clients always keep a typographic fallback. */
  coverUrls: z.array(z.string()),
});
export type Book = z.infer<typeof bookSchema>;

export const shelfEntrySchema = z.object({
  id: z.string(),
  status: readingStatusSchema,
  currentPage: z.number().int().nonnegative(),
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
  book: bookSchema,
});
export type ShelfEntry = z.infer<typeof shelfEntrySchema>;

/** GET /v1/shelf — the reader's books, most recently updated first. */
export const shelfResponseSchema = z.object({ entries: z.array(shelfEntrySchema) });
export type ShelfResponse = z.infer<typeof shelfResponseSchema>;
