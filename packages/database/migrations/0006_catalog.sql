-- 0006_catalog — shared catalog metadata on "books" (Task 05, ADR-016).
-- Catalog books (Google Books / Open Library) are shared rows: "created_by_user_id" IS NULL and
-- "catalog_key" is unique. Manual books keep "catalog_key" NULL and belong to their creator.
-- "isbn" holds a normalized ISBN-13. "cover_url" is the best https cover candidate chosen by the
-- server from allowlisted hosts; clients always keep a typographic fallback.
-- Mirrors packages/database/src/schema/reader.ts (kept in sync by test/schema.test.ts).

ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "catalog_key" text CHECK ("catalog_key" IS NULL OR char_length("catalog_key") BETWEEN 3 AND 120);
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "cover_url" text CHECK ("cover_url" IS NULL OR ("cover_url" LIKE 'https://%' AND char_length("cover_url") <= 600));
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "publisher" text CHECK ("publisher" IS NULL OR char_length("publisher") BETWEEN 1 AND 200);
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "published_year" integer CHECK ("published_year" IS NULL OR "published_year" BETWEEN 1 AND 2100);
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "description" text CHECK ("description" IS NULL OR char_length("description") <= 4000);
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "language" text CHECK ("language" IS NULL OR char_length("language") BETWEEN 2 AND 12);

CREATE UNIQUE INDEX IF NOT EXISTS "books_catalog_key_idx" ON "books" ("catalog_key") WHERE "catalog_key" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "books_isbn_idx" ON "books" ("isbn") WHERE "isbn" IS NOT NULL;
