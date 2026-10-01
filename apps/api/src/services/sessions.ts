import {
  type CreateSessionRequest,
  type ReadingSession,
  type SessionResult,
  readingSessionSchema,
} from '@bubo/contracts';
import { type Database, type Executor, schema } from '@bubo/database';
import { addDays, applySessionToShelf, READING_STATUSES, type ReadingStatus } from '@bubo/domain';
import { xpForReadingSession } from '@bubo/scoring';
import { and, desc, eq } from 'drizzle-orm';

import { AppError } from '../lib/errors';
import { createReflectionCard } from './recall';
import { effectiveTotalPages, findEntry, toShelfEntry } from './shelf';
import { getStats } from './stats';

const { readingSessions, shelfEntries } = schema;
type SessionRow = typeof readingSessions.$inferSelect;

/** Clock skew tolerated between the device and the server. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const MAX_SESSION_AGE_MS = 48 * 60 * 60 * 1000;

function toSession(row: SessionRow): ReadingSession {
  return readingSessionSchema.parse({
    id: row.id,
    shelfEntryId: row.shelfEntryId,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt.toISOString(),
    focusedSeconds: row.focusedSeconds,
    startPage: row.startPage,
    endPage: row.endPage,
    pagesRead: row.endPage - row.startPage,
    reflection: row.reflection,
    localDate: row.localDate,
    xpEarned: row.xpEarned,
  });
}

function invalid(path: string, message: string): never {
  throw new AppError('VALIDATION_FAILED', 'Some fields are invalid.', {
    issues: [{ path, message }],
  });
}

/** Rejects sessions whose timing cannot be real (backdating streaks, clock tricks). */
function assertPlausible(input: CreateSessionRequest, now: Date) {
  const endedAt = Date.parse(input.endedAt);
  const startedAt = Date.parse(input.startedAt);
  if (endedAt > now.getTime() + FUTURE_TOLERANCE_MS) invalid('endedAt', 'Cannot be in the future.');
  if (now.getTime() - startedAt > MAX_SESSION_AGE_MS)
    invalid('startedAt', 'Session is too old to record.');
  const endedUtcDate = new Date(endedAt).toISOString().slice(0, 10);
  const allowed = [addDays(endedUtcDate, -1), endedUtcDate, addDays(endedUtcDate, 1)];
  if (!allowed.includes(input.localDate))
    invalid('localDate', 'Does not match the session end time.');
}

export { getStats };

async function resultFor(db: Executor, userId: string, row: SessionRow): Promise<SessionResult> {
  const { entry, book } = await findEntry(db, userId, row.shelfEntryId);
  return {
    session: toSession(row),
    entry: toShelfEntry(entry, book),
    xpEarned: row.xpEarned,
    stats: await getStats(db, userId, row.localDate),
  };
}

/**
 * Records a finished session atomically: progress (never backwards), status, XP and streak.
 * Idempotent on the client-generated id, so a retried request never counts twice.
 */
export async function recordSession(
  db: Database,
  userId: string,
  input: CreateSessionRequest,
  now: Date,
): Promise<{ result: SessionResult; created: boolean }> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(readingSessions)
      .where(eq(readingSessions.id, input.id))
      .limit(1);
    if (existing) {
      if (existing.userId !== userId) throw new AppError('CONFLICT', 'Session id already used.');
      return { result: await resultFor(tx, userId, existing), created: false };
    }

    // An already accepted UUID remains retryable after the 48-hour creation window.
    assertPlausible(input, now);

    const { entry, book } = await findEntry(tx, userId, input.shelfEntryId);
    const startPage = entry.currentPage;
    if (input.endPage < startPage) {
      invalid('endPage', `Must be at least the current page (${startPage}).`);
    }
    const totalPages = effectiveTotalPages(entry, book);
    if (totalPages !== null && input.endPage > totalPages) {
      invalid('endPage', `Must be at most ${totalPages}.`);
    }

    const xpEarned = xpForReadingSession({ focusedMinutes: Math.floor(input.focusedSeconds / 60) });
    const [session] = await tx
      .insert(readingSessions)
      .values({
        id: input.id,
        userId,
        shelfEntryId: entry.id,
        startedAt: new Date(input.startedAt),
        endedAt: new Date(input.endedAt),
        focusedSeconds: input.focusedSeconds,
        startPage,
        endPage: input.endPage,
        reflection: input.reflection ? input.reflection : null,
        localDate: input.localDate,
        xpEarned,
      })
      .returning();
    if (!session) throw new AppError('INTERNAL_ERROR', 'Could not record the session.');

    const status: ReadingStatus = (READING_STATUSES as readonly string[]).includes(entry.status)
      ? (entry.status as ReadingStatus)
      : 'reading';
    const next = applySessionToShelf(
      {
        status,
        currentPage: entry.currentPage,
        totalPages,
        startedAt: entry.startedAt,
        finishedAt: entry.finishedAt,
      },
      input.endPage,
      now,
    );
    await tx
      .update(shelfEntries)
      .set({
        status: next.status,
        currentPage: next.currentPage,
        startedAt: next.startedAt,
        finishedAt: next.finishedAt,
      })
      .where(eq(shelfEntries.id, entry.id));

    // A reflection becomes a recall card: tomorrow the reader tries to remember it without peeking.
    if (session.reflection) {
      await createReflectionCard(tx, {
        userId,
        shelfEntryId: entry.id,
        sessionId: session.id,
        bookTitle: book.title,
        startPage,
        endPage: input.endPage,
        reflection: session.reflection,
        localDate: input.localDate,
      });
    }

    return { result: await resultFor(tx, userId, session), created: true };
  });
}

export async function listEntrySessions(db: Executor, userId: string, entryId: string, limit = 20) {
  const rows = await db
    .select()
    .from(readingSessions)
    .where(and(eq(readingSessions.userId, userId), eq(readingSessions.shelfEntryId, entryId)))
    .orderBy(desc(readingSessions.endedAt))
    .limit(limit);
  return rows.map(toSession);
}
