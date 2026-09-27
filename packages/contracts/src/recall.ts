import { isIsoDate } from '@bubo/domain';
import { z } from 'zod';

const localDateSchema = z.string().refine(isIsoDate, 'Must be a calendar date (YYYY-MM-DD).');

export const RECALL_PROMPT_MAX = 500;
export const RECALL_ANSWER_MAX = 2000;

export const recallCardSchema = z.object({
  id: z.string(),
  shelfEntryId: z.string(),
  bookTitle: z.string(),
  prompt: z.string(),
  /** The reader's own note, revealed only after trying to remember. */
  answer: z.string().nullable(),
  source: z.enum(['reflection', 'manual']),
  repetitions: z.number().int().nonnegative(),
  intervalDays: z.number().int().nonnegative(),
  dueDate: localDateSchema,
  lastReviewedAt: z.iso.datetime().nullable(),
});
export type RecallCard = z.infer<typeof recallCardSchema>;

/** POST /v1/recall/cards — a card written by the reader. */
export const createCardRequestSchema = z.object({
  shelfEntryId: z.string().min(1),
  prompt: z.string().trim().min(1).max(RECALL_PROMPT_MAX),
  answer: z.string().trim().max(RECALL_ANSWER_MAX).nullable().optional(),
  /** Reader's local today: a new card is first due tomorrow. */
  localDate: localDateSchema,
});
export type CreateCardRequest = z.infer<typeof createCardRequestSchema>;

/**
 * Self-assessed recall quality (SM-2): 1 = não lembrei, 3 = lembrei com esforço,
 * 4 = lembrei bem, 5 = fácil. 0 and 2 are accepted for completeness.
 */
export const recallGradeSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

/** POST /v1/recall/cards/:id/review — idempotent on the client-generated id. */
export const reviewRequestSchema = z.object({
  id: z.uuid(),
  grade: recallGradeSchema,
  localDate: localDateSchema,
});
export type ReviewRequest = z.infer<typeof reviewRequestSchema>;

/** GET /v1/recall/due?today=YYYY-MM-DD */
export const dueCardsResponseSchema = z.object({
  today: localDateSchema,
  cards: z.array(recallCardSchema),
  dueCount: z.number().int().nonnegative(),
  totalCards: z.number().int().nonnegative(),
  /** Earliest future due date when nothing is due today. */
  nextDueDate: localDateSchema.nullable(),
});
export type DueCardsResponse = z.infer<typeof dueCardsResponseSchema>;
