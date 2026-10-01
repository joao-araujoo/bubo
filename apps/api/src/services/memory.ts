import { memoryStatsResponseSchema } from '@bubo/contracts';
import { type Database, schema } from '@bubo/database';
import { type DayPart, addDays, dayPartOf } from '@bubo/domain';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';

import { bookCoverUrls } from './shelf';

const { books, readingSessions, recallCards, reviewLogs, shelfEntries } = schema;

const BOOKS_LIMIT = 10;

/**
 * "Minha memória" (ADR-017, extended in ADR-020). Aggregated in Postgres; no unbounded history is
 * transferred to the Worker. Every figure counts the reader's own Lembrei/Quase/Esqueci grades or
 * recorded sessions — nothing is an estimate of retention.
 */
export async function getMemoryStats(
  db: Database,
  userId: string,
  query: { today: string; days: number; tz: number },
) {
  const { today, days, tz } = query;
  const from = addDays(today, -(days - 1));
  const inPeriod = and(
    eq(reviewLogs.userId, userId),
    gte(reviewLogs.localDate, from),
    lte(reviewLogs.localDate, today),
  );
  const remembered = sql<number>`count(*) filter (where ${reviewLogs.grade} >= 4)`.mapWith(Number);

  const dayRows = await db
    .select({
      date: reviewLogs.localDate,
      remembered,
      almost: sql<number>`count(*) filter (where ${reviewLogs.grade} = 3)`.mapWith(Number),
      forgot: sql<number>`count(*) filter (where ${reviewLogs.grade} <= 2)`.mapWith(Number),
    })
    .from(reviewLogs)
    .where(inPeriod)
    .groupBy(reviewLogs.localDate);

  const bookRows = await db
    .select({
      shelfEntryId: shelfEntries.id,
      book: books,
      total: sql<number>`count(*)`.mapWith(Number),
      remembered,
      cards:
        sql<number>`(select count(*)::int from "recall_cards" c where c."shelf_entry_id" = ${shelfEntries.id})`.mapWith(
          Number,
        ),
    })
    .from(reviewLogs)
    .innerJoin(recallCards, eq(recallCards.id, reviewLogs.cardId))
    .innerJoin(shelfEntries, eq(shelfEntries.id, recallCards.shelfEntryId))
    .innerJoin(books, eq(books.id, shelfEntries.bookId))
    .where(and(inPeriod, eq(recallCards.userId, userId), eq(shelfEntries.userId, userId)))
    .groupBy(shelfEntries.id, books.id)
    .orderBy(desc(sql`count(*)`))
    .limit(BOOKS_LIMIT);

  // `tz` is a validated integer (−840…840), so it is inlined: a bound parameter would make the
  // SELECT and GROUP BY expressions differ for Postgres. Grouped by position for the same reason.
  const offset = sql.raw(String(Math.trunc(tz)));
  const localHour = sql<number>`extract(hour from (${reviewLogs.reviewedAt} at time zone 'UTC') + (${offset} * interval '1 minute'))::int`;
  const hourRows = await db
    .select({ hour: localHour, total: sql<number>`count(*)`.mapWith(Number), remembered })
    .from(reviewLogs)
    .where(inPeriod)
    .groupBy(sql`1`);

  const [cards] = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      books: sql<number>`count(distinct ${recallCards.shelfEntryId})`.mapWith(Number),
    })
    .from(recallCards)
    .where(eq(recallCards.userId, userId));

  const [focus] = await db
    .select({
      seconds: sql<number>`coalesce(sum(${readingSessions.focusedSeconds}), 0)`.mapWith(Number),
      days: sql<number>`count(distinct ${readingSessions.localDate})`.mapWith(Number),
    })
    .from(readingSessions)
    .where(
      and(
        eq(readingSessions.userId, userId),
        gte(readingSessions.localDate, from),
        lte(readingSessions.localDate, today),
      ),
    );

  const dayParts: Record<DayPart, { total: number; remembered: number }> = {
    morning: { total: 0, remembered: 0 },
    afternoon: { total: 0, remembered: 0 },
    evening: { total: 0, remembered: 0 },
    dawn: { total: 0, remembered: 0 },
  };
  for (const row of hourRows) {
    const part = dayParts[dayPartOf(Number(row.hour))];
    part.total += Number(row.total);
    part.remembered += Number(row.remembered);
  }

  return memoryStatsResponseSchema.parse({
    days: Array.from({ length: days }, (_, index) => {
      const date = addDays(from, index);
      return (
        dayRows.find((row) => row.date === date) ?? { date, remembered: 0, almost: 0, forgot: 0 }
      );
    }),
    books: bookRows.map((row) => ({
      shelfEntryId: row.shelfEntryId,
      title: row.book.title,
      author: row.book.author,
      coverUrls: bookCoverUrls(row.book),
      cards: row.cards,
      total: row.total,
      remembered: row.remembered,
    })),
    dayParts,
    cardsTotal: cards?.total ?? 0,
    booksWithCards: cards?.books ?? 0,
    focus: {
      focusedMinutes: Math.floor((focus?.seconds ?? 0) / 60),
      readingDays: focus?.days ?? 0,
    },
  });
}
