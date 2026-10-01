import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { users } from './auth';
import { books } from './reader';

/**
 * Reading clubs, anti-spoiler debates and moderation (Task 07, 0008_community.sql) plus polls,
 * reactions and invites (Task 08, 0009_club_polls_invites.sql).
 */

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const clubCycles = pgTable(
  'reading_club_cycles',
  {
    id: text('id').primaryKey(),
    clubId: text('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    goalPages: integer('goal_pages').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (table) => [
    index('reading_club_cycles_club_idx').on(table.clubId, table.startedAt),
    uniqueIndex('reading_club_cycles_open_idx')
      .on(table.clubId)
      .where(sql`${table.closedAt} IS NULL`),
  ],
);

export const clubCycleMembers = pgTable(
  'reading_club_cycle_members',
  {
    cycleId: text('cycle_id')
      .notNull()
      .references(() => clubCycles.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.cycleId, table.userId] })],
);

export const friendships = pgTable(
  'reading_club_friendships',
  {
    id: text('id').primaryKey(),
    senderId: text('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recipientId: text('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('reading_club_friendships_pair_idx').on(
      sql`least(${table.senderId}, ${table.recipientId})`,
      sql`greatest(${table.senderId}, ${table.recipientId})`,
    ),
    index('reading_club_friendships_recipient_idx').on(table.recipientId),
    index('reading_club_friendships_sender_idx').on(table.senderId),
  ],
);

export const socialPreferences = pgTable('reading_club_social_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  allowRequests: boolean('allow_requests').notNull().default(true),
  shareActivity: boolean('share_activity').notNull().default(false),
  sharingSince: timestamp('sharing_since', { withTimezone: true }),
});

export const clubs = pgTable(
  'reading_clubs',
  {
    id: text('id').primaryKey(),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    icon: text('icon').notNull(),
    bookId: text('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'restrict' }),
    weeklyGoalPages: integer('weekly_goal_pages'),
    visibility: text('visibility').notNull().default('public'),
    inviteCode: text('invite_code'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('reading_clubs_owner_idx').on(table.ownerUserId),
    index('reading_clubs_book_idx').on(table.bookId),
    uniqueIndex('reading_clubs_invite_code_idx')
      .on(table.inviteCode)
      .where(sql`${table.inviteCode} IS NOT NULL`),
  ],
);

export const clubMembers = pgTable(
  'reading_club_members',
  {
    clubId: text('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.clubId, table.userId] }),
    index('reading_club_members_user_idx').on(table.userId),
  ],
);

export const clubPosts = pgTable(
  'reading_club_posts',
  {
    id: text('id').primaryKey(),
    clubId: text('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    authorUserId: text('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    body: text('body').notNull(),
    spoilerPage: integer('spoiler_page').notNull(),
    status: text('status').notNull().default('visible'),
    kind: text('kind').notNull().default('discussion'),
    chapter: integer('chapter'),
    quote: text('quote'),
    reviewRating: integer('review_rating'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('reading_club_posts_club_created_idx').on(table.clubId, table.createdAt),
    index('reading_club_posts_reviews_idx')
      .on(table.clubId, table.createdAt)
      .where(sql`${table.reviewRating} IS NOT NULL`),
  ],
);

export const clubReplies = pgTable(
  'reading_club_replies',
  {
    id: text('id').primaryKey(),
    postId: text('post_id')
      .notNull()
      .references(() => clubPosts.id, { onDelete: 'cascade' }),
    clubId: text('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    authorUserId: text('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    spoilerPage: integer('spoiler_page').notNull(),
    status: text('status').notNull().default('visible'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('reading_club_replies_post_created_idx').on(table.postId, table.createdAt)],
);

export const contentReports = pgTable(
  'reading_club_reports',
  {
    id: text('id').primaryKey(),
    reporterUserId: text('reporter_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clubId: text('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    reason: text('reason').notNull(),
    details: text('details'),
    status: text('status').notNull().default('open'),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('reading_club_reports_reporter_target_idx').on(
      table.reporterUserId,
      table.targetType,
      table.targetId,
    ),
    index('reading_club_reports_target_idx').on(table.targetType, table.targetId),
    index('reading_club_reports_club_status_idx').on(table.clubId, table.status),
  ],
);

export const userBlocks = pgTable(
  'user_blocks',
  {
    blockerUserId: text('blocker_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedUserId: text('blocked_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.blockerUserId, table.blockedUserId] })],
);

export const clubPolls = pgTable(
  'reading_club_polls',
  {
    id: text('id').primaryKey(),
    clubId: text('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    authorUserId: text('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    spoilerPage: integer('spoiler_page').notNull(),
    multiple: boolean('multiple').notNull().default(false),
    closesAt: timestamp('closes_at', { withTimezone: true }).notNull(),
    status: text('status').notNull().default('visible'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('reading_club_polls_club_created_idx').on(table.clubId, table.createdAt)],
);

export const clubPollOptions = pgTable(
  'reading_club_poll_options',
  {
    id: text('id').primaryKey(),
    pollId: text('poll_id')
      .notNull()
      .references(() => clubPolls.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    label: text('label').notNull(),
  },
  (table) => [
    uniqueIndex('reading_club_poll_options_position_idx').on(table.pollId, table.position),
  ],
);

export const clubPollVotes = pgTable(
  'reading_club_poll_votes',
  {
    pollId: text('poll_id')
      .notNull()
      .references(() => clubPolls.id, { onDelete: 'cascade' }),
    optionId: text('option_id')
      .notNull()
      .references(() => clubPollOptions.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.pollId, table.optionId, table.userId] }),
    index('reading_club_poll_votes_user_idx').on(table.userId, table.pollId),
  ],
);

export const clubPollArguments = pgTable(
  'reading_club_poll_arguments',
  {
    id: text('id').primaryKey(),
    pollId: text('poll_id')
      .notNull()
      .references(() => clubPolls.id, { onDelete: 'cascade' }),
    clubId: text('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    authorUserId: text('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    status: text('status').notNull().default('visible'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('reading_club_poll_arguments_author_idx').on(table.pollId, table.authorUserId),
  ],
);

export const clubReactions = pgTable(
  'reading_club_reactions',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clubId: text('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    kind: text('kind').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.targetType, table.targetId, table.kind] }),
    index('reading_club_reactions_target_idx').on(table.targetType, table.targetId),
  ],
);
