-- 0002_onboarding — reader profile (onboarding answers), books and the reader's shelf.
-- Mirrors packages/database/src/schema/reader.ts (kept in sync by test/schema.test.ts).

CREATE TABLE IF NOT EXISTS "reader_profiles" (
  "user_id" text PRIMARY KEY REFERENCES "users" ("id") ON DELETE CASCADE,
  "reading_habit" text CHECK ("reading_habit" IN ('daily', 'weekly', 'free_time', 'restarting')),
  "goals" text[] NOT NULL DEFAULT '{}'::text[],
  "interests" text[] NOT NULL DEFAULT '{}'::text[],
  "onboarding_completed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "books" (
  "id" text PRIMARY KEY,
  "title" text NOT NULL CHECK (char_length("title") BETWEEN 1 AND 300),
  "author" text CHECK ("author" IS NULL OR char_length("author") BETWEEN 1 AND 200),
  "total_pages" integer CHECK ("total_pages" IS NULL OR "total_pages" BETWEEN 1 AND 20000),
  "isbn" text,
  "created_by_user_id" text REFERENCES "users" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "shelf_entries" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "book_id" text NOT NULL REFERENCES "books" ("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'want_to_read' CHECK ("status" IN ('want_to_read', 'reading', 'paused', 'finished', 'abandoned')),
  "current_page" integer NOT NULL DEFAULT 0 CHECK ("current_page" >= 0),
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "shelf_entries_user_book_idx" ON "shelf_entries" ("user_id", "book_id");
CREATE INDEX IF NOT EXISTS "shelf_entries_user_status_idx" ON "shelf_entries" ("user_id", "status");
