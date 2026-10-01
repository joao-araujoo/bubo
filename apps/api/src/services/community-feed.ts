import {
  type CommunityFeedResponse,
  type FeedItem,
  clubIconSchema,
  communityFeedResponseSchema,
} from '@bubo/contracts';
import { type Executor, schema } from '@bubo/database';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';

import { type ViewContext, postColumns, postFilters, toPost, visibleTo } from './community';
import { mapPolls, pollFilters, pollSelect } from './polls';

const { books, clubMembers, clubPolls, clubPosts, clubs, users } = schema;

const FEED_LIMIT = 30;

/**
 * Stitch "Feed dos clubes": the newest topics and polls from the reader's clubs, each locked by
 * that club's own page line (the reader's shelf page on the club book).
 */
export async function getFeed(
  db: Executor,
  userId: string,
  now: Date,
): Promise<CommunityFeedResponse> {
  const memberships = await db
    .select({
      id: clubs.id,
      name: clubs.name,
      icon: clubs.icon,
      ownerUserId: clubs.ownerUserId,
      bookTitle: books.title,
      readerPage: sql<number>`coalesce((select e."current_page" from "shelf_entries" e where e."user_id" = ${userId} and e."book_id" = ${clubs.bookId}), 0)::int`,
    })
    .from(clubMembers)
    .innerJoin(clubs, eq(clubs.id, clubMembers.clubId))
    .innerJoin(books, eq(books.id, clubs.bookId))
    .where(eq(clubMembers.userId, userId));
  if (memberships.length === 0) return { items: [], newLast24h: 0 };

  const byId = new Map(memberships.map((club) => [club.id, club]));
  const clubIds = memberships.map((club) => club.id);
  const contextFor = (clubId: string): ViewContext => ({
    userId,
    readerPage: Number(byId.get(clubId)?.readerPage ?? 0),
    isOwner: byId.get(clubId)?.ownerUserId === userId,
    revealed: false,
  });
  const clubOf = (clubId: string) => {
    const club = byId.get(clubId);
    if (!club) throw new Error('feed club missing');
    return {
      id: club.id,
      name: club.name,
      icon: clubIconSchema.parse(club.icon),
      bookTitle: club.bookTitle,
      readerPage: Number(club.readerPage),
    };
  };

  const postRows = await db
    .select(postColumns(userId))
    .from(clubPosts)
    .innerJoin(users, eq(users.id, clubPosts.authorUserId))
    .where(and(inArray(clubPosts.clubId, clubIds), ...postFilters(userId)))
    .orderBy(desc(clubPosts.createdAt), desc(clubPosts.id))
    .limit(FEED_LIMIT);
  const pollRows = await pollSelect(db)
    .where(and(inArray(clubPolls.clubId, clubIds), ...pollFilters(userId)))
    .orderBy(desc(clubPolls.createdAt), desc(clubPolls.id))
    .limit(FEED_LIMIT);

  const topics: FeedItem[] = postRows
    .filter((row) => visibleTo(contextFor(row.post.clubId), row.post.status, row.post.authorUserId))
    .map((row) => ({
      type: 'topic',
      club: clubOf(row.post.clubId),
      post: toPost(row, contextFor(row.post.clubId)),
    }));
  const polls = await mapPolls(db, pollRows, (row) => contextFor(row.poll.clubId), now);
  const pollItems: FeedItem[] = polls.map((poll, index) => {
    const row = pollRows.find((candidate) => candidate.poll.id === poll.id) ?? pollRows[index];
    return { type: 'poll', club: clubOf(row?.poll.clubId ?? ''), poll };
  });

  const createdAt = (item: FeedItem) =>
    Date.parse(item.type === 'topic' ? item.post.createdAt : item.poll.createdAt);
  const items = [...topics, ...pollItems]
    .sort((a, b) => createdAt(b) - createdAt(a))
    .slice(0, FEED_LIMIT);

  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [fresh] = await db
    .select({
      topics: sql<number>`count(*)::int`,
    })
    .from(clubPosts)
    .where(
      and(
        inArray(clubPosts.clubId, clubIds),
        eq(clubPosts.status, 'visible'),
        gte(clubPosts.createdAt, since),
      ),
    );
  const [freshPolls] = await db
    .select({ polls: sql<number>`count(*)::int` })
    .from(clubPolls)
    .where(
      and(
        inArray(clubPolls.clubId, clubIds),
        eq(clubPolls.status, 'visible'),
        gte(clubPolls.createdAt, since),
      ),
    );

  return communityFeedResponseSchema.parse({
    items,
    newLast24h: Number(fresh?.topics ?? 0) + Number(freshPolls?.polls ?? 0),
  });
}
