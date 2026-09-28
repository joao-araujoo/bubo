-- 0008_community — reading clubs with anti-spoiler debates, reports and blocks (Task 07, ADR-019).
-- A club reads one shared catalog book. Every topic and reply declares the book page it talks
-- about ("spoiler_page"); the API hides content beyond the reader's own page on that book.
-- Moderation: readers report content (3 distinct reports hide it until the club owner decides),
-- club owners remove or restore, and readers block other readers.
-- Mirrors packages/database/src/schema/community.ts (kept in sync by test/schema.test.ts).
-- Names carry a "reading_club" prefix on purpose: the shared Neon database already holds empty
-- legacy tables named "clubs", "club_members", "content_reports", "club_polls"… that no Bubo
-- migration created. They are left untouched; see docs/release.md → "Current remote state".

CREATE TABLE IF NOT EXISTS "reading_clubs" (
  "id" text PRIMARY KEY,
  "owner_user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "name" text NOT NULL CHECK (char_length("name") BETWEEN 3 AND 60),
  "description" text NOT NULL DEFAULT '' CHECK (char_length("description") <= 500),
  "icon" text NOT NULL CHECK ("icon" IN ('planet', 'classics', 'mind', 'spark', 'library', 'heart')),
  "book_id" text NOT NULL REFERENCES "books" ("id") ON DELETE RESTRICT,
  "weekly_goal_pages" integer CHECK ("weekly_goal_pages" IS NULL OR "weekly_goal_pages" IN (50, 75, 100)),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "reading_clubs_owner_idx" ON "reading_clubs" ("owner_user_id");
CREATE INDEX IF NOT EXISTS "reading_clubs_book_idx" ON "reading_clubs" ("book_id");

CREATE TABLE IF NOT EXISTS "reading_club_members" (
  "club_id" text NOT NULL REFERENCES "reading_clubs" ("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "role" text NOT NULL CHECK ("role" IN ('owner', 'member')),
  "joined_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("club_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "reading_club_members_user_idx" ON "reading_club_members" ("user_id");

CREATE TABLE IF NOT EXISTS "reading_club_posts" (
  "id" text PRIMARY KEY,
  "club_id" text NOT NULL REFERENCES "reading_clubs" ("id") ON DELETE CASCADE,
  "author_user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "title" text NOT NULL CHECK (char_length("title") BETWEEN 3 AND 120),
  "body" text NOT NULL CHECK (char_length("body") BETWEEN 1 AND 4000),
  "spoiler_page" integer NOT NULL CHECK ("spoiler_page" BETWEEN 0 AND 20000),
  "status" text NOT NULL DEFAULT 'visible' CHECK ("status" IN ('visible', 'hidden', 'removed')),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "reading_club_posts_club_created_idx" ON "reading_club_posts" ("club_id", "created_at");

CREATE TABLE IF NOT EXISTS "reading_club_replies" (
  "id" text PRIMARY KEY,
  "post_id" text NOT NULL REFERENCES "reading_club_posts" ("id") ON DELETE CASCADE,
  "club_id" text NOT NULL REFERENCES "reading_clubs" ("id") ON DELETE CASCADE,
  "author_user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "body" text NOT NULL CHECK (char_length("body") BETWEEN 1 AND 2000),
  "spoiler_page" integer NOT NULL CHECK ("spoiler_page" BETWEEN 0 AND 20000),
  "status" text NOT NULL DEFAULT 'visible' CHECK ("status" IN ('visible', 'hidden', 'removed')),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "reading_club_replies_post_created_idx" ON "reading_club_replies" ("post_id", "created_at");

CREATE TABLE IF NOT EXISTS "reading_club_reports" (
  "id" text PRIMARY KEY,
  "reporter_user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "club_id" text NOT NULL REFERENCES "reading_clubs" ("id") ON DELETE CASCADE,
  "target_type" text NOT NULL CHECK ("target_type" IN ('post', 'reply')),
  "target_id" text NOT NULL,
  "reason" text NOT NULL CHECK ("reason" IN ('spoiler', 'offensive', 'spam', 'other')),
  "details" text CHECK ("details" IS NULL OR char_length("details") <= 500),
  "status" text NOT NULL DEFAULT 'open' CHECK ("status" IN ('open', 'resolved')),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "reading_club_reports_reporter_target_idx" ON "reading_club_reports" ("reporter_user_id", "target_type", "target_id");
CREATE INDEX IF NOT EXISTS "reading_club_reports_target_idx" ON "reading_club_reports" ("target_type", "target_id");
CREATE INDEX IF NOT EXISTS "reading_club_reports_club_status_idx" ON "reading_club_reports" ("club_id", "status");

CREATE TABLE IF NOT EXISTS "user_blocks" (
  "blocker_user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "blocked_user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("blocker_user_id", "blocked_user_id"),
  CHECK ("blocker_user_id" <> "blocked_user_id")
);
