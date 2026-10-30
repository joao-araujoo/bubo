import { type BookCommunity, bookCommunitySchema } from '@bubo/contracts';
import { type Executor, schema } from '@bubo/database';
import {
  ALSO_READ_MIN_BASE,
  ALSO_READ_MIN_SHARED,
  COMMUNITY_MIN_READERS,
  alsoReadPercent,
  ratingSummary,
} from '@bubo/domain';
import { and, asc, desc, eq, inArray, isNotNull, ne, notInArray, sql } from 'drizzle-orm';

import { bookCoverUrls, findEntry } from './shelf';

const { books, shelfEntries } = schema;

export const ALSO_READ_MAX = 10;

/**
 * Anonymous numbers of a shelf book across Bubo readers (ADR-046): readers by status, ratings in
 * aggregate and "quem leu também leu". Only counts leave the database, never who; every block has
 * a privacy floor, and manual books (one reader by definition) have none.
 */
export async function getBookCommunity(
  db: Executor,
  userId: string,
  entryId: string,
): Promise<BookCommunity> {
  const { book } = await findEntry(db, userId, entryId);
  if (book.catalogKey === null) {
    return bookCommunitySchema.parse({ readers: null, ratings: null, alsoRead: [] });
  }

  // One entry per reader and book (unique index), so rows are distinct readers.
  const byStatus = await db
    .select({ status: shelfEntries.status, n: sql<number>`count(*)::int` })
    .from(shelfEntries)
    .where(eq(shelfEntries.bookId, book.id))
    .groupBy(shelfEntries.status);
  const count = (status: string) => Number(byStatus.find((row) => row.status === status)?.n ?? 0);
  const total = byStatus.reduce((sum, row) => sum + Number(row.n), 0);
  const readers =
    total >= COMMUNITY_MIN_READERS
      ? {
          finished: count('finished'),
          reading: count('reading'),
          wantToRead: count('want_to_read'),
          abandoned: count('abandoned'),
        }
      : null;

  const byRating = await db
    .select({ rating: shelfEntries.rating, n: sql<number>`count(*)::int` })
    .from(shelfEntries)
    .where(and(eq(shelfEntries.bookId, book.id), isNotNull(shelfEntries.rating)))
    .groupBy(shelfEntries.rating);
  const ratings = ratingSummary(
    [1, 2, 3, 4, 5].map((stars) => Number(byRating.find((row) => row.rating === stars)?.n ?? 0)),
  );

  // Other readers who finished this book; candidates are catalog books they also finished and the
  // requester does not have yet.
  const others = and(
    eq(shelfEntries.bookId, book.id),
    eq(shelfEntries.status, 'finished'),
    ne(shelfEntries.userId, userId),
  );
  const [base] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(shelfEntries)
    .where(others);
  const baseReaders = Number(base?.n ?? 0);
  let alsoRead: BookCommunity['alsoRead'] = [];
  if (baseReaders >= ALSO_READ_MIN_BASE) {
    const shared = sql<number>`count(distinct ${shelfEntries.userId})::int`;
    const rows = await db
      .select({ book: books, shared })
      .from(shelfEntries)
      .innerJoin(books, eq(books.id, shelfEntries.bookId))
      .where(
        and(
          inArray(
            shelfEntries.userId,
            db.select({ userId: shelfEntries.userId }).from(shelfEntries).where(others),
          ),
          eq(shelfEntries.status, 'finished'),
          ne(shelfEntries.bookId, book.id),
          isNotNull(books.catalogKey),
          notInArray(
            shelfEntries.bookId,
            db
              .select({ bookId: shelfEntries.bookId })
              .from(shelfEntries)
              .where(eq(shelfEntries.userId, userId)),
          ),
        ),
      )
      .groupBy(books.id)
      .having(sql`count(distinct ${shelfEntries.userId}) >= ${ALSO_READ_MIN_SHARED}`)
      .orderBy(desc(shared), asc(books.title))
      .limit(ALSO_READ_MAX);
    alsoRead = rows.flatMap((row) => {
      const percent = alsoReadPercent(Number(row.shared), baseReaders);
      return percent === null || row.book.catalogKey === null
        ? []
        : [
            {
              catalogId: row.book.catalogKey,
              title: row.book.title,
              author: row.book.author,
              coverUrls: bookCoverUrls(row.book),
              percent,
            },
          ];
    });
  }

  return bookCommunitySchema.parse({ readers, ratings, alsoRead });
}
