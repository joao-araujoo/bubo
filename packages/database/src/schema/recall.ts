import { date, index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { shelfEntries } from './reader';
import { readingSessions } from './sessions';

/** Active-recall cards (Task 04). Mirrors migrations/0005_recall.sql. */
export const recallCards = pgTable(
  'recall_cards',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    shelfEntryId: text('shelf_entry_id')
      .notNull()
      .references(() => shelfEntries.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').references(() => readingSessions.id, { onDelete: 'set null' }),
    prompt: text('prompt').notNull(),
    answer: text('answer'),
    source: text('source').notNull(),
    repetitions: integer('repetitions').notNull().default(0),
    intervalDays: integer('interval_days').notNull().default(0),
    /** SM-2 ease factor × 100 (integer, avoids numeric parsing). */
    easeX100: integer('ease_x100').notNull().default(250),
    dueDate: date('due_date', { mode: 'string' }).notNull(),
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('recall_cards_user_due_idx').on(table.userId, table.dueDate),
    uniqueIndex('recall_cards_session_idx').on(table.sessionId),
  ],
);

export const reviewLogs = pgTable(
  'review_logs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cardId: text('card_id')
      .notNull()
      .references(() => recallCards.id, { onDelete: 'cascade' }),
    grade: integer('grade').notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }).notNull(),
    localDate: date('local_date', { mode: 'string' }).notNull(),
    intervalDays: integer('interval_days').notNull(),
    xpEarned: integer('xp_earned').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('review_logs_user_date_idx').on(table.userId, table.localDate)],
);
