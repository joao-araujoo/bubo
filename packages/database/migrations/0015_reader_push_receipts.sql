-- Bind a device to its current login. Existing registrations are refreshed by the mobile app;
-- until refreshed, an unbound device is excluded from delivery. Revoking/deleting a session
-- removes its tokens, including password-reset session revocation.
ALTER TABLE "reader_push_tokens" ADD COLUMN IF NOT EXISTS "session_id" text
  REFERENCES "sessions" ("id") ON DELETE CASCADE;
ALTER TABLE "reader_push_tokens" ADD COLUMN IF NOT EXISTS "registration_id" text
  NOT NULL DEFAULT gen_random_uuid()::text;

-- Expo acceptance is not provider delivery. The hourly cron checks tickets after 15 minutes,
-- safely discards resolved receipts, and expires missing receipts before Expo's 24-hour cutoff.
CREATE TABLE IF NOT EXISTS "reader_push_receipts" (
  "id" text PRIMARY KEY,
  "token" text NOT NULL REFERENCES "reader_push_tokens" ("token") ON DELETE CASCADE,
  "registration_id" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "check_after" timestamp with time zone NOT NULL
);
CREATE INDEX IF NOT EXISTS "reader_push_receipts_check_idx"
  ON "reader_push_receipts" ("check_after");
