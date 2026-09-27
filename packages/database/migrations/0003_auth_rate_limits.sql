-- 0003_auth_rate_limits — persistent rate-limit counters for Better Auth (storage: "database").
-- A Worker isolate is short-lived, so in-memory counters would reset constantly.
-- Mirrors packages/database/src/schema/auth.ts (rateLimits).

CREATE TABLE IF NOT EXISTS "rate_limits" (
  "id" text PRIMARY KEY,
  "key" text NOT NULL UNIQUE,
  "count" integer NOT NULL,
  "last_request" bigint NOT NULL
);
