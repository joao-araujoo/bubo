-- 0004_reading_sessions — focused reading sessions (source of progress, streak and XP).
-- `local_date` is the reader's own calendar day when the session ended (sent by the app), so
-- streaks follow the reader's time zone. Mirrors packages/database/src/schema/sessions.ts.

CREATE TABLE IF NOT EXISTS "reading_sessions" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "shelf_entry_id" text NOT NULL REFERENCES "shelf_entries" ("id") ON DELETE CASCADE,
  "started_at" timestamp with time zone NOT NULL,
  "ended_at" timestamp with time zone NOT NULL,
  "focused_seconds" integer NOT NULL CHECK ("focused_seconds" BETWEEN 60 AND 14400),
  "start_page" integer NOT NULL CHECK ("start_page" >= 0),
  "end_page" integer NOT NULL CHECK ("end_page" >= "start_page"),
  "reflection" text CHECK ("reflection" IS NULL OR char_length("reflection") <= 2000),
  "local_date" date NOT NULL,
  "xp_earned" integer NOT NULL DEFAULT 0 CHECK ("xp_earned" >= 0),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CHECK ("ended_at" >= "started_at")
);
CREATE INDEX IF NOT EXISTS "reading_sessions_user_date_idx" ON "reading_sessions" ("user_id", "local_date");
CREATE INDEX IF NOT EXISTS "reading_sessions_entry_idx" ON "reading_sessions" ("shelf_entry_id");
