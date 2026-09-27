-- 0005_recall — active-recall cards with SM-2 scheduling, and the review log.
-- Cards come from session reflections (source 'reflection') or are written by the reader
-- ('manual'). Due dates are the reader's local calendar days. Mirrors src/schema/recall.ts.

CREATE TABLE IF NOT EXISTS "recall_cards" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "shelf_entry_id" text NOT NULL REFERENCES "shelf_entries" ("id") ON DELETE CASCADE,
  "session_id" text REFERENCES "reading_sessions" ("id") ON DELETE SET NULL,
  "prompt" text NOT NULL CHECK (char_length("prompt") BETWEEN 1 AND 500),
  "answer" text CHECK ("answer" IS NULL OR char_length("answer") <= 2000),
  "source" text NOT NULL CHECK ("source" IN ('reflection', 'manual')),
  "repetitions" integer NOT NULL DEFAULT 0 CHECK ("repetitions" >= 0),
  "interval_days" integer NOT NULL DEFAULT 0 CHECK ("interval_days" >= 0),
  "ease_x100" integer NOT NULL DEFAULT 250 CHECK ("ease_x100" BETWEEN 130 AND 500),
  "due_date" date NOT NULL,
  "last_reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "recall_cards_user_due_idx" ON "recall_cards" ("user_id", "due_date");
CREATE UNIQUE INDEX IF NOT EXISTS "recall_cards_session_idx" ON "recall_cards" ("session_id");

CREATE TABLE IF NOT EXISTS "review_logs" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "card_id" text NOT NULL REFERENCES "recall_cards" ("id") ON DELETE CASCADE,
  "grade" integer NOT NULL CHECK ("grade" BETWEEN 0 AND 5),
  "reviewed_at" timestamp with time zone NOT NULL,
  "local_date" date NOT NULL,
  "interval_days" integer NOT NULL CHECK ("interval_days" >= 0),
  "xp_earned" integer NOT NULL DEFAULT 0 CHECK ("xp_earned" >= 0),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "review_logs_user_date_idx" ON "review_logs" ("user_id", "local_date");
