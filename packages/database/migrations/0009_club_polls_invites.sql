-- 0009_club_polls_invites — Comunidade part 2 (Task 08, ADR-020).
-- Topic type/chapter/quote, reactions, polls (options, votes, arguments), private clubs with
-- invite codes, and reports on polls and arguments. Additive only; 0008 rows keep working
-- (existing topics become kind 'discussion', existing clubs stay public).
-- Mirrors packages/database/src/schema/community.ts (kept in sync by test/schema.test.ts).
-- Names keep the "reading_club" prefix: the shared Neon database has unrelated legacy tables
-- such as "club_polls" and "club_poll_votes" (see docs/release.md).

ALTER TABLE "reading_club_posts" ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'discussion' CHECK ("kind" IN ('discussion', 'philosophical', 'worldbuilding', 'character', 'question'));
ALTER TABLE "reading_club_posts" ADD COLUMN IF NOT EXISTS "chapter" integer CHECK ("chapter" IS NULL OR "chapter" BETWEEN 1 AND 999);
ALTER TABLE "reading_club_posts" ADD COLUMN IF NOT EXISTS "quote" text CHECK ("quote" IS NULL OR char_length("quote") BETWEEN 1 AND 500);

ALTER TABLE "reading_clubs" ADD COLUMN IF NOT EXISTS "visibility" text NOT NULL DEFAULT 'public' CHECK ("visibility" IN ('public', 'private'));
ALTER TABLE "reading_clubs" ADD COLUMN IF NOT EXISTS "invite_code" text CHECK ("invite_code" IS NULL OR "invite_code" ~ '^[A-HJKMNP-Z2-9]{8}$');
CREATE UNIQUE INDEX IF NOT EXISTS "reading_clubs_invite_code_idx" ON "reading_clubs" ("invite_code") WHERE "invite_code" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "reading_club_polls" (
  "id" text PRIMARY KEY,
  "club_id" text NOT NULL REFERENCES "reading_clubs" ("id") ON DELETE CASCADE,
  "author_user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "question" text NOT NULL CHECK (char_length("question") BETWEEN 5 AND 200),
  "spoiler_page" integer NOT NULL CHECK ("spoiler_page" BETWEEN 0 AND 20000),
  "multiple" boolean NOT NULL DEFAULT false,
  "closes_at" timestamp with time zone NOT NULL,
  "status" text NOT NULL DEFAULT 'visible' CHECK ("status" IN ('visible', 'hidden', 'removed')),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "reading_club_polls_club_created_idx" ON "reading_club_polls" ("club_id", "created_at");

CREATE TABLE IF NOT EXISTS "reading_club_poll_options" (
  "id" text PRIMARY KEY,
  "poll_id" text NOT NULL REFERENCES "reading_club_polls" ("id") ON DELETE CASCADE,
  "position" integer NOT NULL CHECK ("position" BETWEEN 0 AND 3),
  "label" text NOT NULL CHECK (char_length("label") BETWEEN 1 AND 120)
);
CREATE UNIQUE INDEX IF NOT EXISTS "reading_club_poll_options_position_idx" ON "reading_club_poll_options" ("poll_id", "position");

CREATE TABLE IF NOT EXISTS "reading_club_poll_votes" (
  "poll_id" text NOT NULL REFERENCES "reading_club_polls" ("id") ON DELETE CASCADE,
  "option_id" text NOT NULL REFERENCES "reading_club_poll_options" ("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("poll_id", "option_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "reading_club_poll_votes_user_idx" ON "reading_club_poll_votes" ("user_id", "poll_id");

CREATE TABLE IF NOT EXISTS "reading_club_poll_arguments" (
  "id" text PRIMARY KEY,
  "poll_id" text NOT NULL REFERENCES "reading_club_polls" ("id") ON DELETE CASCADE,
  "club_id" text NOT NULL REFERENCES "reading_clubs" ("id") ON DELETE CASCADE,
  "author_user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "body" text NOT NULL CHECK (char_length("body") BETWEEN 1 AND 1000),
  "status" text NOT NULL DEFAULT 'visible' CHECK ("status" IN ('visible', 'hidden', 'removed')),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "reading_club_poll_arguments_author_idx" ON "reading_club_poll_arguments" ("poll_id", "author_user_id");

CREATE TABLE IF NOT EXISTS "reading_club_reactions" (
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "club_id" text NOT NULL REFERENCES "reading_clubs" ("id") ON DELETE CASCADE,
  "target_type" text NOT NULL CHECK ("target_type" IN ('post', 'reply', 'argument')),
  "target_id" text NOT NULL,
  "kind" text NOT NULL CHECK ("kind" IN ('insight', 'idea', 'counterpoint')),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "target_type", "target_id", "kind")
);
CREATE INDEX IF NOT EXISTS "reading_club_reactions_target_idx" ON "reading_club_reactions" ("target_type", "target_id");

-- Reports now also cover polls and poll arguments.
ALTER TABLE "reading_club_reports" DROP CONSTRAINT IF EXISTS "reading_club_reports_target_type_check";
ALTER TABLE "reading_club_reports" ADD CONSTRAINT "reading_club_reports_target_type_check" CHECK ("target_type" IN ('post', 'reply', 'poll', 'argument'));
