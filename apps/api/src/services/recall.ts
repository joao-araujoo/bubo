import {
  type BookReview,
  type CreateCardRequest,
  type DueCardsResponse,
  type RecallCard,
  type ReviewRequest,
  type ReviewResult,
  bookReviewSchema,
  dueCardsResponseSchema,
  recallCardSchema,
} from '@bubo/contracts';
import { type Database, type Executor, schema } from '@bubo/database';
import { addDays } from '@bubo/domain';
import { type RecallGrade, scheduleNextReview, xpForRecallSession } from '@bubo/scoring';
import { and, asc, desc, eq, gt, lte, sql } from 'drizzle-orm';

import { AppError } from '../lib/errors';
import { findEntry } from './shelf';
import { getStats } from './stats';

const { books, recallCards, reviewLogs, shelfEntries } = schema;
type CardRow = typeof recallCards.$inferSelect;

export const DUE_PAGE_SIZE = 50;

function toCard(row: CardRow, bookTitle: string): RecallCard {
  return recallCardSchema.parse({
    id: row.id,
    shelfEntryId: row.shelfEntryId,
    bookTitle,
    prompt: row.prompt,
    answer: row.answer,
    source: row.source,
    repetitions: row.repetitions,
    intervalDays: row.intervalDays,
    dueDate: row.dueDate,
    lastReviewedAt: row.lastReviewedAt?.toISOString() ?? null,
  });
}

/** Local date must match the server's UTC day within ±1 (time zones), never further. */
export function assertLocalDateNear(localDate: string, now: Date, path = 'localDate') {
  const utc = now.toISOString().slice(0, 10);
  if (![addDays(utc, -1), utc, addDays(utc, 1)].includes(localDate)) {
    throw new AppError('VALIDATION_FAILED', 'Some fields are invalid.', {
      issues: [{ path, message: 'Does not match the current date.' }],
    });
  }
}

/** Card created from a session reflection: the reflection becomes the answer to remember. */
export async function createReflectionCard(
  tx: Executor,
  params: {
    userId: string;
    shelfEntryId: string;
    sessionId: string;
    bookTitle: string;
    startPage: number;
    endPage: number;
    reflection: string;
    localDate: string;
  },
) {
  const pages =
    params.endPage > params.startPage ? ` (págs. ${params.startPage + 1}–${params.endPage})` : '';
  await tx.insert(recallCards).values({
    id: crypto.randomUUID(),
    userId: params.userId,
    shelfEntryId: params.shelfEntryId,
    sessionId: params.sessionId,
    prompt: `O que ficou com você de “${params.bookTitle}”${pages}?`.slice(0, 500),
    answer: params.reflection,
    source: 'reflection',
    dueDate: addDays(params.localDate, 1),
  });
}

export async function createCard(
  db: Database,
  userId: string,
  input: CreateCardRequest,
  now: Date,
) {
  assertLocalDateNear(input.localDate, now);
  const { entry, book } = await findEntry(db, userId, input.shelfEntryId);
  const [row] = await db
    .insert(recallCards)
    .values({
      id: crypto.randomUUID(),
      userId,
      shelfEntryId: entry.id,
      prompt: input.prompt,
      answer: input.answer ? input.answer : null,
      source: 'manual',
      dueDate: addDays(input.localDate, 1),
    })
    .returning();
  if (!row) throw new AppError('INTERNAL_ERROR', 'Could not create the card.');
  return toCard(row, book.title);
}

async function findCard(db: Executor, userId: string, cardId: string) {
  const [row] = await db
    .select({ card: recallCards, bookTitle: books.title })
    .from(recallCards)
    .innerJoin(shelfEntries, eq(shelfEntries.id, recallCards.shelfEntryId))
    .innerJoin(books, eq(books.id, shelfEntries.bookId))
    .where(and(eq(recallCards.id, cardId), eq(recallCards.userId, userId)))
    .limit(1);
  if (!row) throw new AppError('NOT_FOUND', 'Card not found.');
  return row;
}

export async function listDueCards(
  db: Executor,
  userId: string,
  today: string,
): Promise<DueCardsResponse> {
  const due = await db
    .select({ card: recallCards, bookTitle: books.title })
    .from(recallCards)
    .innerJoin(shelfEntries, eq(shelfEntries.id, recallCards.shelfEntryId))
    .innerJoin(books, eq(books.id, shelfEntries.bookId))
    .where(and(eq(recallCards.userId, userId), lte(recallCards.dueDate, today)))
    .orderBy(asc(recallCards.dueDate), asc(recallCards.createdAt))
    .limit(DUE_PAGE_SIZE);

  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      due: sql<number>`count(*) filter (where ${recallCards.dueDate} <= ${today})::int`,
    })
    .from(recallCards)
    .where(eq(recallCards.userId, userId));

  const [next] = await db
    .select({ date: sql<string | null>`min(${recallCards.dueDate})::text` })
    .from(recallCards)
    .where(and(eq(recallCards.userId, userId), gt(recallCards.dueDate, today)));

  return dueCardsResponseSchema.parse({
    today,
    cards: due.map(({ card, bookTitle }) => toCard(card, bookTitle)),
    dueCount: Number(counts?.due ?? 0),
    totalCards: Number(counts?.total ?? 0),
    nextDueDate: next?.date ?? null,
  });
}

export async function listEntryCards(
  db: Executor,
  userId: string,
  entryId: string,
  bookTitle: string,
) {
  const rows = await db
    .select()
    .from(recallCards)
    .where(and(eq(recallCards.userId, userId), eq(recallCards.shelfEntryId, entryId)))
    .orderBy(asc(recallCards.dueDate));
  return rows.map((row) => toCard(row, bookTitle));
}

/** Recent graded attempts on this book's cards (owner-scoped, newest first, bounded). */
export async function listEntryReviews(
  db: Executor,
  userId: string,
  entryId: string,
  limit = 20,
): Promise<BookReview[]> {
  const rows = await db
    .select({
      id: reviewLogs.id,
      cardId: reviewLogs.cardId,
      grade: reviewLogs.grade,
      localDate: reviewLogs.localDate,
      reviewedAt: reviewLogs.reviewedAt,
    })
    .from(reviewLogs)
    .innerJoin(recallCards, eq(recallCards.id, reviewLogs.cardId))
    .where(
      and(
        eq(reviewLogs.userId, userId),
        eq(recallCards.userId, userId),
        eq(recallCards.shelfEntryId, entryId),
      ),
    )
    .orderBy(desc(reviewLogs.reviewedAt), desc(reviewLogs.id))
    .limit(limit);
  return rows.map((row) =>
    bookReviewSchema.parse({ ...row, reviewedAt: row.reviewedAt.toISOString() }),
  );
}

/** All graded attempts on this book's cards (owner-scoped). */
export async function entryReviewTotals(db: Executor, userId: string, entryId: string) {
  const [row] = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      remembered: sql<number>`count(*) filter (where ${reviewLogs.grade} >= 4)`.mapWith(Number),
    })
    .from(reviewLogs)
    .innerJoin(recallCards, eq(recallCards.id, reviewLogs.cardId))
    .where(
      and(
        eq(reviewLogs.userId, userId),
        eq(recallCards.userId, userId),
        eq(recallCards.shelfEntryId, entryId),
      ),
    );
  return { total: row?.total ?? 0, remembered: row?.remembered ?? 0 };
}

/**
 * Grades one recall attempt and reschedules the card with SM-2. Idempotent on the client id.
 * Reviewing before the due date is refused (it would distort the schedule).
 */
export async function reviewCard(
  db: Database,
  userId: string,
  cardId: string,
  input: ReviewRequest,
  now: Date,
): Promise<{ result: ReviewResult; created: boolean }> {
  assertLocalDateNear(input.localDate, now);

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(reviewLogs)
      .where(eq(reviewLogs.id, input.id))
      .limit(1);
    if (existing) {
      if (existing.userId !== userId || existing.cardId !== cardId) {
        throw new AppError('CONFLICT', 'Review id already used.');
      }
      const { card, bookTitle } = await findCard(tx, userId, cardId);
      return {
        result: {
          card: toCard(card, bookTitle),
          xpEarned: existing.xpEarned,
          stats: await getStats(tx, userId, existing.localDate),
        },
        created: false,
      };
    }

    const { card, bookTitle } = await findCard(tx, userId, cardId);
    if (card.dueDate > input.localDate) {
      throw new AppError('CONFLICT', 'This card is not due yet.');
    }

    const grade = input.grade as RecallGrade;
    const next = scheduleNextReview(
      {
        repetitions: card.repetitions,
        intervalDays: card.intervalDays,
        easeFactor: card.easeX100 / 100,
      },
      grade,
    );
    const xpEarned = xpForRecallSession({
      attempts: 1,
      correct: grade >= 3 ? 1 : 0,
      completed: false,
    });

    await tx.insert(reviewLogs).values({
      id: input.id,
      userId,
      cardId: card.id,
      grade,
      reviewedAt: now,
      localDate: input.localDate,
      intervalDays: next.intervalDays,
      xpEarned,
    });
    const [updated] = await tx
      .update(recallCards)
      .set({
        repetitions: next.repetitions,
        intervalDays: next.intervalDays,
        easeX100: Math.round(next.easeFactor * 100),
        dueDate: addDays(input.localDate, next.intervalDays),
        lastReviewedAt: now,
      })
      .where(eq(recallCards.id, card.id))
      .returning();
    if (!updated) throw new AppError('INTERNAL_ERROR', 'Could not update the card.');

    return {
      result: {
        card: toCard(updated, bookTitle),
        xpEarned,
        stats: await getStats(tx, userId, input.localDate),
      },
      created: true,
    };
  });
}

export async function deleteCard(db: Database, userId: string, cardId: string) {
  const { card } = await findCard(db, userId, cardId);
  await db.delete(recallCards).where(eq(recallCards.id, card.id));
}
