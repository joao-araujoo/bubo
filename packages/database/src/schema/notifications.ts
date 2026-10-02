import { sql } from 'drizzle-orm';
import { boolean, date, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { clubs } from './community';

/** Task 09 (ADR-022). Mirrors migrations/0013_reader_preferences_notifications.sql. */

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const readerPreferences = pgTable(
  'reader_preferences',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    reviewIntensity: text('review_intensity').notNull().default('balanced'),
    dailyReviewLimit: integer('daily_review_limit').notNull().default(20),
    dailyFocusMinutes: integer('daily_focus_minutes').notNull().default(20),
    annualBookGoal: integer('annual_book_goal'),
    reviewReminder: boolean('review_reminder').notNull().default(false),
    reminderHour: integer('reminder_hour').notNull().default(19),
    timeZone: text('time_zone').notNull().default('America/Sao_Paulo'),
    notifyCommunity: boolean('notify_community').notNull().default(true),
    notifyFriends: boolean('notify_friends').notNull().default(true),
    lastReminderDate: date('last_reminder_date', { mode: 'string' }),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('reader_preferences_reminder_idx')
      .on(table.reminderHour)
      .where(sql`${table.reviewReminder}`),
  ],
);

export const pushTokens = pgTable(
  'reader_push_tokens',
  {
    token: text('token').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platform: text('platform').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('reader_push_tokens_user_idx').on(table.userId)],
);

export const notifications = pgTable(
  'reader_notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'cascade' }),
    clubId: text('club_id').references(() => clubs.id, { onDelete: 'cascade' }),
    targetId: text('target_id'),
    count: integer('count'),
    createdAt: createdAt(),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (table) => [
    index('reader_notifications_user_idx').on(table.userId, table.createdAt.desc()),
    index('reader_notifications_unread_idx')
      .on(table.userId, table.kind, table.targetId)
      .where(sql`${table.readAt} IS NULL`),
  ],
);
