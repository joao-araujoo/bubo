-- Task 09 (ADR-022): reader preferences, Expo push tokens and the in-app notification inbox.
-- Legacy tables named notifications, notification_preferences, push_devices and user_settings
-- exist in the shared Neon database and are unrelated; these use the reader_ prefix.
CREATE TABLE IF NOT EXISTS "reader_preferences" (
  "user_id" text PRIMARY KEY REFERENCES "users" ("id") ON DELETE CASCADE,
  "review_intensity" text NOT NULL DEFAULT 'balanced'
    CHECK ("review_intensity" IN ('gentle', 'balanced', 'intensive')),
  "daily_review_limit" integer NOT NULL DEFAULT 20 CHECK ("daily_review_limit" BETWEEN 5 AND 50),
  "daily_focus_minutes" integer NOT NULL DEFAULT 20 CHECK ("daily_focus_minutes" IN (15, 20, 30, 45)),
  "annual_book_goal" integer CHECK ("annual_book_goal" IS NULL OR "annual_book_goal" BETWEEN 1 AND 365),
  "review_reminder" boolean NOT NULL DEFAULT false,
  "reminder_hour" integer NOT NULL DEFAULT 19 CHECK ("reminder_hour" BETWEEN 0 AND 23),
  "time_zone" text NOT NULL DEFAULT 'America/Sao_Paulo' CHECK (char_length("time_zone") BETWEEN 1 AND 64),
  "notify_community" boolean NOT NULL DEFAULT true,
  "notify_friends" boolean NOT NULL DEFAULT true,
  "last_reminder_date" date,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "reader_preferences_reminder_idx"
  ON "reader_preferences" ("reminder_hour") WHERE "review_reminder";

CREATE TABLE IF NOT EXISTS "reader_push_tokens" (
  "token" text PRIMARY KEY CHECK (char_length("token") BETWEEN 10 AND 255),
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "platform" text NOT NULL CHECK ("platform" IN ('ios', 'android')),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "reader_push_tokens_user_idx" ON "reader_push_tokens" ("user_id");

CREATE TABLE IF NOT EXISTS "reader_notifications" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "kind" text NOT NULL
    CHECK ("kind" IN ('review_due', 'topic_reply', 'friend_request', 'friend_accepted', 'cycle_started')),
  "actor_user_id" text REFERENCES "users" ("id") ON DELETE CASCADE,
  "club_id" text REFERENCES "reading_clubs" ("id") ON DELETE CASCADE,
  "target_id" text,
  "count" integer CHECK ("count" IS NULL OR "count" >= 0),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "read_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "reader_notifications_user_idx"
  ON "reader_notifications" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "reader_notifications_unread_idx"
  ON "reader_notifications" ("user_id", "kind", "target_id") WHERE "read_at" IS NULL;
