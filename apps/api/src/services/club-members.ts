import { type ClubMembersResponse, clubMembersResponseSchema } from '@bubo/contracts';
import { type Executor, schema } from '@bubo/database';
import { pageBuckets } from '@bubo/domain';
import { levelForXp } from '@bubo/scoring';
import { and, eq, sql } from 'drizzle-orm';

import { bookPages, viewContext, xpOf } from './community';

const { clubMembers, users } = schema;

const MEMBERS_LIMIT = 200;

/**
 * Stitch "Membros & estatísticas". Each member's page comes from their own shelf entry for the
 * club's book (disclosed in the guidelines); levels come from real XP.
 */
export async function listMembers(
  db: Executor,
  userId: string,
  clubId: string,
): Promise<ClubMembersResponse> {
  const { club, ctx } = await viewContext(db, userId, clubId, false);
  const totalPages = await bookPages(db, club.bookId);
  const rows = await db
    .select({
      userId: clubMembers.userId,
      role: clubMembers.role,
      joinedAt: clubMembers.joinedAt,
      name: users.name,
      xp: xpOf(clubMembers.userId),
      page: sql<number>`coalesce((select e."current_page" from "shelf_entries" e where e."user_id" = ${clubMembers.userId} and e."book_id" = ${club.bookId}), 0)::int`,
    })
    .from(clubMembers)
    .innerJoin(users, eq(users.id, clubMembers.userId))
    .where(eq(clubMembers.clubId, clubId))
    .limit(MEMBERS_LIMIT);

  const [counts] = await db
    .select({
      topics: sql<number>`(select count(*)::int from "reading_club_posts" p where p."club_id" = ${clubId} and p."status" = 'visible')`,
      replies: sql<number>`(select count(*)::int from "reading_club_replies" r where r."club_id" = ${clubId} and r."status" = 'visible')`,
      votes: sql<number>`(select count(distinct (v."poll_id", v."user_id"))::int from "reading_club_poll_votes" v join "reading_club_polls" q on q."id" = v."poll_id" where q."club_id" = ${clubId})`,
      members: sql<number>`count(*)::int`,
    })
    .from(clubMembers)
    .where(and(eq(clubMembers.clubId, clubId)));

  const pages = rows.map((row) => Number(row.page));
  const capped = pages.map((page) => (totalPages ? Math.min(page, totalPages) : page));
  const percentOf = (page: number) =>
    totalPages ? Math.min(100, Math.round((page / totalPages) * 100)) : null;
  const average =
    totalPages && capped.length
      ? Math.round((capped.reduce((a, b) => a + b, 0) / capped.length / totalPages) * 100)
      : null;

  const members = rows
    .map((row) => {
      const level = levelForXp(Number(row.xp));
      return {
        userId: row.userId,
        name: row.name,
        role: row.role === 'owner' ? ('owner' as const) : ('member' as const),
        level: level.level,
        levelTitle: level.title,
        page: Number(row.page),
        percent: percentOf(Number(row.page)),
        isYou: row.userId === userId,
        joinedAt: new Date(row.joinedAt).toISOString(),
      };
    })
    // Furthest reader first; ties by name so the order is stable.
    .sort((a, b) => b.page - a.page || a.name.localeCompare(b.name, 'pt-BR'));

  return clubMembersResponseSchema.parse({
    readerPage: ctx.readerPage,
    averagePercent: average,
    distribution: pageBuckets(totalPages, pages),
    stats: {
      memberCount: Number(counts?.members ?? rows.length),
      pagesRead: capped.reduce((a, b) => a + b, 0),
      discussions: Number(counts?.topics ?? 0) + Number(counts?.replies ?? 0),
      pollVotes: Number(counts?.votes ?? 0),
    },
    members,
  });
}
