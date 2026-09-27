import { memoryStatsResponseSchema } from '@bubo/contracts';
import { type Database, schema } from '@bubo/database';
import { addDays } from '@bubo/domain';
import { and, eq, gte, lte, sql } from 'drizzle-orm';

/** Aggregate in Postgres; no unbounded review history is transferred to the Worker. */
export async function getMemoryStats(db: Database, userId: string, today: string) {
  const { reviewLogs } = schema;
  const rows = await db
    .select({
      date: reviewLogs.localDate,
      remembered: sql<number>`count(*) filter (where ${reviewLogs.grade} >= 4)`.mapWith(Number),
      almost: sql<number>`count(*) filter (where ${reviewLogs.grade} = 3)`.mapWith(Number),
      forgot: sql<number>`count(*) filter (where ${reviewLogs.grade} <= 2)`.mapWith(Number),
    })
    .from(reviewLogs)
    .where(
      and(
        eq(reviewLogs.userId, userId),
        gte(reviewLogs.localDate, addDays(today, -6)),
        lte(reviewLogs.localDate, today),
      ),
    )
    .groupBy(reviewLogs.localDate);
  return memoryStatsResponseSchema.parse({
    days: Array.from({ length: 7 }, (_, index) => {
      const date = addDays(today, index - 6);
      return rows.find((row) => row.date === date) ?? { date, remembered: 0, almost: 0, forgot: 0 };
    }),
  });
}
