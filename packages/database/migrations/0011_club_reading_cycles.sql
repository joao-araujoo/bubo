CREATE TABLE IF NOT EXISTS "reading_club_cycles" (
  "id" text PRIMARY KEY,
  "club_id" text NOT NULL REFERENCES "reading_clubs" ("id") ON DELETE CASCADE,
  "goal_pages" integer NOT NULL CHECK ("goal_pages" BETWEEN 1 AND 20000),
  "started_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "closed_at" timestamp with time zone,
  CHECK ("ends_at" > "started_at"),
  CHECK ("closed_at" IS NULL OR "closed_at" >= "started_at")
);
CREATE INDEX IF NOT EXISTS "reading_club_cycles_club_idx" ON "reading_club_cycles" ("club_id", "started_at");
CREATE UNIQUE INDEX IF NOT EXISTS "reading_club_cycles_open_idx" ON "reading_club_cycles" ("club_id") WHERE "closed_at" IS NULL;
CREATE TABLE IF NOT EXISTS "reading_club_cycle_members" (
  "cycle_id" text NOT NULL REFERENCES "reading_club_cycles" ("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  PRIMARY KEY ("cycle_id", "user_id")
);
