-- ADR-038: e-mailed login codes (Better Auth two-factor, OTP method only), consent for optional
-- Bubo e-mails and a log of the optional e-mails actually sent (deduplication and audit).

-- Every account asks for an e-mailed code at sign-in on untrusted devices. Existing accounts are
-- included; the reader can turn it off in Configurações → Conta e segurança (password required).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean NOT NULL DEFAULT true;

-- Better Auth "twoFactor" model (plural adapter name "twoFactors"). With the OTP method no row is
-- written, but the plugin reads the table during verification and for account lockout.
CREATE TABLE IF NOT EXISTS "two_factors" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "secret" text NOT NULL,
  "backup_codes" text NOT NULL,
  "verified" boolean NOT NULL DEFAULT true,
  "failed_verification_count" integer NOT NULL DEFAULT 0,
  "locked_until" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "two_factors_user_id_idx" ON "two_factors" ("user_id");

-- Optional e-mails need explicit consent kept with the account preferences. Account and security
-- e-mails (codes, password changes, deletion) are always sent and have no switch.
ALTER TABLE "reader_preferences" ADD COLUMN IF NOT EXISTS "email_reading_reminders" boolean NOT NULL DEFAULT true;

-- One row per optional e-mail actually accepted by the provider: the cron never repeats a kind
-- inside its cooldown, even across overlapping runs. Ids and kinds only, never content.
CREATE TABLE IF NOT EXISTS "reader_email_events" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "kind" text NOT NULL CHECK ("kind" IN ('reading_return')),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "reader_email_events_user_kind_idx"
  ON "reader_email_events" ("user_id", "kind", "created_at" DESC);
