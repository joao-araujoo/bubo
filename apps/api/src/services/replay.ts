import { type ReplayQuery, type ReplayResponse, replayResponseSchema } from '@bubo/contracts';
import { type Executor, schema } from '@bubo/database';
import { addDays, computeReplay, createReplayPeriod } from '@bubo/domain';
import { and, eq, gte, lt, lte, sql } from 'drizzle-orm';

import { AppError } from '../lib/errors';
import { toShelfEntry } from './shelf';

const { readingSessions, shelfEntries, books } = schema;

/** No snapshots or writes: deleting a shelf entry/account also deletes its Replay contribution. */
export async function getReplay(
  db: Executor,
  userId: string,
  query: ReplayQuery,
  now: Date,
): Promise<ReplayResponse> {
  let period;
  try {
    period = createReplayPeriod(query, now);
  } catch {
    throw new AppError(
      'VALIDATION_FAILED',
      'Choose an existing calendar period and IANA timezone.',
    );
  }
  // Two padded UTC days cover all IANA offsets, including DST; the pure domain trims exact days.
  const windowStart = new Date(`${addDays(period.startDate, -2)}T00:00:00Z`);
  const windowEnd = new Date(`${addDays(period.endDate, 3)}T00:00:00Z`);
  const [readings, history] = await Promise.all([
    db
      .select({
        session: {
          id: readingSessions.id,
          shelfEntryId: readingSessions.shelfEntryId,
          startedAt: readingSessions.startedAt,
          endedAt: readingSessions.endedAt,
          focusedSeconds: readingSessions.focusedSeconds,
          startPage: readingSessions.startPage,
          endPage: readingSessions.endPage,
        },
        entry: shelfEntries,
        book: books,
      })
      .from(readingSessions)
      .innerJoin(
        shelfEntries,
        and(eq(shelfEntries.id, readingSessions.shelfEntryId), eq(shelfEntries.userId, userId)),
      )
      .innerJoin(books, eq(books.id, shelfEntries.bookId))
      .where(
        and(
          eq(readingSessions.userId, userId),
          gte(readingSessions.endedAt, windowStart),
          lt(readingSessions.endedAt, windowEnd),
          lte(readingSessions.endedAt, now),
        ),
      ),
    db
      .select({
        shelfEntryId: readingSessions.shelfEntryId,
        firstReadAt: sql<string>`min(${readingSessions.endedAt})::text`,
        lastReadAt: sql<string>`max(${readingSessions.endedAt})::text`,
        // Status/finishedAt are declarations. Only a real forward session crossing the known
        // final page counts; unknown page counts and zero-page sessions prove no completion.
        completionAt: sql<string | null>`(min(${readingSessions.endedAt}) filter (where
          coalesce(${shelfEntries.totalPages}, ${books.totalPages}) > 0
          and ${readingSessions.startPage} < coalesce(${shelfEntries.totalPages}, ${books.totalPages})
          and ${readingSessions.endPage} >= coalesce(${shelfEntries.totalPages}, ${books.totalPages})
        ))::text`,
      })
      .from(readingSessions)
      .innerJoin(
        shelfEntries,
        and(eq(shelfEntries.id, readingSessions.shelfEntryId), eq(shelfEntries.userId, userId)),
      )
      .innerJoin(books, eq(books.id, shelfEntries.bookId))
      .where(and(eq(readingSessions.userId, userId), lte(readingSessions.endedAt, now)))
      .groupBy(readingSessions.shelfEntryId),
  ]);
  const historyById = new Map(history.map((row) => [row.shelfEntryId, row]));
  const periodBooks = new Map(readings.map((row) => [row.entry.id, row]));
  const firstSessionAt = history.reduce<Date | null>((first, row) => {
    const candidate = new Date(row.firstReadAt);
    return first === null || candidate < first ? candidate : first;
  }, null);
  const bookInputs = [...periodBooks.values()].flatMap(({ entry, book }) => {
    const recorded = historyById.get(entry.id);
    if (!recorded) return [];
    return [
      {
        shelfEntryId: entry.id,
        book: toShelfEntry(entry, book).book,
        author: book.author,
        firstReadAt: new Date(recorded.firstReadAt),
        lastReadAt: new Date(recorded.lastReadAt),
        completionAt: recorded.completionAt === null ? null : new Date(recorded.completionAt),
      },
    ];
  });
  return replayResponseSchema.parse(
    computeReplay({
      period,
      now,
      firstSessionAt,
      sessions: readings.map((row) => row.session),
      books: bookInputs,
    }),
  );
}
