import { date, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { shelfEntries } from './reader';

/** Focused reading sessions (Task 03). Mirrors migrations/0004_reading_sessions.sql. */
export const readingSessions = pgTable(
  'reading_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    shelfEntryId: text('shelf_entry_id')
      .notNull()
      .references(() => shelfEntries.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
    focusedSeconds: integer('focused_seconds').notNull(),
    startPage: integer('start_page').notNull(),
    endPage: integer('end_page').notNull(),
    reflection: text('reflection'),
    /** Reader's local calendar day (YYYY-MM-DD). */
    localDate: date('local_date', { mode: 'string' }).notNull(),
    xpEarned: integer('xp_earned').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('reading_sessions_user_date_idx').on(table.userId, table.localDate),
    index('reading_sessions_entry_idx').on(table.shelfEntryId),
  ],
);
