import {
  type ClubPoll,
  type ClubPollDetail,
  type ClubPollsResponse,
  type CreatePollInput,
  type PollArgument,
  clubPollSchema,
  pollArgumentSchema,
} from '@bubo/contracts';
import { type Database, type Executor, schema } from '@bubo/database';
import {
  canSeePollResults,
  isPollOpen,
  isSpoilerLocked,
  pollClosesAt,
  pollPercentages,
} from '@bubo/domain';
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';

import { AppError } from '../lib/errors';
import {
  type ViewContext,
  authorOf,
  bookPages,
  invalid,
  notBlocked,
  notReportedBy,
  openReportCount,
  reactionColumns,
  toReactions,
  viewContext,
  visibleTo,
  xpOf,
} from './community';

const { clubPollArguments, clubPollOptions, clubPollVotes, clubPolls, users } = schema;

type PollRow = typeof clubPolls.$inferSelect;
const POLLS_LIMIT = 50;
const ARGUMENTS_LIMIT = 100;

function pollColumns() {
  return {
    poll: clubPolls,
    authorName: users.name,
    authorXp: xpOf(clubPolls.authorUserId),
    reports: openReportCount('poll', clubPolls.id),
  };
}

type PollRowView = { poll: PollRow; authorName: string; authorXp: number; reports: number };

export function pollFilters(userId: string) {
  return [
    ne(clubPolls.status, 'removed'),
    notBlocked(userId, clubPolls.authorUserId),
    notReportedBy(userId, 'poll', clubPolls.id),
  ];
}

/**
 * Options, vote counts, the reader's votes, voters and visible arguments for several polls at
 * once (a handful of grouped queries instead of one per poll).
 */
async function pollExtras(db: Executor, userId: string, pollIds: string[]) {
  if (pollIds.length === 0) {
    return { options: [], counts: [], mine: [], voters: [], argumentCounts: [] };
  }
  const options = await db
    .select()
    .from(clubPollOptions)
    .where(inArray(clubPollOptions.pollId, pollIds))
    .orderBy(asc(clubPollOptions.position));
  const counts = await db
    .select({ optionId: clubPollVotes.optionId, votes: sql<number>`count(*)::int` })
    .from(clubPollVotes)
    .where(inArray(clubPollVotes.pollId, pollIds))
    .groupBy(clubPollVotes.optionId);
  const mine = await db
    .select({ pollId: clubPollVotes.pollId, optionId: clubPollVotes.optionId })
    .from(clubPollVotes)
    .where(and(inArray(clubPollVotes.pollId, pollIds), eq(clubPollVotes.userId, userId)));
  const voters = await db
    .select({
      pollId: clubPollVotes.pollId,
      voters: sql<number>`count(distinct ${clubPollVotes.userId})::int`,
    })
    .from(clubPollVotes)
    .where(inArray(clubPollVotes.pollId, pollIds))
    .groupBy(clubPollVotes.pollId);
  const argumentCounts = await db
    .select({ pollId: clubPollArguments.pollId, count: sql<number>`count(*)::int` })
    .from(clubPollArguments)
    .where(
      and(
        inArray(clubPollArguments.pollId, pollIds),
        eq(clubPollArguments.status, 'visible'),
        notBlocked(userId, clubPollArguments.authorUserId),
      ),
    )
    .groupBy(clubPollArguments.pollId);
  return { options, counts, mine, voters, argumentCounts };
}

type Extras = Awaited<ReturnType<typeof pollExtras>>;

function toPoll(row: PollRowView, extras: Extras, ctx: ViewContext, now: Date): ClubPoll {
  const poll = row.poll;
  const isMine = poll.authorUserId === ctx.userId;
  const locked = isSpoilerLocked({
    spoilerPage: poll.spoilerPage,
    readerPage: ctx.readerPage,
    isMine,
    revealed: ctx.revealed,
  });
  const options = extras.options.filter((option) => option.pollId === poll.id);
  const voteCounts = options.map(
    (option) => extras.counts.find((c) => c.optionId === option.id)?.votes ?? 0,
  );
  const mine = new Set(extras.mine.filter((v) => v.pollId === poll.id).map((v) => v.optionId));
  const open = isPollOpen(poll.closesAt, now);
  const resultsVisible =
    !locked && canSeePollResults({ hasVoted: mine.size > 0, isOpen: open, isAuthor: isMine });
  const percents = pollPercentages(voteCounts);
  return clubPollSchema.parse({
    id: poll.id,
    author: authorOf(poll.authorUserId, row.authorName, row.authorXp),
    spoilerPage: poll.spoilerPage,
    multiple: poll.multiple,
    createdAt: poll.createdAt.toISOString(),
    closesAt: poll.closesAt.toISOString(),
    isOpen: open,
    isMine,
    moderation: poll.status === 'hidden' ? 'hidden' : 'visible',
    openReportCount: ctx.isOwner ? Number(row.reports) : null,
    locked,
    question: locked ? null : poll.question,
    options: options.map((option, index) => ({
      id: option.id,
      label: locked ? null : option.label,
      votes: resultsVisible ? Number(voteCounts[index] ?? 0) : null,
      percent: resultsVisible ? (percents[index] ?? 0) : null,
      mine: mine.has(option.id),
    })),
    totalVotes: voteCounts.reduce((a, b) => a + Number(b), 0),
    voterCount: Number(extras.voters.find((v) => v.pollId === poll.id)?.voters ?? 0),
    resultsVisible,
    argumentCount: Number(extras.argumentCounts.find((a) => a.pollId === poll.id)?.count ?? 0),
  });
}

/** Maps poll rows to contract shapes for one reader (also used by the community feed). */
export async function mapPolls(
  db: Executor,
  rows: PollRowView[],
  contextFor: (row: PollRowView) => ViewContext,
  now: Date,
) {
  const visible = rows.filter((row) =>
    visibleTo(contextFor(row), row.poll.status, row.poll.authorUserId),
  );
  const first = visible[0];
  if (!first) return [];
  const extras = await pollExtras(
    db,
    contextFor(first).userId,
    visible.map((row) => row.poll.id),
  );
  return visible.map((row) => toPoll(row, extras, contextFor(row), now));
}

export function pollSelect(db: Executor) {
  return db
    .select(pollColumns())
    .from(clubPolls)
    .innerJoin(users, eq(users.id, clubPolls.authorUserId));
}

export async function listPolls(
  db: Executor,
  userId: string,
  clubId: string,
  now: Date,
): Promise<ClubPollsResponse> {
  const { ctx } = await viewContext(db, userId, clubId, false);
  const rows = await pollSelect(db)
    .where(and(eq(clubPolls.clubId, clubId), ...pollFilters(userId)))
    .orderBy(desc(clubPolls.createdAt), desc(clubPolls.id))
    .limit(POLLS_LIMIT);
  return { readerPage: ctx.readerPage, polls: await mapPolls(db, rows, () => ctx, now) };
}

async function findVisiblePoll(
  db: Executor,
  ctx: ViewContext,
  clubId: string,
  pollId: string,
  now: Date,
) {
  const rows = await pollSelect(db)
    .where(and(eq(clubPolls.id, pollId), eq(clubPolls.clubId, clubId), ...pollFilters(ctx.userId)))
    .limit(1);
  const [poll] = await mapPolls(db, rows, () => ctx, now);
  if (!poll) throw new AppError('NOT_FOUND', 'Poll not found.');
  return poll;
}

export async function getPoll(
  db: Executor,
  userId: string,
  clubId: string,
  pollId: string,
  revealed: boolean,
  now: Date,
): Promise<ClubPollDetail> {
  const { ctx } = await viewContext(db, userId, clubId, revealed);
  const poll = await findVisiblePoll(db, ctx, clubId, pollId, now);
  const rows = await db
    .select({
      argument: clubPollArguments,
      authorName: users.name,
      authorXp: xpOf(clubPollArguments.authorUserId),
      reports: openReportCount('argument', clubPollArguments.id),
      ...reactionColumns(userId, 'argument', clubPollArguments.id),
    })
    .from(clubPollArguments)
    .innerJoin(users, eq(users.id, clubPollArguments.authorUserId))
    .where(
      and(
        eq(clubPollArguments.pollId, pollId),
        ne(clubPollArguments.status, 'removed'),
        notBlocked(userId, clubPollArguments.authorUserId),
        notReportedBy(userId, 'argument', clubPollArguments.id),
      ),
    )
    .orderBy(desc(clubPollArguments.createdAt))
    .limit(ARGUMENTS_LIMIT);
  const authors = rows.map((row) => row.argument.authorUserId);
  const votes = authors.length
    ? await db
        .select({ userId: clubPollVotes.userId, label: clubPollOptions.label })
        .from(clubPollVotes)
        .innerJoin(clubPollOptions, eq(clubPollOptions.id, clubPollVotes.optionId))
        .where(and(eq(clubPollVotes.pollId, pollId), inArray(clubPollVotes.userId, authors)))
        .orderBy(asc(clubPollOptions.position))
    : [];
  const args: PollArgument[] = rows
    .filter((row) => visibleTo(ctx, row.argument.status, row.argument.authorUserId))
    .map((row) =>
      pollArgumentSchema.parse({
        id: row.argument.id,
        author: authorOf(row.argument.authorUserId, row.authorName, row.authorXp),
        votedFor: poll.locked
          ? []
          : votes.filter((v) => v.userId === row.argument.authorUserId).map((v) => v.label),
        // Arguments talk about the poll: they follow its anti-spoiler lock.
        body: poll.locked ? null : row.argument.body,
        createdAt: row.argument.createdAt.toISOString(),
        isMine: row.argument.authorUserId === userId,
        moderation: row.argument.status === 'hidden' ? 'hidden' : 'visible',
        openReportCount: ctx.isOwner ? Number(row.reports) : null,
        ...toReactions(row),
      }),
    );
  return { readerPage: ctx.readerPage, revealed, poll, arguments: args };
}

export async function createPoll(
  db: Database,
  userId: string,
  clubId: string,
  input: CreatePollInput,
  now: Date,
): Promise<{ poll: ClubPoll; created: boolean }> {
  const { club, ctx } = await viewContext(db, userId, clubId, false);
  const [existing] = await db
    .select({ authorUserId: clubPolls.authorUserId, clubId: clubPolls.clubId })
    .from(clubPolls)
    .where(eq(clubPolls.id, input.id))
    .limit(1);
  if (existing) {
    if (existing.authorUserId !== userId || existing.clubId !== clubId) {
      throw new AppError('CONFLICT', 'Poll id already used.');
    }
    return { poll: await findVisiblePoll(db, ctx, clubId, input.id, now), created: false };
  }
  const totalPages = await bookPages(db, club.bookId);
  if (totalPages !== null && input.spoilerPage > totalPages) {
    invalid('spoilerPage', `Must be at most ${totalPages}.`);
  }
  const created = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(clubPolls)
      .values({
        id: input.id,
        clubId,
        authorUserId: userId,
        question: input.question,
        spoilerPage: input.spoilerPage,
        multiple: input.multiple,
        closesAt: pollClosesAt(now, input.durationDays),
        createdAt: now,
      })
      .onConflictDoNothing({ target: clubPolls.id })
      .returning({ id: clubPolls.id });
    if (inserted.length === 0) return false;
    await tx.insert(clubPollOptions).values(
      input.options.map((label, position) => ({
        id: crypto.randomUUID(),
        pollId: input.id,
        position,
        label,
      })),
    );
    return true;
  });
  if (!created) return createPoll(db, userId, clubId, input, now);
  return { poll: await findVisiblePoll(db, ctx, clubId, input.id, now), created: true };
}

/** Replaces the reader's vote while the poll is open (a single option unless `multiple`). */
export async function votePoll(
  db: Database,
  userId: string,
  clubId: string,
  pollId: string,
  optionIds: string[],
  now: Date,
): Promise<ClubPoll> {
  const { ctx } = await viewContext(db, userId, clubId, false);
  const poll = await findVisiblePoll(db, ctx, clubId, pollId, now);
  if (!poll.isOpen) throw new AppError('CONFLICT', 'This poll is closed.');
  const unique = [...new Set(optionIds)];
  const valid = new Set(poll.options.map((option) => option.id));
  if (unique.some((id) => !valid.has(id))) invalid('optionIds', 'Unknown option.');
  if (!poll.multiple && unique.length !== 1) invalid('optionIds', 'Choose exactly one option.');
  await db.transaction(async (tx) => {
    await tx
      .delete(clubPollVotes)
      .where(and(eq(clubPollVotes.pollId, pollId), eq(clubPollVotes.userId, userId)));
    await tx.insert(clubPollVotes).values(unique.map((optionId) => ({ pollId, optionId, userId })));
  });
  return findVisiblePoll(db, ctx, clubId, pollId, now);
}

/** Writes or edits the reader's one argument. Voting first is required; removed ones stay gone. */
export async function upsertArgument(
  db: Database,
  userId: string,
  clubId: string,
  pollId: string,
  body: string,
  now: Date,
): Promise<PollArgument> {
  const { ctx } = await viewContext(db, userId, clubId, false);
  const poll = await findVisiblePoll(db, ctx, clubId, pollId, now);
  if (!poll.options.some((option) => option.mine)) {
    invalid('body', 'Vote before writing an argument.');
  }
  const [existing] = await db
    .select({ id: clubPollArguments.id, status: clubPollArguments.status })
    .from(clubPollArguments)
    .where(and(eq(clubPollArguments.pollId, pollId), eq(clubPollArguments.authorUserId, userId)))
    .limit(1);
  if (existing?.status === 'removed') {
    throw new AppError('FORBIDDEN', 'This argument was removed by the club owner.');
  }
  if (existing) {
    await db.update(clubPollArguments).set({ body }).where(eq(clubPollArguments.id, existing.id));
  } else {
    await db
      .insert(clubPollArguments)
      .values({ id: crypto.randomUUID(), pollId, clubId, authorUserId: userId, body })
      .onConflictDoUpdate({
        target: [clubPollArguments.pollId, clubPollArguments.authorUserId],
        set: { body },
      });
  }
  const detail = await getPoll(db, userId, clubId, pollId, false, now);
  const mine = detail.arguments.find((argument) => argument.isMine);
  if (!mine) throw new AppError('INTERNAL_ERROR', 'Could not load the argument.');
  return mine;
}

export async function ownArgumentId(db: Executor, userId: string, pollId: string) {
  const [row] = await db
    .select({ id: clubPollArguments.id })
    .from(clubPollArguments)
    .where(and(eq(clubPollArguments.pollId, pollId), eq(clubPollArguments.authorUserId, userId)))
    .limit(1);
  if (!row) throw new AppError('NOT_FOUND', 'Argument not found.');
  return row.id;
}
