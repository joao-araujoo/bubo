import { type AchievementsResponse, achievementsResponseSchema } from '@bubo/contracts';
import { type Executor, schema } from '@bubo/database';
import { addDays, evaluateAchievements, longestStreak } from '@bubo/domain';
import { levelForXp } from '@bubo/scoring';
import { and, eq, gte, lte, sql } from 'drizzle-orm';

import { getStats } from './stats';

const { readingSessions, reviewLogs, shelfEntries } = schema;

/** Same window as the streak in /me/stats: enough for the 100-day badge. */
const LONGEST_STREAK_LOOKBACK_DAYS = 400;

/**
 * Level + achievements for one reader (ADR-018). Aggregated in Postgres; nothing is stored, so
 * deleting a session or a book can also take a badge away — the wall always matches the data.
 */
export async function getAchievements(
  db: Executor,
  userId: string,
  today: string,
): Promise<AchievementsResponse> {
  const stats = await getStats(db, userId, today);
  const lookback = addDays(today, -LONGEST_STREAK_LOOKBACK_DAYS);

  const [sessions] = await db
    .select({
      count: sql<number>`count(*)::int`,
      seconds: sql<number>`coalesce(sum(${readingSessions.focusedSeconds}), 0)::int`,
      pages: sql<number>`coalesce(sum(greatest(${readingSessions.endPage} - ${readingSessions.startPage}, 0)), 0)::int`,
      reflections: sql<number>`count(*) filter (where nullif(trim(${readingSessions.reflection}), '') is not null)::int`,
    })
    .from(readingSessions)
    .where(eq(readingSessions.userId, userId));

  const [reviews] = await db
    .select({
      count: sql<number>`count(*)::int`,
      remembered: sql<number>`count(*) filter (where ${reviewLogs.grade} >= 4)::int`,
    })
    .from(reviewLogs)
    .where(eq(reviewLogs.userId, userId));

  const [books] = await db
    .select({ finished: sql<number>`count(*)::int` })
    .from(shelfEntries)
    .where(and(eq(shelfEntries.userId, userId), eq(shelfEntries.status, 'finished')));

  const activeDays = await db
    .selectDistinct({ localDate: readingSessions.localDate })
    .from(readingSessions)
    .where(
      and(
        eq(readingSessions.userId, userId),
        gte(readingSessions.localDate, lookback),
        lte(readingSessions.localDate, today),
      ),
    )
    .union(
      db
        .selectDistinct({ localDate: reviewLogs.localDate })
        .from(reviewLogs)
        .where(
          and(
            eq(reviewLogs.userId, userId),
            gte(reviewLogs.localDate, lookback),
            lte(reviewLogs.localDate, today),
          ),
        ),
    );

  const longest = Math.max(longestStreak(activeDays.map((day) => day.localDate)), stats.streakDays);
  const achievements = evaluateAchievements({
    sessions: Number(sessions?.count ?? 0),
    focusedMinutes: Math.floor(Number(sessions?.seconds ?? 0) / 60),
    pagesRead: Number(sessions?.pages ?? 0),
    booksFinished: Number(books?.finished ?? 0),
    reflections: Number(sessions?.reflections ?? 0),
    reviews: Number(reviews?.count ?? 0),
    remembered: Number(reviews?.remembered ?? 0),
    longestStreak: longest,
  });

  return achievementsResponseSchema.parse({
    level: levelForXp(stats.xpTotal),
    streakDays: stats.streakDays,
    longestStreakDays: longest,
    unlockedCount: achievements.filter((achievement) => achievement.unlocked).length,
    achievements,
  });
}
