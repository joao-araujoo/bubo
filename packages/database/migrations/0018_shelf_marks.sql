-- The reader's own marks on a shelf book (ADR-046): Favorito, Tenho, Desejado and Relendo.
-- Private to the entry, additive with defaults, so older API versions keep working unchanged.
-- "Relendo" is a mark on top of the reading/paused status, never a status of its own.
ALTER TABLE "shelf_entries" ADD COLUMN IF NOT EXISTS "favorite" boolean NOT NULL DEFAULT false;
ALTER TABLE "shelf_entries" ADD COLUMN IF NOT EXISTS "owned" boolean NOT NULL DEFAULT false;
ALTER TABLE "shelf_entries" ADD COLUMN IF NOT EXISTS "wishlist" boolean NOT NULL DEFAULT false;
ALTER TABLE "shelf_entries" ADD COLUMN IF NOT EXISTS "rereading" boolean NOT NULL DEFAULT false;
