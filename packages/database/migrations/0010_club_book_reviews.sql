-- Book reviews reuse the club topic lifecycle: membership, spoilers, replies and moderation.
-- An optional rating marks a review; older clients can still read it as a discussion.
ALTER TABLE "reading_club_posts" ADD COLUMN IF NOT EXISTS "review_rating" integer;
ALTER TABLE "reading_club_posts" ADD CONSTRAINT "reading_club_posts_review_rating_check"
  CHECK ("review_rating" IS NULL OR ("review_rating" BETWEEN 1 AND 5 AND "kind" = 'discussion' AND char_length(btrim("body")) >= 30));
CREATE INDEX IF NOT EXISTS "reading_club_posts_reviews_idx"
  ON "reading_club_posts" ("club_id", "created_at") WHERE "review_rating" IS NOT NULL;
