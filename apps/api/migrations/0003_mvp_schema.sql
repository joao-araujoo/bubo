-- Bubo 4
-- 0003_mvp_schema.sql
-- Remaining MVP domain: cognitive core, reviews, gamification, social, clubs and notifications.
-- Safe to run after 0001_core.sql and 0002_onboarding_settings.sql.

BEGIN;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =========================================================
-- BOOK JOURNEY / REVIEW / PROGRESS HISTORY
-- =========================================================

CREATE TABLE IF NOT EXISTS book_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  user_book_id UUID NOT NULL REFERENCES user_books(id) ON DELETE CASCADE,
  rating NUMERIC(2,1)
    CHECK (rating IS NULL OR (rating >= 0.5 AND rating <= 5.0)),
  title TEXT,
  body TEXT NOT NULL,
  contains_spoiler BOOLEAN NOT NULL DEFAULT FALSE,
  visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('private', 'followers', 'public')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, user_book_id)
);

CREATE INDEX IF NOT EXISTS book_reviews_user_published_idx
  ON book_reviews(user_id, published_at DESC);

CREATE TABLE IF NOT EXISTS reading_progress_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  user_book_id UUID NOT NULL REFERENCES user_books(id) ON DELETE CASCADE,
  reading_session_id UUID REFERENCES reading_sessions(id) ON DELETE SET NULL,
  page_number INTEGER CHECK (page_number IS NULL OR page_number >= 0),
  progress_percent NUMERIC(5,2)
    CHECK (progress_percent IS NULL OR (progress_percent >= 0 AND progress_percent <= 100)),
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'session', 'finish_book', 'import')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reading_progress_events_book_time_idx
  ON reading_progress_events(user_book_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS reading_session_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_session_id UUID NOT NULL REFERENCES reading_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('started', 'paused', 'resumed', 'progress', 'completed', 'discarded')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reading_session_events_session_time_idx
  ON reading_session_events(reading_session_id, occurred_at);

-- =========================================================
-- AI JOB PROVENANCE
-- =========================================================

CREATE TABLE IF NOT EXISTS ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES profiles(user_id) ON DELETE SET NULL,
  job_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  provider TEXT,
  model TEXT,
  prompt_version TEXT,
  algorithm_version TEXT,
  idempotency_key TEXT UNIQUE,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  error_code TEXT,
  error_message TEXT,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_jobs_status_queued_idx
  ON ai_jobs(status, queued_at);

CREATE INDEX IF NOT EXISTS ai_jobs_user_time_idx
  ON ai_jobs(user_id, queued_at DESC);

-- =========================================================
-- COGNITIVE CORE
-- =========================================================

CREATE TABLE IF NOT EXISTS memory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  user_book_id UUID NOT NULL REFERENCES user_books(id) ON DELETE CASCADE,
  source_reading_session_id UUID REFERENCES reading_sessions(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'concept'
    CHECK (kind IN ('concept', 'fact', 'theme', 'character', 'inference', 'connection', 'application', 'other')),
  title TEXT,
  summary TEXT NOT NULL,
  source_start_page INTEGER CHECK (source_start_page IS NULL OR source_start_page >= 0),
  source_end_page INTEGER CHECK (source_end_page IS NULL OR source_end_page >= 0),
  state TEXT NOT NULL DEFAULT 'active'
    CHECK (state IN ('active', 'mastered', 'archived')),
  created_by TEXT NOT NULL DEFAULT 'bubo'
    CHECK (created_by IN ('user', 'bubo', 'hybrid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    source_start_page IS NULL
    OR source_end_page IS NULL
    OR source_end_page >= source_start_page
  )
);

CREATE INDEX IF NOT EXISTS memory_items_user_book_state_idx
  ON memory_items(user_book_id, state, created_at DESC);

CREATE INDEX IF NOT EXISTS memory_items_user_idx
  ON memory_items(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS recall_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  user_book_id UUID NOT NULL REFERENCES user_books(id) ON DELETE CASCADE,
  reading_session_id UUID REFERENCES reading_sessions(id) ON DELETE SET NULL,
  mode TEXT NOT NULL
    CHECK (mode IN ('initial', 'spaced', 'manual', 'book_test')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'processing', 'completed', 'abandoned', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS recall_sessions_user_time_idx
  ON recall_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS recall_sessions_book_time_idx
  ON recall_sessions(user_book_id, started_at DESC);

CREATE TABLE IF NOT EXISTS assessment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recall_session_id UUID NOT NULL REFERENCES recall_sessions(id) ON DELETE CASCADE,
  memory_item_id UUID REFERENCES memory_items(id) ON DELETE SET NULL,
  item_type TEXT NOT NULL
    CHECK (item_type IN ('free_recall', 'concept', 'inference', 'connection', 'application', 'calibration')),
  prompt TEXT NOT NULL,
  rubric JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_anchor JSONB NOT NULL DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  generation_source TEXT NOT NULL DEFAULT 'system'
    CHECK (generation_source IN ('system', 'ai', 'manual')),
  ai_job_id UUID REFERENCES ai_jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS assessment_items_session_position_idx
  ON assessment_items(recall_session_id, position, created_at);

CREATE TABLE IF NOT EXISTS recall_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_item_id UUID NOT NULL REFERENCES assessment_items(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  attempt_no INTEGER NOT NULL DEFAULT 1 CHECK (attempt_no > 0),
  response_text TEXT NOT NULL,
  confidence_level TEXT
    CHECK (confidence_level IS NULL OR confidence_level IN ('guessed', 'unsure', 'confident', 'certain')),
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  word_count INTEGER CHECK (word_count IS NULL OR word_count >= 0),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_item_id, attempt_no)
);

CREATE INDEX IF NOT EXISTS recall_responses_user_time_idx
  ON recall_responses(user_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recall_response_id UUID NOT NULL REFERENCES recall_responses(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL
    CHECK (dimension IN ('recall', 'understanding', 'inference', 'connection', 'application', 'specificity', 'calibration')),
  score NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  confidence TEXT NOT NULL DEFAULT 'medium'
    CHECK (confidence IN ('low', 'medium', 'high')),
  evaluator_type TEXT NOT NULL DEFAULT 'hybrid'
    CHECK (evaluator_type IN ('rubric', 'ai', 'hybrid')),
  feedback TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider TEXT,
  model TEXT,
  prompt_version TEXT,
  algorithm_version TEXT NOT NULL,
  ai_job_id UUID REFERENCES ai_jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS evaluations_response_dimension_idx
  ON evaluations(recall_response_id, dimension);

CREATE TABLE IF NOT EXISTS review_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  user_book_id UUID NOT NULL REFERENCES user_books(id) ON DELETE CASCADE,
  memory_item_id UUID NOT NULL REFERENCES memory_items(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'due', 'completed', 'snoozed', 'cancelled')),
  due_at TIMESTAMPTZ NOT NULL,
  interval_days NUMERIC(8,2) CHECK (interval_days IS NULL OR interval_days >= 0),
  priority INTEGER NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  scheduler_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  algorithm_version TEXT NOT NULL,
  completed_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS review_schedules_user_due_idx
  ON review_schedules(user_id, status, due_at);

CREATE INDEX IF NOT EXISTS review_schedules_book_due_idx
  ON review_schedules(user_book_id, status, due_at);

CREATE UNIQUE INDEX IF NOT EXISTS review_schedules_one_open_per_memory_idx
  ON review_schedules(memory_item_id)
  WHERE status IN ('scheduled', 'due', 'snoozed');

CREATE TABLE IF NOT EXISTS review_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_schedule_id UUID NOT NULL REFERENCES review_schedules(id) ON DELETE CASCADE,
  recall_session_id UUID NOT NULL REFERENCES recall_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  outcome TEXT NOT NULL
    CHECK (outcome IN ('remembered', 'partial', 'forgotten')),
  self_confidence TEXT
    CHECK (self_confidence IS NULL OR self_confidence IN ('guessed', 'unsure', 'confident', 'certain')),
  elapsed_days NUMERIC(8,2) CHECK (elapsed_days IS NULL OR elapsed_days >= 0),
  resulting_retention NUMERIC(5,2)
    CHECK (resulting_retention IS NULL OR (resulting_retention >= 0 AND resulting_retention <= 100)),
  next_due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (review_schedule_id, recall_session_id)
);

CREATE INDEX IF NOT EXISTS review_attempts_user_time_idx
  ON review_attempts(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS memory_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_item_id UUID NOT NULL REFERENCES memory_items(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  recall_strength NUMERIC(5,2)
    CHECK (recall_strength IS NULL OR (recall_strength >= 0 AND recall_strength <= 100)),
  retention_estimate NUMERIC(5,2)
    CHECK (retention_estimate IS NULL OR (retention_estimate >= 0 AND retention_estimate <= 100)),
  mastery_score NUMERIC(5,2)
    CHECK (mastery_score IS NULL OR (mastery_score >= 0 AND mastery_score <= 100)),
  confidence TEXT NOT NULL DEFAULT 'insufficient'
    CHECK (confidence IN ('insufficient', 'low', 'medium', 'high')),
  evidence_count INTEGER NOT NULL DEFAULT 0 CHECK (evidence_count >= 0),
  algorithm_version TEXT NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS memory_estimates_memory_time_idx
  ON memory_estimates(memory_item_id, computed_at DESC);

CREATE TABLE IF NOT EXISTS score_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL
    CHECK (scope_type IN ('reader', 'book', 'session')),
  user_book_id UUID REFERENCES user_books(id) ON DELETE CASCADE,
  reading_session_id UUID REFERENCES reading_sessions(id) ON DELETE CASCADE,
  overall_score NUMERIC(5,2)
    CHECK (overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100)),
  confidence TEXT NOT NULL DEFAULT 'insufficient'
    CHECK (confidence IN ('insufficient', 'low', 'medium', 'high')),
  evidence_count INTEGER NOT NULL DEFAULT 0 CHECK (evidence_count >= 0),
  dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
  explanation JSONB NOT NULL DEFAULT '{}'::jsonb,
  algorithm_version TEXT NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (scope_type = 'reader' AND user_book_id IS NULL AND reading_session_id IS NULL)
    OR
    (scope_type = 'book' AND user_book_id IS NOT NULL AND reading_session_id IS NULL)
    OR
    (scope_type = 'session' AND reading_session_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS score_snapshots_user_time_idx
  ON score_snapshots(user_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS score_snapshots_book_time_idx
  ON score_snapshots(user_book_id, computed_at DESC)
  WHERE user_book_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS score_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  score_snapshot_id UUID NOT NULL REFERENCES score_snapshots(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  dimension TEXT NOT NULL,
  raw_value NUMERIC,
  normalized_value NUMERIC(6,3),
  weight NUMERIC(8,4) NOT NULL DEFAULT 1 CHECK (weight >= 0),
  confidence TEXT
    CHECK (confidence IS NULL OR confidence IN ('low', 'medium', 'high')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS score_evidence_snapshot_dimension_idx
  ON score_evidence(score_snapshot_id, dimension);

-- =========================================================
-- GAMIFICATION
-- =========================================================

CREATE TABLE IF NOT EXISTS xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount <> 0),
  reason TEXT NOT NULL,
  source_type TEXT,
  source_id TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS xp_events_user_time_idx
  ON xp_events(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS streak_days (
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  reading_minutes INTEGER NOT NULL DEFAULT 0 CHECK (reading_minutes >= 0),
  reading_sessions INTEGER NOT NULL DEFAULT 0 CHECK (reading_sessions >= 0),
  recall_sessions INTEGER NOT NULL DEFAULT 0 CHECK (recall_sessions >= 0),
  reviews_completed INTEGER NOT NULL DEFAULT 0 CHECK (reviews_completed >= 0),
  reflections_created INTEGER NOT NULL DEFAULT 0 CHECK (reflections_created >= 0),
  qualifies BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, activity_date)
);

CREATE TABLE IF NOT EXISTS achievement_definitions (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL
    CHECK (category IN ('reading', 'memory', 'retention', 'consistency', 'community', 'clubs', 'books')),
  icon_key TEXT,
  rarity TEXT NOT NULL DEFAULT 'common'
    CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic')),
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  xp_reward INTEGER NOT NULL DEFAULT 0 CHECK (xp_reward >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  achievement_code TEXT NOT NULL REFERENCES achievement_definitions(code) ON DELETE CASCADE,
  progress NUMERIC(8,3) NOT NULL DEFAULT 0 CHECK (progress >= 0),
  unlocked_at TIMESTAMPTZ,
  seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, achievement_code)
);

CREATE TABLE IF NOT EXISTS mission_definitions (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  period_type TEXT NOT NULL
    CHECK (period_type IN ('daily', 'weekly', 'one_time')),
  metric_key TEXT NOT NULL,
  target_value INTEGER NOT NULL CHECK (target_value > 0),
  xp_reward INTEGER NOT NULL DEFAULT 0 CHECK (xp_reward >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  mission_code TEXT NOT NULL REFERENCES mission_definitions(code) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
  completed_at TIMESTAMPTZ,
  reward_claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (period_end >= period_start),
  UNIQUE (user_id, mission_code, period_start)
);

CREATE INDEX IF NOT EXISTS user_missions_user_period_idx
  ON user_missions(user_id, period_start DESC);

-- =========================================================
-- CLUBS
-- =========================================================

CREATE TABLE IF NOT EXISTS clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_object_key TEXT,
  visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'private')),
  join_policy TEXT NOT NULL DEFAULT 'open'
    CHECK (join_policy IN ('open', 'approval', 'invite_only')),
  anti_spoiler_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS clubs_status_created_idx
  ON clubs(status, created_at DESC);

CREATE TABLE IF NOT EXISTS club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'moderator', 'member')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'left', 'banned')),
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_id, user_id)
);

CREATE INDEX IF NOT EXISTS club_members_user_status_idx
  ON club_members(user_id, status);

CREATE TABLE IF NOT EXISTS club_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE RESTRICT,
  edition_id UUID REFERENCES editions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'current', 'completed')),
  target_page INTEGER CHECK (target_page IS NULL OR target_page >= 0),
  starts_on DATE,
  ends_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on >= starts_on)
);

CREATE UNIQUE INDEX IF NOT EXISTS club_books_one_current_idx
  ON club_books(club_id)
  WHERE status = 'current';

CREATE TABLE IF NOT EXISTS club_discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  club_book_id UUID REFERENCES club_books(id) ON DELETE SET NULL,
  author_user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  contains_spoiler BOOLEAN NOT NULL DEFAULT FALSE,
  unlock_page INTEGER CHECK (unlock_page IS NULL OR unlock_page >= 0),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'locked', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS club_discussions_club_time_idx
  ON club_discussions(club_id, created_at DESC);

CREATE TABLE IF NOT EXISTS club_discussion_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID NOT NULL REFERENCES club_discussions(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES club_discussion_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  contains_spoiler BOOLEAN NOT NULL DEFAULT FALSE,
  unlock_page INTEGER CHECK (unlock_page IS NULL OR unlock_page >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS club_discussion_comments_discussion_time_idx
  ON club_discussion_comments(discussion_id, created_at);

CREATE TABLE IF NOT EXISTS club_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  created_by_user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  location_text TEXT,
  meeting_url TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS club_meetings_club_schedule_idx
  ON club_meetings(club_id, scheduled_at);

CREATE TABLE IF NOT EXISTS club_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  created_by_user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  multiple_choice BOOLEAN NOT NULL DEFAULT FALSE,
  closes_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS club_poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES club_polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS club_poll_options_poll_position_idx
  ON club_poll_options(poll_id, position);

CREATE TABLE IF NOT EXISTS club_poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES club_polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES club_poll_options(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (poll_id, option_id, user_id)
);

CREATE INDEX IF NOT EXISTS club_poll_votes_poll_user_idx
  ON club_poll_votes(poll_id, user_id);

CREATE TABLE IF NOT EXISTS spoiler_boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  club_book_id UUID REFERENCES club_books(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL
    CHECK (content_type IN ('discussion', 'comment', 'post')),
  content_id UUID NOT NULL,
  unlock_page INTEGER NOT NULL CHECK (unlock_page >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (content_type, content_id)
);

-- =========================================================
-- SOCIAL / COMMUNITY
-- =========================================================

CREATE TABLE IF NOT EXISTS follows (
  follower_user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  followed_user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_user_id, followed_user_id),
  CHECK (follower_user_id <> followed_user_id)
);

CREATE INDEX IF NOT EXISTS follows_followed_idx
  ON follows(followed_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  blocked_user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_user_id, blocked_user_id),
  CHECK (blocker_user_id <> blocked_user_id)
);

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  post_type TEXT NOT NULL DEFAULT 'general'
    CHECK (post_type IN ('general', 'progress', 'insight', 'review', 'reflection', 'book_started', 'book_completed', 'achievement', 'retention')),
  body TEXT,
  user_book_id UUID REFERENCES user_books(id) ON DELETE SET NULL,
  reflection_id UUID REFERENCES reflections(id) ON DELETE SET NULL,
  book_review_id UUID REFERENCES book_reviews(id) ON DELETE SET NULL,
  user_achievement_id UUID REFERENCES user_achievements(id) ON DELETE SET NULL,
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'followers', 'club', 'private')),
  contains_spoiler BOOLEAN NOT NULL DEFAULT FALSE,
  spoiler_unlock_page INTEGER CHECK (spoiler_unlock_page IS NULL OR spoiler_unlock_page >= 0),
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (body IS NOT NULL OR user_book_id IS NOT NULL OR reflection_id IS NOT NULL OR book_review_id IS NOT NULL OR user_achievement_id IS NOT NULL),
  CHECK (visibility <> 'club' OR club_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS posts_feed_idx
  ON posts(published_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS posts_author_time_idx
  ON posts(author_user_id, published_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS posts_club_time_idx
  ON posts(club_id, published_at DESC)
  WHERE club_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS post_comments_post_time_idx
  ON post_comments(post_id, created_at);

CREATE TABLE IF NOT EXISTS post_reactions (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  reaction TEXT NOT NULL DEFAULT 'like'
    CHECK (reaction IN ('like')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id, reaction)
);

CREATE TABLE IF NOT EXISTS saved_posts (
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  target_type TEXT NOT NULL
    CHECK (target_type IN ('user', 'post', 'comment', 'club', 'discussion', 'club_comment')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS content_reports_status_time_idx
  ON content_reports(status, created_at);

-- =========================================================
-- NOTIFICATIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES profiles(user_id) ON DELETE SET NULL,
  category TEXT NOT NULL
    CHECK (category IN ('review', 'reading', 'streak', 'community', 'club', 'achievement', 'system')),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  entity_type TEXT,
  entity_id TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key TEXT,
  deliver_after TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_recipient_time_idx
  ON notifications(recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON notifications(recipient_user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_recipient_dedupe_idx
  ON notifications(recipient_user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- =========================================================
-- UPDATED_AT TRIGGERS WITHOUT "DOES NOT EXIST" NOTICES
-- =========================================================

DO $$
DECLARE
  table_name TEXT;
  trigger_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'book_reviews',
    'ai_jobs',
    'memory_items',
    'review_schedules',
    'achievement_definitions',
    'mission_definitions',
    'user_missions',
    'clubs',
    'club_members',
    'club_books',
    'club_discussions',
    'club_discussion_comments',
    'club_meetings',
    'club_polls',
    'posts',
    'post_comments',
    'notifications'
  ]
  LOOP
    trigger_name := table_name || '_set_updated_at';

    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = trigger_name
        AND tgrelid = to_regclass('public.' || table_name)
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
        trigger_name,
        table_name
      );
    END IF;
  END LOOP;
END
$$;

-- =========================================================
-- INITIAL ACHIEVEMENTS / MISSIONS
-- Definitions only; the API decides when they are earned.
-- =========================================================

INSERT INTO achievement_definitions
  (code, name, description, category, icon_key, rarity, criteria, xp_reward)
VALUES
  (
    'first_recall',
    'Primeiro Recall',
    'Complete seu primeiro recall sem consultar o livro.',
    'memory',
    'recall',
    'common',
    '{"recall_sessions": 1}'::jsonb,
    25
  ),
  (
    'recall_10',
    'Recall Puro',
    'Complete 10 recalls sem consultar o livro.',
    'memory',
    'spark',
    'uncommon',
    '{"recall_sessions": 10}'::jsonb,
    100
  ),
  (
    'retention_30d',
    'Memória de 30 Dias',
    'Confirme uma memória depois de pelo menos 30 dias.',
    'retention',
    'timer',
    'rare',
    '{"retention_days": 30}'::jsonb,
    200
  ),
  (
    'streak_7',
    'Hábito em Formação',
    'Mantenha uma sequência de 7 dias com atividade significativa.',
    'consistency',
    'streak',
    'common',
    '{"streak_days": 7}'::jsonb,
    75
  ),
  (
    'streak_14',
    'Hábito de Ferro',
    'Mantenha uma sequência de 14 dias com atividade significativa.',
    'consistency',
    'streak',
    'uncommon',
    '{"streak_days": 14}'::jsonb,
    150
  )
ON CONFLICT (code) DO NOTHING;

INSERT INTO mission_definitions
  (code, name, description, period_type, metric_key, target_value, xp_reward)
VALUES
  (
    'daily_recall_1',
    'Lembrar sem olhar',
    'Faça um recall de uma leitura sem consultar o livro.',
    'daily',
    'recall_completed',
    1,
    20
  ),
  (
    'daily_read_20',
    '20 minutos de leitura',
    'Leia com foco por pelo menos 20 minutos.',
    'daily',
    'reading_minutes',
    20,
    20
  ),
  (
    'weekly_review_3',
    'Fortalecer memórias',
    'Complete 3 revisões espaçadas nesta semana.',
    'weekly',
    'reviews_completed',
    3,
    60
  )
ON CONFLICT (code) DO NOTHING;

-- =========================================================
-- SCHEMA VERSION
-- =========================================================

INSERT INTO app_meta (key, value)
VALUES (
  'schema_version',
  jsonb_build_object(
    'version', 3,
    'name', 'bubo4-mvp-domain'
  )
)
ON CONFLICT (key)
DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

COMMIT;

-- =========================================================
-- FINAL VERIFICATION
-- =========================================================

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
