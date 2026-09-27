import { sql } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { users } from './auth';

/**
 * Reader data created by onboarding (Task 02). Mirrors migrations/0002_onboarding.sql.
 * Allowed values for text enums are enforced by CHECK constraints in SQL and by Zod contracts.
 */

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const readerProfiles = pgTable('reader_profiles', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  readingHabit: text('reading_habit'),
  goals: text('goals')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  interests: text('interests')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * Books. Manual books belong to their creator (`catalogKey` NULL). Catalog books (0006_catalog)
 * are shared rows with `createdByUserId` NULL and a unique `catalogKey`. `isbn` is ISBN-13.
 */
export const books = pgTable(
  'books',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    author: text('author'),
    totalPages: integer('total_pages'),
    isbn: text('isbn'),
    createdByUserId: text('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    catalogKey: text('catalog_key'),
    coverUrl: text('cover_url'),
    publisher: text('publisher'),
    publishedYear: integer('published_year'),
    description: text('description'),
    language: text('language'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('books_catalog_key_idx')
      .on(table.catalogKey)
      .where(sql`${table.catalogKey} IS NOT NULL`),
    index('books_isbn_idx')
      .on(table.isbn)
      .where(sql`${table.isbn} IS NOT NULL`),
  ],
);

export const shelfEntries = pgTable(
  'shelf_entries',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bookId: text('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('want_to_read'),
    currentPage: integer('current_page').notNull().default(0),
    /** Reader's own page count for a shared catalog book (overrides `books.total_pages`). */
    totalPages: integer('total_pages'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('shelf_entries_user_book_idx').on(table.userId, table.bookId),
    index('shelf_entries_user_status_idx').on(table.userId, table.status),
  ],
);
