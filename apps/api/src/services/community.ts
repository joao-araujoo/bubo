import {
  type BlocksResponse,
  type ClubDetail,
  type ClubPost,
  type ClubPostsResponse,
  type ClubReply,
  type ClubSummary,
  type ClubTopicResponse,
  type ClubsResponse,
  type CreateClubRequest,
  type CreatePostRequest,
  type CreateReplyRequest,
  type ModerationRequest,
  type ReportRequest,
  blocksResponseSchema,
  clubDetailSchema,
  clubPostSchema,
  clubReplySchema,
  clubSummarySchema,
  createClubRequestSchema,
} from '@bubo/contracts';
import { type Database, type Executor, schema } from '@bubo/database';
import {
  type ModerationStatus,
  canSeeModerated,
  isSpoilerLocked,
  replySpoilerPage,
  statusAfterReport,
} from '@bubo/domain';
import { type AnyColumn, and, asc, desc, eq, ne, or, sql } from 'drizzle-orm';

import { AppError } from '../lib/errors';
import { bookCoverUrls, findEntry } from './shelf';

const {
  books,
  clubMembers,
  clubPosts,
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

function invalid(path: string, message: string): never {
  throw new AppError('VALIDATION_FAILED', 'Some fields are invalid.', {
    issues: [{ path, message }],
  });
}

function asStatus(value: string): ModerationStatus {
  return value === 'hidden' || value === 'removed' ? value : 'visible';
}

// ---------------------------------------------------------------------------------------------
// Clubs
// ---------------------------------------------------------------------------------------------

function summaryColumns(userId: string) {
  return {
    club: clubs,
    book: books,
    memberCount: sql<number>`(select count(*)::int from "reading_club_members" m where m."club_id" = ${clubs.id})`,
    topicCount: sql<number>`(select count(*)::int from "reading_club_posts" p where p."club_id" = ${clubs.id} and p."status" = 'visible')`,
    role: sql<
      string | null
    >`(select m."role" from "reading_club_members" m where m."club_id" = ${clubs.id} and m."user_id" = ${userId})`,
  };
}

type SummaryRow = {
  club: ClubRow;
  book: BookRow;
  memberCount: number;
  topicCount: number;
  role: string | null;
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
    memberCount: Number(row.memberCount),
    topicCount: Number(row.topicCount),
    membership: row.role === 'owner' || row.role === 'member' ? row.role : null,
    createdAt: row.club.createdAt.toISOString(),
  });
}

/** Escapes LIKE wildcards so a search for "100%" means the text, not a pattern. */
function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export async function listClubs(db: Executor, userId: string, q: string): Promise<ClubsResponse> {
  const term = q.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 80);
  const search = term
    ? or(
        sql`${clubs.name} ilike ${likePattern(term)}`,
        sql`${books.title} ilike ${likePattern(term)}`,
      )
    : undefined;
  const isMember = sql`exists (select 1 from "reading_club_members" m where m."club_id" = ${clubs.id} and m."user_id" = ${userId})`;
  const base = () =>
    db.select(summaryColumns(userId)).from(clubs).innerJoin(books, eq(books.id, clubs.bookId));

  const mine = await base().where(and(isMember, search)).orderBy(desc(clubs.createdAt));
  const discover = await base()
    .where(and(sql`not ${isMember}`, search))
    .orderBy(
      desc(sql`(select count(*) from "reading_club_members" m where m."club_id" = ${clubs.id})`),
      desc(clubs.createdAt),
    )
    .limit(DISCOVER_LIMIT);
  return { mine: mine.map(toSummary), discover: discover.map(toSummary) };
}

async function loadClub(db: Executor, clubId: string) {
  const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
  if (!club) throw new AppError('NOT_FOUND', 'Club not found.');
  return club;
}

async function roleIn(db: Executor, clubId: string, userId: string) {
  const [row] = await db
    .select({ role: clubMembers.role })
    .from(clubMembers)
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId)))
    .limit(1);
  return row?.role === 'owner' || row?.role === 'member' ? row.role : null;
}

async function requireMember(db: Executor, clubId: string, userId: string) {
  const club = await loadClub(db, clubId);
  const role = await roleIn(db, clubId, userId);
  if (!role) throw new AppError('FORBIDDEN', 'Join the club to see and write debates.');
  return { club, role, isOwner: club.ownerUserId === userId };
}

/** The reader's page on the club's book, from their own shelf (0 when not shelved). */
async function readerPageFor(db: Executor, userId: string, bookId: string) {
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
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(contentReports)
    .where(
      and(
        eq(contentReports.clubId, clubId),
        eq(contentReports.status, 'open'),
        sql`(
          (${contentReports.targetType} = 'post' and exists (select 1 from "reading_club_posts" p where p."id" = ${contentReports.targetId} and p."status" <> 'removed'))
          or (${contentReports.targetType} = 'reply' and exists (select 1 from "reading_club_replies" r where r."id" = ${contentReports.targetId} and r."status" <> 'removed'))
        )`,
      ),
    );
  return Number(row?.count ?? 0);
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
  return clubDetailSchema.parse({
    ...summary,
    readerPage: summary.membership ? await readerPageFor(db, userId, row.book.id) : null,
    openReports: row.club.ownerUserId === userId ? await openReportsForClub(db, clubId) : null,
  });
}

export async function createClub(
  db: Database,
  userId: string,
  input: CreateClubRequest,
): Promise<ClubDetail> {
  const data = createClubRequestSchema.parse(input);
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
    });
    await tx.insert(clubMembers).values({ clubId: id, userId, role: 'owner' });
    return id;
  });
  return getClub(db, userId, clubId);
}

/** Joins (idempotent) and makes sure the club's book is on the reader's shelf. */
export async function joinClub(db: Database, userId: string, clubId: string): Promise<ClubDetail> {
  await db.transaction(async (tx) => {
    const club = await loadClub(tx, clubId);
    await tx
      .insert(clubMembers)
      .values({ clubId, userId, role: 'member' })
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
  return getClub(db, userId, clubId);
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

type ViewContext = { userId: string; readerPage: number; isOwner: boolean; revealed: boolean };

const notBlocked = (userId: string, author: AnyColumn) =>
  sql`not exists (select 1 from "user_blocks" b where b."blocker_user_id" = ${userId} and b."blocked_user_id" = ${author})`;

const notReportedBy = (userId: string, type: 'post' | 'reply', id: AnyColumn) =>
  sql`not exists (select 1 from "reading_club_reports" cr where cr."reporter_user_id" = ${userId} and cr."target_type" = ${type} and cr."target_id" = ${id})`;

const openReportCount = (type: 'post' | 'reply', id: AnyColumn) =>
  sql<number>`(select count(*)::int from "reading_club_reports" cr where cr."target_type" = ${type} and cr."target_id" = ${id} and cr."status" = 'open')`;

function visibleTo(ctx: ViewContext, status: string, authorId: string) {
  return canSeeModerated({
    status: asStatus(status),
    isAuthor: authorId === ctx.userId,
    isClubOwner: ctx.isOwner,
  });
}

function toPost(
  row: { post: PostRow; authorName: string; replyCount: number; reports: number },
  ctx: ViewContext,
): ClubPost {
  const isMine = row.post.authorUserId === ctx.userId;
  const locked = isSpoilerLocked({
    spoilerPage: row.post.spoilerPage,
    readerPage: ctx.readerPage,
    isMine,
    revealed: ctx.revealed,
  });
  return clubPostSchema.parse({
    id: row.post.id,
    author: { id: row.post.authorUserId, name: row.authorName },
    spoilerPage: row.post.spoilerPage,
    createdAt: row.post.createdAt.toISOString(),
    replyCount: Number(row.replyCount),
    isMine,
    moderation: row.post.status === 'hidden' ? 'hidden' : 'visible',
    openReportCount: ctx.isOwner ? Number(row.reports) : null,
    locked,
    title: locked ? null : row.post.title,
    body: locked ? null : row.post.body,
  });
}

function toReply(
  row: { reply: ReplyRow; authorName: string; reports: number },
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
    author: { id: row.reply.authorUserId, name: row.authorName },
    spoilerPage: row.reply.spoilerPage,
    createdAt: row.reply.createdAt.toISOString(),
    isMine,
    moderation: row.reply.status === 'hidden' ? 'hidden' : 'visible',
    openReportCount: ctx.isOwner ? Number(row.reports) : null,
    locked,
    body: locked ? null : row.reply.body,
  });
}

function postColumns(userId: string) {
  return {
    post: clubPosts,
    authorName: users.name,
    replyCount: sql<number>`(select count(*)::int from "reading_club_replies" r where r."post_id" = ${clubPosts.id} and r."status" = 'visible' and not exists (select 1 from "user_blocks" b where b."blocker_user_id" = ${userId} and b."blocked_user_id" = r."author_user_id"))`,
    reports: openReportCount('post', clubPosts.id),
  };
}

async function viewContext(db: Executor, userId: string, clubId: string, revealed: boolean) {
  const { club, isOwner } = await requireMember(db, clubId, userId);
  const readerPage = await readerPageFor(db, userId, club.bookId);
  return { club, ctx: { userId, readerPage, isOwner, revealed } satisfies ViewContext };
}

export async function listPosts(
  db: Executor,
  userId: string,
  clubId: string,
): Promise<ClubPostsResponse> {
  const { ctx } = await viewContext(db, userId, clubId, false);
  const rows = await db
    .select(postColumns(userId))
    .from(clubPosts)
    .innerJoin(users, eq(users.id, clubPosts.authorUserId))
    .where(
      and(
        eq(clubPosts.clubId, clubId),
        ne(clubPosts.status, 'removed'),
        notBlocked(userId, clubPosts.authorUserId),
        notReportedBy(userId, 'post', clubPosts.id),
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
    .where(
      and(
        eq(clubPosts.id, postId),
        eq(clubPosts.clubId, clubId),
        ne(clubPosts.status, 'removed'),
        notBlocked(ctx.userId, clubPosts.authorUserId),
        notReportedBy(ctx.userId, 'post', clubPosts.id),
      ),
    )
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

async function bookPages(db: Executor, bookId: string) {
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
  input: CreatePostRequest,
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

async function resolveReports(db: Executor, targetType: 'post' | 'reply', targetId: string) {
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

/** Loads a topic/reply of this club (any status) with its author. */
async function findTarget(db: Executor, targetType: 'post' | 'reply', targetId: string) {
  if (targetType === 'post') {
    const [row] = await db
      .select({
        clubId: clubPosts.clubId,
        authorUserId: clubPosts.authorUserId,
        status: clubPosts.status,
      })
      .from(clubPosts)
      .where(eq(clubPosts.id, targetId))
      .limit(1);
    return row ?? null;
  }
  const [row] = await db
    .select({
      clubId: clubReplies.clubId,
      authorUserId: clubReplies.authorUserId,
      status: clubReplies.status,
    })
    .from(clubReplies)
    .where(eq(clubReplies.id, targetId))
    .limit(1);
  return row ?? null;
}

async function setStatus(
  db: Executor,
  targetType: 'post' | 'reply',
  targetId: string,
  status: ModerationStatus,
) {
  if (targetType === 'post') {
    await db.update(clubPosts).set({ status }).where(eq(clubPosts.id, targetId));
  } else {
    await db.update(clubReplies).set({ status }).where(eq(clubReplies.id, targetId));
  }
}

/**
 * The author deletes their own content for good; the club owner removes someone else's (kept as
 * `removed` so it never reappears, and its reports are resolved).
 */
export async function deleteContent(
  db: Database,
  userId: string,
  clubId: string,
  targetType: 'post' | 'reply',
  targetId: string,
) {
  await db.transaction(async (tx) => {
    const target = await findTarget(tx, targetType, targetId);
    if (!target || target.clubId !== clubId || target.status === 'removed') {
      throw new AppError('NOT_FOUND', 'Content not found.');
    }
    if (target.authorUserId === userId) {
      if (targetType === 'post') {
        await tx
          .delete(contentReports)
          .where(
            and(
              eq(contentReports.targetType, 'reply'),
              sql`${contentReports.targetId} in (select r."id" from "reading_club_replies" r where r."post_id" = ${targetId})`,
            ),
          );
        await tx.delete(clubPosts).where(eq(clubPosts.id, targetId));
      } else {
        await tx.delete(clubReplies).where(eq(clubReplies.id, targetId));
      }
      await tx
        .delete(contentReports)
        .where(
          and(eq(contentReports.targetType, targetType), eq(contentReports.targetId, targetId)),
        );
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
): Promise<{ status: 'visible' | 'removed' }> {
  return db.transaction(async (tx) => {
    const club = await loadClub(tx, clubId);
    if (club.ownerUserId !== userId) throw new AppError('FORBIDDEN', 'Club owner only.');
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

export async function blockUser(db: Executor, userId: string, blockedUserId: string) {
  if (blockedUserId === userId) invalid('userId', 'You cannot block yourself.');
  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, blockedUserId))
    .limit(1);
  if (!target) throw new AppError('NOT_FOUND', 'Reader not found.');
  await db
    .insert(userBlocks)
    .values({ blockerUserId: userId, blockedUserId })
    .onConflictDoNothing({ target: [userBlocks.blockerUserId, userBlocks.blockedUserId] });
  return listBlocks(db, userId);
}

export async function unblockUser(db: Executor, userId: string, blockedUserId: string) {
  await db
    .delete(userBlocks)
    .where(and(eq(userBlocks.blockerUserId, userId), eq(userBlocks.blockedUserId, blockedUserId)));
  return listBlocks(db, userId);
}
