-- 0007_shelf_entry_pages — a reader's own page count for shared catalog books (Task 05, ADR-016).
-- Shared catalog rows are never edited by readers, so the override lives on the shelf entry.
-- Mirrors packages/database/src/schema/reader.ts (kept in sync by test/schema.test.ts).

ALTER TABLE "shelf_entries" ADD COLUMN IF NOT EXISTS "total_pages" integer CHECK ("total_pages" IS NULL OR "total_pages" BETWEEN 1 AND 20000);