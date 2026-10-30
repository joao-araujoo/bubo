-- A reader's own 1–5 rating for a shelf book (ADR-035). Private to the entry: it never publishes
-- a club review. Nullable and additive, so older API versions keep working unchanged.
ALTER TABLE "shelf_entries" ADD COLUMN IF NOT EXISTS "rating" smallint;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shelf_entries_rating_range'
  ) THEN
    ALTER TABLE "shelf_entries" ADD CONSTRAINT "shelf_entries_rating_range"
      CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5);
  END IF;
END $$;
