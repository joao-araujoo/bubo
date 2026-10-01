# Database (`packages/database`)

Neon Postgres with Drizzle ORM (ADR-004, ADR-013).

- `createDatabase(url)` returns `{ db, close }`. It uses Drizzle over the Neon **Pool**
  (transactions supported). Open one per request and close it with `ctx.waitUntil(close())`.
- `pingDatabase(url)` runs `select 1` over HTTP and reports latency. Errors never include the URL.
- Schema lives in `src/schema/*.ts`, migrations in `migrations/NNNN_name.sql`.
- `@bubo/database/node` exposes `loadMigrations` and `applyMigrations`. They're Node-only (they use
  the filesystem) and are used by tests, the local server and `db:migrate`.

## Tables

| migration                  | table                      | key columns                                                                                                                                                                                                                                                                           |
| -------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0001_foundation`          | `users`                    | `id`, `name`, `email` (unique), `email_verified`, `image`, timestamps                                                                                                                                                                                                                 |
|                            | `sessions`                 | `id`, `user_id` → users (cascade), `token` (unique), `expires_at`, `ip_address`, `user_agent`                                                                                                                                                                                         |
|                            | `accounts`                 | `id`, `user_id` → users (cascade), `account_id`, `provider_id`, tokens + expiries, `password` (hash)                                                                                                                                                                                  |
|                            | `verifications`            | `id`, `identifier`, `value`, `expires_at` (password-reset tokens)                                                                                                                                                                                                                     |
| `0002_onboarding`          | `reader_profiles`          | `user_id` PK → users (cascade), `reading_habit` (CHECK), `goals text[]`, `interests text[]`, `onboarding_completed_at`                                                                                                                                                                |
|                            | `books`                    | `id`, `title` (1–300), `author` (1–200), `total_pages` (1–20000), `isbn`, `created_by_user_id` → users (set null)                                                                                                                                                                     |
|                            | `shelf_entries`            | `id`, `user_id` → users (cascade), `book_id` → books (cascade), `status` (CHECK), `current_page ≥ 0`, `started_at`, `finished_at`; unique (`user_id`, `book_id`)                                                                                                                      |
| `0003_auth_rate_limits`    | `rate_limits`              | `id`, `key` (unique), `count`, `last_request` (epoch ms)                                                                                                                                                                                                                              |
| `0004_reading_sessions`    | `reading_sessions`         | `id` (client UUID), `user_id` → users (cascade), `shelf_entry_id` → shelf_entries (cascade), `started_at` ≤ `ended_at`, `focused_seconds` 60–14400, `start_page` ≤ `end_page`, `reflection` ≤ 2000, `local_date`, `xp_earned`                                                         |
| `0005_recall`              | `recall_cards`             | `id`, `user_id` → users (cascade), `shelf_entry_id` → shelf_entries (cascade), `session_id` → reading_sessions (set null, unique), `prompt` 1–500, `answer` ≤ 2000, `source` (reflection/manual), `repetitions`, `interval_days`, `ease_x100` 130–500, `due_date`, `last_reviewed_at` |
|                            | `review_logs`              | `id` (client UUID), `user_id`, `card_id` → recall_cards (cascade), `grade` 0–5, `reviewed_at`, `local_date`, `interval_days`, `xp_earned`                                                                                                                                             |
| `0006_catalog`             | `books` (+ columns)        | `catalog_key` (unique when set), `cover_url` (https), `publisher`, `published_year`, `description`, `language`                                                                                                                                                                        |
| `0007_shelf_entry_pages`   | `shelf_entries` (+ column) | `total_pages` 1–20000: the reader's own page count for a shared catalog book                                                                                                                                                                                                          |
| `0008_community`           | `clubs`                    | `id`, `owner_user_id` → users (cascade), `name` 3–60, `description` ≤ 500, `icon` (CHECK), `book_id` → books (**restrict**), `weekly_goal_pages` (50/75/100)                                                                                                                          |
|                            | `club_members`             | PK (`club_id`, `user_id`), both cascade, `role` (owner/member), `joined_at`                                                                                                                                                                                                           |
|                            | `club_posts`               | `id` (client UUID), `club_id`, `author_user_id` (cascade), `title` 3–120, `body` 1–4000, `spoiler_page` 0–20000, `status` (visible/hidden/removed)                                                                                                                                    |
|                            | `club_replies`             | `id` (client UUID), `post_id`, `club_id`, `author_user_id` (cascade), `body` 1–2000, `spoiler_page`, `status`                                                                                                                                                                         |
|                            | `content_reports`          | `id`, `reporter_user_id`, `club_id` (cascade), `target_type` (post/reply), `target_id`, `reason` (CHECK), `details` ≤ 500, `status` (open/resolved); unique (reporter, target)                                                                                                        |
|                            | `user_blocks`              | PK (`blocker_user_id`, `blocked_user_id`), both cascade, CHECK blocker ≠ blocked                                                                                                                                                                                                      |
| `0009_club_polls_invites`  | `clubs` (+ columns)        | `visibility` (public/private, default public), `invite_code` (8 chars, unambiguous alphabet, unique when set)                                                                                                                                                                         |
|                            | `club_posts` (+ columns)   | `kind` (discussion/philosophical/worldbuilding/character/question, default discussion), `chapter` 1–999, `quote` ≤ 500                                                                                                                                                                |
|                            | `club_polls`               | `id` (client UUID), `club_id`, `author_user_id` (cascade), `question` 5–200, `spoiler_page`, `multiple`, `closes_at`, `status`                                                                                                                                                        |
|                            | `club_poll_options`        | `id`, `poll_id` (cascade), `position` 0–3 (unique per poll), `label` 1–120                                                                                                                                                                                                            |
|                            | `club_poll_votes`          | PK (`poll_id`, `option_id`, `user_id`), all cascade                                                                                                                                                                                                                                   |
|                            | `club_poll_arguments`      | `id`, `poll_id`, `club_id`, `author_user_id` (cascade), `body` 1–1000, `status`; unique (poll, author)                                                                                                                                                                                |
|                            | `club_reactions`           | PK (`user_id`, `target_type`, `target_id`, `kind`); `target_type` post/reply/argument, `kind` insight/idea/counterpoint                                                                                                                                                               |
|                            | `content_reports` (CHECK)  | `target_type` now also `poll` and `argument`                                                                                                                                                                                                                                          |
| `0010_club_book_reviews`   | `club_posts` (+ columns)   | `review_rating` 1–5 (only kind discussion, body ≥ 30), `review_tags` text[] ≤ 3 (only with a rating); partial index on reviews (ADR-021)                                                                                                                                              |
| `0011_club_reading_cycles` | `club_cycles`              | `id` (client UUID), `club_id` (cascade), `goal_pages` 1–20000, `started_at`, `ends_at` > start, `closed_at`; one open cycle per club (partial unique index)                                                                                                                           |
|                            | `club_cycle_members`       | PK (`cycle_id`, `user_id`), both cascade: members snapshotted when the cycle starts                                                                                                                                                                                                   |
| `0012_reader_friendships`  | `club_friendships`         | `id` = unordered pair id, `sender_id`/`recipient_id` (cascade, CHECK different), `accepted_at`, `created_at`; unique on (least, greatest)                                                                                                                                             |
|                            | `club_social_preferences`  | PK `user_id` (cascade), `allow_requests` (default true), `share_activity` (default false), `sharing_since`                                                                                                                                                                            |

All timestamps are `timestamptz`. Allowed enum values are enforced twice: by SQL `CHECK`
constraints and by the Zod contracts, using the ids from `@bubo/domain`.

## Migrations

```sh
npm run db:migrate:check   # read-only: prints {"pending": [...], "changesMade": false}
npm run db:migrate         # applies pending migrations to DATABASE_URL
```

Before 2026-09-28 the root `db:migrate -- --check` did **not** forward `--check` (npm consumed it)
and applied migrations; the root script now ends with `--` and `db:migrate:check` exists.

- Files apply in order, each in a transaction, and are tracked in `_bubo_migrations`. Re-running is
  a no-op.
- Tests:
  - `test/schema.test.ts` fails if the Drizzle schema and the SQL disagree on tables or columns, or
    if the numbering breaks.
  - `test/migrator.test.ts` applies everything to PGlite and checks constraints, cascades,
    rollback and idempotency.
- Never edit an applied migration. Add the next `NNNN_description.sql` instead.
- Remote state (which migrations Neon has) is tracked in [release.md](release.md) → "Current
  remote state". Apply new migrations **before** deploying code that needs them.
