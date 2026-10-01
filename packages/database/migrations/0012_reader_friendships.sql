CREATE TABLE IF NOT EXISTS "reading_club_friendships" (
  "id" text PRIMARY KEY,
  "sender_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "recipient_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "accepted_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CHECK ("sender_id" <> "recipient_id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "reading_club_friendships_pair_idx" ON "reading_club_friendships" (least("sender_id", "recipient_id"), greatest("sender_id", "recipient_id"));
CREATE INDEX IF NOT EXISTS "reading_club_friendships_recipient_idx" ON "reading_club_friendships" ("recipient_id");
CREATE INDEX IF NOT EXISTS "reading_club_friendships_sender_idx" ON "reading_club_friendships" ("sender_id");
CREATE TABLE IF NOT EXISTS "reading_club_social_preferences" (
  "user_id" text PRIMARY KEY REFERENCES "users" ("id") ON DELETE CASCADE,
  "allow_requests" boolean NOT NULL DEFAULT true,
  "share_activity" boolean NOT NULL DEFAULT false,
  "sharing_since" timestamp with time zone
);
