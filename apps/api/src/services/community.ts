import {
  type BlocksResponse,
  type ClubDetail,
  type ClubPost,
  type ClubPostsResponse,
  type ClubReply,
  type ClubSummary,
  type ClubTopicResponse,
  type ClubsResponse,
  type CreateClubInput,
  type CreatePostInput,
  type CreateReplyRequest,
  type ModerationRequest,
  type ReactionCounts,
  type ReactionRequest,
  type ReactionResponse,
  type ReportRequest,
  blocksResponseSchema,
  clubDetailSchema,
  clubPostSchema,
  clubReplySchema,
  clubSummarySchema,
} from '@bubo/contracts';
import { type Database, type Executor, schema } from '@bubo/database';
import {
  type ModerationStatus,
  REACTION_KINDS,
  type ReactionKind,
  canSeeModerated,
  inviteCodeFromBytes,
  isSpoilerLocked,
  normalizeInviteCode,
  replySpoilerPage,
  friendPairId,
  statusAfterReport,
} from '@bubo/domain';
import { levelForXp } from '@bubo/scoring';
import { type AnyColumn, type SQL, and, asc, desc, eq, ne, or, sql } from 'drizzle-orm';

import { AppError } from '../lib/errors';
import { bookCoverUrls, findEntry } from './shelf';

const {
  books,
  clubMembers,
  clubPollArguments,
  clubPolls,
  clubPosts,
  clubReactions,
  clubReplies,
  clubs,
  contentReports,
  shelfEntries,
  userBlocks,
  users,
} = schema;

type ClubRow = typeof clubs.$inferSelect;
type BookRow = typeof books.$inferSelect;
type PostRow = typeof clubPosts.$inferSelect;
type ReplyRow = typeof clubReplies.$inferSelect;

/** Clubs one reader may own at a time (anti-abuse; raise when there is moderation tooling). */
export const MAX_OWNED_CLUBS = 5;
const DISCOVER_LIMIT = 30;
const POSTS_LIMIT = 100;
const REPLIES_LIMIT = 200;

export type TargetType = 'post' | 'reply' | 'poll' | 'argument';

export function invalid(path: string, message: string): never {
  throw new AppError('VALIDATION_FAILED', 'Some fields are invalid.', {
    issues: [{ path, message }],
  });
}

export function asStatus(value: string): ModerationStatus {
  return value === 'hidden' || value === 'removed' ? value : 'visible';
}

// ---------------------------------------------------------------------------------------------
// Shared SQL fragments (also used by polls, members and the feed)
// ---------------------------------------------------------------------------------------------

/** Total XP of a reader from real sessions and reviews (ADR-014), for the author level. */
export const xpOf = (user: AnyColumn | SQL) =>
  sql<number>`((select coalesce(sum(s."xp_earned"), 0) from "reading_sessions" s where s."user_id" = ${user}) + (select coalesce(sum(l."xp_earned"), 0) from "review_logs" l where l."user_id" = ${user}))::int`;

export const notBlocked = (userId: string, author: AnyColumn) =>
  sql`not exists (select 1 from "user_blocks" b where b."blocker_user_id" = ${userId} and b."blocked_user_id" = ${author})`;

export const notReportedBy = (userId: string, type: TargetType, id: AnyColumn) =>
  sql`not exists (select 1 from "reading_club_reports" cr where cr."reporter_user_id" = ${userId} and cr."target_type" = ${type} and cr."target_id" = ${id})`;

export const openReportCount = (type: TargetType, id: AnyColumn) =>
  sql<number>`(select count(*)::int from "reading_club_reports" cr where cr."target_type" = ${type} and cr."target_id" = ${id} and cr."status" = 'open')`;

/** Reaction counts per kind and the reader's own reactions ("insight,idea"), in one select. */
export function reactionColumns(userId: string, type: 'post' | 'argument', id: AnyColumn) {
  const count = (kind: ReactionKind) =>
    sql<number>`(select count(*)::int from "reading_club_reactions" x where x."target_type" = ${type} and x."target_id" = ${id} and x."kind" = ${kind})`;
  return {
    insight: count('insight'),
    idea: count('idea'),
    counterpoint: count('counterpoint'),
    mine: sql<
      string | null
    >`(select string_agg(x."kind", ',' order by x."kind") from "reading_club_reactions" x where x."user_id" = ${userId} and x."target_type" = ${type} and x."target_id" = ${id})`,
  };
}

export type ReactionRow = {
  insight: number;
  idea: number;
  counterpoint: number;
  mine: string | null;
};

export function toReactions(row: ReactionRow): {
  reactions: ReactionCounts;
  myReactions: ReactionKind[];
} {
  const mine = (row.mine ?? '')
    .split(',')
    .filter((kind): kind is ReactionKind => (REACTION_KINDS as readonly string[]).includes(kind));
  return {
    reactions: {
      insight: Number(row.insight),
      idea: Number(row.idea),
      counterpoint: Number(row.counterpoint),
    },
    myReactions: mine,
  };
}

export function authorOf(id: string, name: string, xp: number) {
  return { id, name, level: levelForXp(Number(xp)).level };
}

// ---------------------------------------------------------------------------------------------
// Clubs
// ---------------------------------------------------------------------------------------------

function summaryColumns(userId: string) {
  return {
    club: clubs,
    book: books,
    ownerName: sql<string>`(select u."name" from "users" u where u."id" = ${clubs.ownerUserId})`,
    memberCount: sql<number>`(select count(*)::int from "reading_club_members" m where m."club_id" = ${clubs.id})`,
    topicCount: sql<number>`(select count(*)::int from "reading_club_posts" p where p."club_id" = ${clubs.id} and p."status" = 'visible')`,
    role: sql<
      string | null
    >`(select m."role" from "reading_club_members" m where m."club_id" = ${clubs.id} and m."user_id" = ${userId})`,
    myPage: sql<
      number | null
    >`(select e."current_page" from "shelf_entries" e where e."user_id" = ${userId} and e."book_id" = ${clubs.bookId})`,
  };
}

type SummaryRow = {
  club: ClubRow;
  book: BookRow;
  ownerName: string;
  memberCount: number;
  topicCount: number;
  role: string | null;
  myPage: number | null;
};

function toSummary(row: SummaryRow): ClubSummary {
  return clubSummarySchema.parse({
    id: row.club.id,
    name: row.club.name,
    description: row.club.description,
    icon: row.club.icon,
    book: {
      id: row.book.id,
      title: row.book.title,
      author: row.book.author,
      totalPages: row.book.totalPages,
      coverUrls: bookCoverUrls(row.book),
    },
    weeklyGoalPages: row.club.weeklyGoalPages,
    visibility: row.club.visibility === 'private' ? 'private' : 'public',
    ownerName: row.ownerName,
    memberCount: Number(row.memberCount),
    topicCount: Number(row.topicCount),
    membership: row.role === 'owner' || row.role === 'member' ? row.role : null,
    onMyShelf: row.myPage !== null,
    myPage: row.myPage === null ? null : Number(row.myPage),
    createdAt: row.club.createdAt.toISOString(),
  });
}

/** Escapes LIKE wildcards so a search for "100%" means the text, not a pattern. */
function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

const isMemberSql = (userId: string) =>
  sql`exists (select 1 from "reading_club_members" m where m."club_id" = ${clubs.id} and m."user_id" = ${userId})`;

/** Mine (any visibility) and public clubs to discover; private clubs are reachable by invite only. */
export async function listClubs(db: Executor, userId: string, q: string): Promise<ClubsResponse> {
  const term = q.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 80);
  const search = term
    ? or(
        sql`${clubs.name} ilike ${likePattern(term)}`,
        sql`${books.title} ilike ${likePattern(term)}`,
      )
    : undefined;
  const base = () =>
    db.select(summaryColumns(userId)).from(clubs).innerJoin(books, eq(books.id, clubs.bookId));

  const mine = await base()
    .where(and(isMemberSql(userId), search))
    .orderBy(desc(clubs.createdAt));
  const discover = await base()
    .where(and(sql`not ${isMemberSql(userId)}`, eq(clubs.visibility, 'public'), search))
    .orderBy(
      // Clubs about a book already on the reader's shelf first (Stitch "Afinidade do Bubo").
      desc(
        sql`exists (select 1 from "shelf_entries" e where e."user_id" = ${userId} and e."book_id" = ${clubs.bookId})`,
      ),
      desc(sql`(select count(*) from "reading_club_members" m where m."club_id" = ${clubs.id})`),
      desc(clubs.createdAt),
    )
    .limit(DISCOVER_LIMIT);
  return { mine: mine.map(toSummary), discover: discover.map(toSummary) };
}

export async function loadClub(db: Executor, clubId: string) {
  const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
  if (!club) throw new AppError('NOT_FOUND', 'Club not found.');
  return club;
}

export async function roleIn(db: Executor, clubId: string, userId: string) {
  const [row] = await db
    .select({ role: clubMembers.role })
    .from(clubMembers)
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId)))
    .limit(1);
  return row?.role === 'owner' || row?.role === 'member' ? row.role : null;
}

export async function requireMember(db: Executor, clubId: string, userId: string) {
  const club = await loadClub(db, clubId);
  const role = await roleIn(db, clubId, userId);
  if (!role && club.visibility === 'private') throw new AppError('NOT_FOUND', 'Club not found.');
  if (!role) throw new AppError('FORBIDDEN', 'Join the club to see and write debates.');
  return { club, role, isOwner: club.ownerUserId === userId };
}

/** The reader's page on the club's book, from their own shelf (0 when not shelved). */
export async function readerPageFor(db: Executor, userId: string, bookId: string) {
  const [row] = await db
    .select({ page: shelfEntries.currentPage })
    .from(shelfEntries)
    .where(and(eq(shelfEntries.userId, userId), eq(shelfEntries.bookId, bookId)))
    .limit(1);
  return row?.page ?? 0;
}

/** Open reports whose target still exists and was not removed. */
async function openReportsForClub(db: Executor, clubId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contentReports)
    .where(
      and(
        eq(contentReports.clubId, clubId),
        eq(contentReports.status, 'open'),
        sql`(
          (${contentReports.targetType} = 'post' and exists (select 1 from "reading_club_posts" p where p."id" = ${contentReports.targetId} and p."status" <> 'removed'))
          or (${contentReports.targetType} = 'reply' and exists (select 1 from "reading_club_replies" r where r."id" = ${contentReports.targetId} and r."status" <> 'removed'))
          or (${contentReports.targetType} = 'poll' and exists (select 1 from "reading_club_polls" q where q."id" = ${contentReports.targetId} and q."status" <> 'removed'))
          or (${contentReports.targetType} = 'argument' and exists (select 1 from "reading_club_poll_arguments" a where a."id" = ${contentReports.targetId} and a."status" <> 'removed'))
        )`,
      ),
    );
  return Number(row?.count ?? 0);
}

function newInviteCode() {
  return inviteCodeFromBytes(crypto.getRandomValues(new Uint8Array(8)));
}

/** Sets a fresh unique invite code (a collision retries; 31^8 codes make it practically never). */
async function assignInviteCode(db: Executor, clubId: string, onlyIfMissing: boolean) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = newInviteCode();
    const [taken] = await db
      .select({ id: clubs.id })
      .from(clubs)
      .where(eq(clubs.inviteCode, code))
      .limit(1);
    if (taken) continue;
    const updated = await db
      .update(clubs)
      .set({ inviteCode: code })
      .where(
        onlyIfMissing
          ? and(eq(clubs.id, clubId), sql`${clubs.inviteCode} is null`)
          : eq(clubs.id, clubId),
      )
      .returning({ inviteCode: clubs.inviteCode });
    if (updated[0]?.inviteCode) return updated[0].inviteCode;
    // Someone else set it concurrently: read it back.
    const [current] = await db
      .select({ inviteCode: clubs.inviteCode })
      .from(clubs)
      .where(eq(clubs.id, clubId))
      .limit(1);
    if (current?.inviteCode) return current.inviteCode;
  }
  throw new AppError('INTERNAL_ERROR', 'Could not create an invite code.');
}

export async function getClub(db: Executor, userId: string, clubId: string): Promise<ClubDetail> {
  const [row] = await db
    .select(summaryColumns(userId))
    .from(clubs)
    .innerJoin(books, eq(books.id, clubs.bookId))
    .where(eq(clubs.id, clubId))
    .limit(1);
  if (!row) throw new AppError('NOT_FOUND', 'Club not found.');
  const summary = toSummary(row);
  const member = summary.membership !== null;
  // Private clubs do not exist for outsiders (they arrive through the invite preview).
  if (!member && summary.visibility === 'private') {
    throw new AppError('NOT_FOUND', 'Club not found.');
  }
  const readerPage = member ? await readerPageFor(db, userId, row.book.id) : null;
  const [counts] = await db
    .select({
      unlocked: sql<number>`(select count(*)::int from "reading_club_posts" p where p."club_id" = ${clubId} and p."status" = 'visible' and p."spoiler_page" <= ${readerPage ?? 0})`,
      polls: sql<number>`(select count(*)::int from "reading_club_polls" q where q."club_id" = ${clubId} and q."status" = 'visible')`,
      joinedAt: sql<Date | null>`(select m."joined_at" from "reading_club_members" m where m."club_id" = ${clubId} and m."user_id" = ${userId})`,
    })
    .from(clubs)
    .where(eq(clubs.id, clubId));
  const joinedAt = counts?.joinedAt ? new Date(counts.joinedAt) : null;
  return clubDetailSchema.parse({
    ...summary,
    readerPage,
    unlockedTopicCount: member ? Number(counts?.unlocked ?? 0) : null,
    pollCount: Number(counts?.polls ?? 0),
    openReports: row.club.ownerUserId === userId ? await openReportsForClub(db, clubId) : null,
    inviteCode: member ? (row.club.inviteCode ?? (await assignInviteCode(db, clubId, true))) : null,
    joinedAt: joinedAt ? joinedAt.toISOString() : null,
  });
}

export async function createClub(
  db: Database,
  userId: string,
  data: CreateClubInput,
): Promise<ClubDetail> {
  const clubId = await db.transaction(async (tx) => {
    const [owned] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(clubs)
      .where(eq(clubs.ownerUserId, userId));
    if (Number(owned?.count ?? 0) >= MAX_OWNED_CLUBS) {
      throw new AppError('CONFLICT', `You can own at most ${MAX_OWNED_CLUBS} clubs.`);
    }
    const { book } = await findEntry(tx, userId, data.shelfEntryId);
    // Only shared catalog books: every member must be able to shelve the very same edition.
    if (!book.catalogKey) invalid('shelfEntryId', 'Choose a book added from the catalog.');
    const id = crypto.randomUUID();
    await tx.insert(clubs).values({
      id,
      ownerUserId: userId,
      name: data.name,
      description: data.description,
      icon: data.icon,
      bookId: book.id,
      weeklyGoalPages: data.weeklyGoalPages,
      visibility: data.visibility,
    });
    await tx.insert(clubMembers).values({ clubId: id, userId, role: 'owner' });
    await assignInviteCode(tx, id, true);
    return id;
  });
  return getClub(db, userId, clubId);
}

async function addMember(db: Database, userId: string, club: ClubRow) {
  await db.transaction(async (tx) => {
    await tx
      .insert(clubMembers)
      .values({ clubId: club.id, userId, role: 'member' })
      .onConflictDoNothing({ target: [clubMembers.clubId, clubMembers.userId] });
    await tx
      .insert(shelfEntries)
      .values({
        id: crypto.randomUUID(),
        userId,
        bookId: club.bookId,
        status: 'want_to_read',
        currentPage: 0,
      })
      .onConflictDoNothing({ target: [shelfEntries.userId, shelfEntries.bookId] });
  });
}

/** Joins a public club (idempotent) and shelves its book. Private clubs need an invite code. */
export async function joinClub(db: Database, userId: string, clubId: string): Promise<ClubDetail> {
  const club = await loadClub(db, clubId);
  if (club.visibility === 'private' && !(await roleIn(db, clubId, userId))) {
    throw new AppError('NOT_FOUND', 'Club not found.');
  }
  await addMember(db, userId, club);
  return getClub(db, userId, clubId);
}

async function clubByCode(db: Executor, rawCode: string) {
  const code = normalizeInviteCode(rawCode);
  if (!code) throw new AppError('NOT_FOUND', 'Invite not found.');
  const [club] = await db.select().from(clubs).where(eq(clubs.inviteCode, code)).limit(1);
  if (!club) throw new AppError('NOT_FOUND', 'Invite not found.');
  return club;
}

export async function previewInvite(db: Executor, userId: string, code: string) {
  const club = await clubByCode(db, code);
  const [row] = await db
    .select(summaryColumns(userId))
    .from(clubs)
    .innerJoin(books, eq(books.id, clubs.bookId))
    .where(eq(clubs.id, club.id))
    .limit(1);
  if (!row) throw new AppError('NOT_FOUND', 'Invite not found.');
  return toSummary(row);
}

export async function joinByCode(db: Database, userId: string, code: string): Promise<ClubDetail> {
  const club = await clubByCode(db, code);
  await addMember(db, userId, club);
  return getClub(db, userId, club.id);
}

/** Owner only: invalidates the previous code (old links stop working). */
export async function regenerateInviteCode(db: Executor, userId: string, clubId: string) {
  const club = await loadClub(db, clubId);
  if (club.ownerUserId !== userId) throw new AppError('FORBIDDEN', 'Club owner only.');
  return { inviteCode: await assignInviteCode(db, clubId, false) };
}

export async function leaveClub(db: Executor, userId: string, clubId: string) {
  const club = await loadClub(db, clubId);
  if (club.ownerUserId === userId) {
    throw new AppError('CONFLICT', 'The owner cannot leave; delete the club instead.');
  }
  await db
    .delete(clubMembers)
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId)));
}

export async function deleteClub(db: Executor, userId: string, clubId: string) {
  const club = await loadClub(db, clubId);
  if (club.ownerUserId !== userId) throw new AppError('FORBIDDEN', 'Only the owner can delete.');
  await db.delete(clubs).where(eq(clubs.id, clubId));
}

// ---------------------------------------------------------------------------------------------
// Topics and replies
// ---------------------------------------------------------------------------------------------

export type ViewContext = {
  userId: string;
  readerPage: number;
  isOwner: boolean;
  revealed: boolean;
};

export function visibleTo(ctx: ViewContext, status: string, authorId: string) {
  return canSeeModerated({
    status: asStatus(status),
    isAuthor: authorId === ctx.userId,
    isClubOwner: ctx.isOwner,
  });
}

export type PostRowView = {
  post: PostRow;
  authorName: string;
  authorXp: number;
  replyCount: number;
  reports: number;
} & ReactionRow;

export function toPost(row: PostRowView, ctx: ViewContext): ClubPost {
  const isMine = row.post.authorUserId === ctx.userId;
  const locked = isSpoilerLocked({
    spoilerPage: row.post.spoilerPage,
    readerPage: ctx.readerPage,
    isMine,
    revealed: ctx.revealed,
  });
  return clubPostSchema.parse({
    id: row.post.id,
    author: authorOf(row.post.authorUserId, row.authorName, row.authorXp),
    kind: row.post.kind,
    chapter: row.post.chapter,
    spoilerPage: row.post.spoilerPage,
    createdAt: row.post.createdAt.toISOString(),
    replyCount: Number(row.replyCount),
    isMine,
    moderation: row.post.status === 'hidden' ? 'hidden' : 'visible',
    openReportCount: ctx.isOwner ? Number(row.reports) : null,
    locked,
    title: locked ? null : row.post.title,
    body: locked ? null : row.post.body,
    quote: locked ? null : row.post.quote,
    reviewRating: locked ? null : row.post.reviewRating,
    isBookReview: row.post.reviewRating !== null,
    reviewTags: locked ? [] : row.post.reviewTags,
    ...toReactions(row),
  });
}

function toReply(
  row: { reply: ReplyRow; authorName: string; authorXp: number; reports: number },
  ctx: ViewContext,
): ClubReply {
  const isMine = row.reply.authorUserId === ctx.userId;
  const locked = isSpoilerLocked({
    spoilerPage: row.reply.spoilerPage,
    readerPage: ctx.readerPage,
    isMine,
    revealed: ctx.revealed,
  });
  return clubReplySchema.parse({
    id: row.reply.id,
    author: authorOf(row.reply.authorUserId, row.authorName, row.authorXp),
    spoilerPage: row.reply.spoilerPage,
    createdAt: row.reply.createdAt.toISOString(),
    isMine,
    moderation: row.reply.status === 'hidden' ? 'hidden' : 'visible',
    openReportCount: ctx.isOwner ? Number(row.reports) : null,
    locked,
    body: locked ? null : row.reply.body,
  });
}

export function postColumns(userId: string) {
  return {
    post: clubPosts,
    authorName: users.name,
    authorXp: xpOf(clubPosts.authorUserId),
    replyCount: sql<number>`(select count(*)::int from "reading_club_replies" r where r."post_id" = ${clubPosts.id} and r."status" = 'visible' and not exists (select 1 from "user_blocks" b where b."blocker_user_id" = ${userId} and b."blocked_user_id" = r."author_user_id"))`,
    reports: openReportCount('post', clubPosts.id),
    ...reactionColumns(userId, 'post', clubPosts.id),
  };
}

/** Conditions every reader-facing topic query applies (never removed, blocked or self-reported). */
export function postFilters(userId: string) {
  return [
    ne(clubPosts.status, 'removed'),
    notBlocked(userId, clubPosts.authorUserId),
    notReportedBy(userId, 'post', clubPosts.id),
  ];
}

export async function viewContext(db: Executor, userId: string, clubId: string, revealed: boolean) {
  const { club, isOwner } = await requireMember(db, clubId, userId);
  const readerPage = await readerPageFor(db, userId, club.bookId);
  return { club, ctx: { userId, readerPage, isOwner, revealed } satisfies ViewContext };
}

export async function listPosts(
  db: Executor,
  userId: string,
  clubId: string,
  reviewsOnly = false,
): Promise<ClubPostsResponse> {
  const { ctx } = await viewContext(db, userId, clubId, false);
  const rows = await db
    .select(postColumns(userId))
    .from(clubPosts)
    .innerJoin(users, eq(users.id, clubPosts.authorUserId))
    .where(
      and(
        eq(clubPosts.clubId, clubId),
        ...(reviewsOnly ? [sql`${clubPosts.reviewRating} IS NOT NULL`] : []),
        ...postFilters(userId),
      ),
    )
    .orderBy(desc(clubPosts.createdAt), desc(clubPosts.id))
    .limit(POSTS_LIMIT);
  return {
    readerPage: ctx.readerPage,
    posts: rows
      .filter((row) => visibleTo(ctx, row.post.status, row.post.authorUserId))
      .map((row) => toPost(row, ctx)),
  };
}

async function findVisiblePost(db: Executor, ctx: ViewContext, clubId: string, postId: string) {
  const [row] = await db
    .select(postColumns(ctx.userId))
    .from(clubPosts)
    .innerJoin(users, eq(users.id, clubPosts.authorUserId))
    .where(and(eq(clubPosts.id, postId), eq(clubPosts.clubId, clubId), ...postFilters(ctx.userId)))
    .limit(1);
  if (!row || !visibleTo(ctx, row.post.status, row.post.authorUserId)) {
    throw new AppError('NOT_FOUND', 'Topic not found.');
  }
  return row;
}

export async function getTopic(
  db: Executor,
  userId: string,
  clubId: string,
  postId: string,
  revealed: boolean,
): Promise<ClubTopicResponse> {
  const { ctx } = await viewContext(db, userId, clubId, revealed);
  const post = await findVisiblePost(db, ctx, clubId, postId);
  const replies = await db
    .select({
      reply: clubReplies,
      authorName: users.name,
      authorXp: xpOf(clubReplies.authorUserId),
      reports: openReportCount('reply', clubReplies.id),
    })
    .from(clubReplies)
    .innerJoin(users, eq(users.id, clubReplies.authorUserId))
    .where(
      and(
        eq(clubReplies.postId, postId),
        ne(clubReplies.status, 'removed'),
        notBlocked(userId, clubReplies.authorUserId),
        notReportedBy(userId, 'reply', clubReplies.id),
      ),
    )
    .orderBy(asc(clubReplies.createdAt), asc(clubReplies.id))
    .limit(REPLIES_LIMIT);
  return {
    readerPage: ctx.readerPage,
    revealed,
    post: toPost(post, ctx),
    replies: replies
      .filter((row) => visibleTo(ctx, row.reply.status, row.reply.authorUserId))
      .map((row) => toReply(row, ctx)),
  };
}

export async function bookPages(db: Executor, bookId: string) {
  const [book] = await db
    .select({ totalPages: books.totalPages })
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1);
  return book?.totalPages ?? null;
}

export async function createPost(
  db: Database,
  userId: string,
  clubId: string,
  input: CreatePostInput,
): Promise<{ post: ClubPost; created: boolean }> {
  const { club, ctx } = await viewContext(db, userId, clubId, false);
  const [existing] = await db
    .select({ id: clubPosts.id, authorUserId: clubPosts.authorUserId, clubId: clubPosts.clubId })
    .from(clubPosts)
    .where(eq(clubPosts.id, input.id))
    .limit(1);
  if (existing) {
    if (existing.authorUserId !== userId || existing.clubId !== clubId) {
      throw new AppError('CONFLICT', 'Topic id already used.');
    }
    return { post: toPost(await findVisiblePost(db, ctx, clubId, input.id), ctx), created: false };
  }
  const totalPages = await bookPages(db, club.bookId);
  if (totalPages !== null && input.spoilerPage > totalPages) {
    invalid('spoilerPage', `Must be at most ${totalPages}.`);
  }
  const inserted = await db
    .insert(clubPosts)
    .values({
      id: input.id,
      clubId,
      authorUserId: userId,
      title: input.title,
      body: input.body,
      spoilerPage: input.spoilerPage,
      kind: input.kind,
      chapter: input.chapter,
      quote: input.quote ? input.quote : null,
      reviewRating: input.reviewRating,
      reviewTags: input.reviewTags,
    })
    .onConflictDoNothing({ target: clubPosts.id })
    .returning({ id: clubPosts.id });
  // A concurrent retry won the insert: apply the same rules as an existing id.
  if (inserted.length === 0) return createPost(db, userId, clubId, input);
  return { post: toPost(await findVisiblePost(db, ctx, clubId, input.id), ctx), created: true };
}

export async function createReply(
  db: Database,
  userId: string,
  clubId: string,
  postId: string,
  input: CreateReplyRequest,
): Promise<{ reply: ClubReply; created: boolean }> {
  const { club, ctx } = await viewContext(db, userId, clubId, false);
  const topic = await findVisiblePost(db, ctx, clubId, postId);
  const load = async () => {
    const [row] = await db
      .select({
        reply: clubReplies,
        authorName: users.name,
        authorXp: xpOf(clubReplies.authorUserId),
        reports: openReportCount('reply', clubReplies.id),
      })
      .from(clubReplies)
      .innerJoin(users, eq(users.id, clubReplies.authorUserId))
      .where(eq(clubReplies.id, input.id))
      .limit(1);
    if (!row) throw new AppError('INTERNAL_ERROR', 'Could not load the reply.');
    return toReply(row, ctx);
  };
  const [existing] = await db
    .select({ authorUserId: clubReplies.authorUserId, postId: clubReplies.postId })
    .from(clubReplies)
    .where(eq(clubReplies.id, input.id))
    .limit(1);
  if (existing) {
    if (existing.authorUserId !== userId || existing.postId !== postId) {
      throw new AppError('CONFLICT', 'Reply id already used.');
    }
    return { reply: await load(), created: false };
  }
  const spoilerPage = replySpoilerPage(topic.post.spoilerPage, input.spoilerPage);
  const totalPages = await bookPages(db, club.bookId);
  if (totalPages !== null && spoilerPage > totalPages) {
    invalid('spoilerPage', `Must be at most ${totalPages}.`);
  }
  const inserted = await db
    .insert(clubReplies)
    .values({ id: input.id, postId, clubId, authorUserId: userId, body: input.body, spoilerPage })
    .onConflictDoNothing({ target: clubReplies.id })
    .returning({ id: clubReplies.id });
  if (inserted.length === 0) return createReply(db, userId, clubId, postId, input);
  return { reply: await load(), created: true };
}

// ---------------------------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------------------------

/** Turns one reaction on or off (idempotent). Not on your own content; members only. */
export async function setReaction(
  db: Executor,
  userId: string,
  input: ReactionRequest,
): Promise<ReactionResponse> {
  const target = await findTarget(db, input.targetType, input.targetId);
  if (!target || asStatus(target.status) === 'removed') {
    throw new AppError('NOT_FOUND', 'Content not found.');
  }
  if (!(await roleIn(db, target.clubId, userId))) {
    throw new AppError('FORBIDDEN', 'Join the club to react.');
  }
  if (target.authorUserId === userId) invalid('targetId', 'You cannot react to your own content.');
  if (input.active) {
    await db
      .insert(clubReactions)
      .values({
        userId,
        clubId: target.clubId,
        targetType: input.targetType,
        targetId: input.targetId,
        kind: input.kind,
      })
      .onConflictDoNothing({
        target: [
          clubReactions.userId,
          clubReactions.targetType,
          clubReactions.targetId,
          clubReactions.kind,
        ],
      });
  } else {
    await db
      .delete(clubReactions)
      .where(
        and(
          eq(clubReactions.userId, userId),
          eq(clubReactions.targetType, input.targetType),
          eq(clubReactions.targetId, input.targetId),
          eq(clubReactions.kind, input.kind),
        ),
      );
  }
  const idColumn = sql`${input.targetId}`;
  const counts = (kind: ReactionKind) =>
    sql<number>`(select count(*)::int from "reading_club_reactions" x where x."target_type" = ${input.targetType} and x."target_id" = ${idColumn} and x."kind" = ${kind})`;
  const [row] = await db
    .select({
      insight: counts('insight'),
      idea: counts('idea'),
      counterpoint: counts('counterpoint'),
      mine: sql<
        string | null
      >`(select string_agg(x."kind", ',' order by x."kind") from "reading_club_reactions" x where x."user_id" = ${userId} and x."target_type" = ${input.targetType} and x."target_id" = ${idColumn})`,
    })
    .from(clubs)
    .where(eq(clubs.id, target.clubId));
  if (!row) throw new AppError('NOT_FOUND', 'Club not found.');
  return toReactions(row);
}

// ---------------------------------------------------------------------------------------------
// Moderation (topics, replies, polls, arguments)
// ---------------------------------------------------------------------------------------------

async function resolveReports(db: Executor, targetType: TargetType, targetId: string) {
  await db
    .update(contentReports)
    .set({ status: 'resolved' })
    .where(
      and(
        eq(contentReports.targetType, targetType),
        eq(contentReports.targetId, targetId),
        eq(contentReports.status, 'open'),
      ),
    );
}

const TARGET_TABLES = {
  post: clubPosts,
  reply: clubReplies,
  poll: clubPolls,
  argument: clubPollArguments,
} as const;

/** Loads any moderatable item (any status) with its club and author. */
export async function findTarget(db: Executor, targetType: TargetType, targetId: string) {
  const table = TARGET_TABLES[targetType];
  const [row] = await db
    .select({ clubId: table.clubId, authorUserId: table.authorUserId, status: table.status })
    .from(table)
    .where(eq(table.id, targetId))
    .limit(1);
  return row ?? null;
}

async function setStatus(
  db: Executor,
  targetType: TargetType,
  targetId: string,
  status: ModerationStatus,
) {
  const table = TARGET_TABLES[targetType];
  await db.update(table).set({ status }).where(eq(table.id, targetId));
}

async function deleteReportsAndReactions(db: Executor, targetType: TargetType, ids: SQL | string) {
  const match = typeof ids === 'string' ? sql`= ${ids}` : sql`in (${ids})`;
  await db
    .delete(contentReports)
    .where(
      and(eq(contentReports.targetType, targetType), sql`${contentReports.targetId} ${match}`),
    );
  await db
    .delete(clubReactions)
    .where(and(eq(clubReactions.targetType, targetType), sql`${clubReactions.targetId} ${match}`));
}

/**
 * The author deletes their own content for good (with its reports and reactions); the club owner
 * removes someone else's (kept as `removed` so it never reappears, and its reports are resolved).
 */
export async function deleteContent(
  db: Database,
  userId: string,
  clubId: string,
  targetType: TargetType,
  targetId: string,
) {
  await db.transaction(async (tx) => {
    const target = await findTarget(tx, targetType, targetId);
    if (!target || target.clubId !== clubId || target.status === 'removed') {
      throw new AppError('NOT_FOUND', 'Content not found.');
    }
    if (target.authorUserId === userId) {
      if (targetType === 'post') {
        await deleteReportsAndReactions(
          tx,
          'reply',
          sql`select r."id" from "reading_club_replies" r where r."post_id" = ${targetId}`,
        );
      }
      if (targetType === 'poll') {
        await deleteReportsAndReactions(
          tx,
          'argument',
          sql`select a."id" from "reading_club_poll_arguments" a where a."poll_id" = ${targetId}`,
        );
      }
      await deleteReportsAndReactions(tx, targetType, targetId);
      const table = TARGET_TABLES[targetType];
      await tx.delete(table).where(eq(table.id, targetId));
      return;
    }
    const club = await loadClub(tx, clubId);
    if (club.ownerUserId !== userId) {
      throw new AppError('FORBIDDEN', 'Only the author or the club owner can remove this.');
    }
    await setStatus(tx, targetType, targetId, 'removed');
    await resolveReports(tx, targetType, targetId);
  });
}

export async function moderate(
  db: Database,
  userId: string,
  clubId: string,
  input: ModerationRequest,
  globalModerator = false,
): Promise<{ status: 'visible' | 'removed' }> {
  return db.transaction(async (tx) => {
    const club = await loadClub(tx, clubId);
    if (club.ownerUserId !== userId && !globalModerator)
      throw new AppError('FORBIDDEN', 'Club owner only.');
    if (globalModerator) {
      const [report] = await tx
        .select({ id: contentReports.id })
        .from(contentReports)
        .where(
          and(
            eq(contentReports.clubId, clubId),
            eq(contentReports.targetType, input.targetType),
            eq(contentReports.targetId, input.targetId),
            eq(contentReports.status, 'open'),
          ),
        )
        .limit(1);
      if (!report) throw new AppError('NOT_FOUND', 'Open report not found.');
    }
    const target = await findTarget(tx, input.targetType, input.targetId);
    if (!target || target.clubId !== clubId) throw new AppError('NOT_FOUND', 'Content not found.');
    const status = input.action === 'remove' ? 'removed' : 'visible';
    await setStatus(tx, input.targetType, input.targetId, status);
    await resolveReports(tx, input.targetType, input.targetId);
    return { status };
  });
}

/** One report per reader and item (idempotent); the threshold hides it for the owner to review. */
export async function reportContent(db: Database, userId: string, input: ReportRequest) {
  return db.transaction(async (tx) => {
    const target = await findTarget(tx, input.targetType, input.targetId);
    if (!target || target.status === 'removed') {
      throw new AppError('NOT_FOUND', 'Content not found.');
    }
    if (!(await roleIn(tx, target.clubId, userId))) {
      throw new AppError('FORBIDDEN', 'Join the club to report its content.');
    }
    if (target.authorUserId === userId) invalid('targetId', 'You cannot report your own content.');
    const inserted = await tx
      .insert(contentReports)
      .values({
        id: crypto.randomUUID(),
        reporterUserId: userId,
        clubId: target.clubId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        details: input.details ? input.details : null,
      })
      .onConflictDoNothing({
        target: [contentReports.reporterUserId, contentReports.targetType, contentReports.targetId],
      })
      .returning({ id: contentReports.id });
    const [counted] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(contentReports)
      .where(
        and(
          eq(contentReports.targetType, input.targetType),
          eq(contentReports.targetId, input.targetId),
          eq(contentReports.status, 'open'),
        ),
      );
    const current = asStatus(target.status);
    const next = statusAfterReport(current, Number(counted?.count ?? 0));
    if (next !== current) await setStatus(tx, input.targetType, input.targetId, next);
    return { created: inserted.length > 0, hidden: next === 'hidden' };
  });
}

// ---------------------------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------------------------

export async function listBlocks(db: Executor, userId: string): Promise<BlocksResponse> {
  const rows = await db
    .select({ userId: userBlocks.blockedUserId, name: users.name, createdAt: userBlocks.createdAt })
    .from(userBlocks)
    .innerJoin(users, eq(users.id, userBlocks.blockedUserId))
    .where(eq(userBlocks.blockerUserId, userId))
    .orderBy(desc(userBlocks.createdAt));
  return blocksResponseSchema.parse({
    blocks: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
  });
}

export async function blockUser(db: Database, userId: string, blockedUserId: string) {
  if (blockedUserId === userId) invalid('userId', 'You cannot block yourself.');
  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, blockedUserId))
    .limit(1);
  if (!target) throw new AppError('NOT_FOUND', 'Reader not found.');
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT id FROM users WHERE id IN (${userId}, ${blockedUserId}) ORDER BY id FOR UPDATE`,
    );
    await tx
      .insert(userBlocks)
      .values({ blockerUserId: userId, blockedUserId })
      .onConflictDoNothing({ target: [userBlocks.blockerUserId, userBlocks.blockedUserId] });
    await tx
      .delete(schema.friendships)
      .where(eq(schema.friendships.id, friendPairId(userId, blockedUserId)));
  });
  return listBlocks(db, userId);
}

export async function unblockUser(db: Executor, userId: string, blockedUserId: string) {
  await db
    .delete(userBlocks)
    .where(and(eq(userBlocks.blockerUserId, userId), eq(userBlocks.blockedUserId, blockedUserId)));
  return listBlocks(db, userId);
}
