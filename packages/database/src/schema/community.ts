import {
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

/** Reading clubs, anti-spoiler debates and moderation (Task 07). Mirrors 0008_community.sql. */

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('reading_clubs_owner_idx').on(table.ownerUserId),
    index('reading_clubs_book_idx').on(table.bookId),
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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('reading_club_posts_club_created_idx').on(table.clubId, table.createdAt)],
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
