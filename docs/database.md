# Database (`packages/database`)

Neon Postgres with Drizzle ORM (ADR-004, ADR-013).

- `createDatabase(url)` returns `{ db, close }`. It uses Drizzle over the Neon **Pool**
  (transactions supported). Open one per request and close it with `ctx.waitUntil(close())`.
- `pingDatabase(url)` runs `select 1` over HTTP and reports latency. Errors never include the URL.
- Schema lives in `src/schema/*.ts`, migrations in `migrations/NNNN_name.sql`.
- `@bubo/database/node` exposes `loadMigrations` and `applyMigrations`. They're Node-only (they use
  the filesystem) and are used by tests, the local server and `db:migrate`.

## Tables

| migration               | table              | key columns                                                                                                                                                                                                                                                                           |
| ----------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0001_foundation`       | `users`            | `id`, `name`, `email` (unique), `email_verified`, `image`, timestamps                                                                                                                                                                                                                 |
|                         | `sessions`         | `id`, `user_id` → users (cascade), `token` (unique), `expires_at`, `ip_address`, `user_agent`                                                                                                                                                                                         |
|                         | `accounts`         | `id`, `user_id` → users (cascade), `account_id`, `provider_id`, tokens + expiries, `password` (hash)                                                                                                                                                                                  |
|                         | `verifications`    | `id`, `identifier`, `value`, `expires_at` (password-reset tokens)                                                                                                                                                                                                                     |
| `0002_onboarding`       | `reader_profiles`  | `user_id` PK → users (cascade), `reading_habit` (CHECK), `goals text[]`, `interests text[]`, `onboarding_completed_at`                                                                                                                                                                |
|                         | `books`            | `id`, `title` (1–300), `author` (1–200), `total_pages` (1–20000), `isbn`, `created_by_user_id` → users (set null)                                                                                                                                                                     |
|                         | `shelf_entries`    | `id`, `user_id` → users (cascade), `book_id` → books (cascade), `status` (CHECK), `current_page ≥ 0`, `started_at`, `finished_at`; unique (`user_id`, `book_id`)                                                                                                                      |
| `0003_auth_rate_limits` | `rate_limits`      | `id`, `key` (unique), `count`, `last_request` (epoch ms)                                                                                                                                                                                                                              |
| `0004_reading_sessions` | `reading_sessions` | `id` (client UUID), `user_id` → users (cascade), `shelf_entry_id` → shelf_entries (cascade), `started_at` ≤ `ended_at`, `focused_seconds` 60–14400, `start_page` ≤ `end_page`, `reflection` ≤ 2000, `local_date`, `xp_earned`                                                         |
| `0005_recall`           | `recall_cards`     | `id`, `user_id` → users (cascade), `shelf_entry_id` → shelf_entries (cascade), `session_id` → reading_sessions (set null, unique), `prompt` 1–500, `answer` ≤ 2000, `source` (reflection/manual), `repetitions`, `interval_days`, `ease_x100` 130–500, `due_date`, `last_reviewed_at` |
|                         | `review_logs`      | `id` (client UUID), `user_id`, `card_id` → recall_cards (cascade), `grade` 0–5, `reviewed_at`, `local_date`, `interval_days`, `xp_earned`                                                                                                                                             |

All timestamps are `timestamptz`. Allowed enum values are enforced twice: by SQL `CHECK`
constraints and by the Zod contracts, using the ids from `@bubo/domain`.

## Migrations

```sh
DATABASE_URL=postgres://… npm run db:migrate --workspace @bubo/database
```

- Files apply in order, each in a transaction, and are tracked in `_bubo_migrations`. Re-running is
  a no-op.
- Tests:
  - `test/schema.test.ts` fails if the Drizzle schema and the SQL disagree on tables or columns, or
    if the numbering breaks.
  - `test/migrator.test.ts` applies everything to PGlite and checks constraints, cascades,
    rollback and idempotency.
- Never edit an applied migration. Add the next `NNNN_description.sql` instead.
- **No migration has been applied to any remote database.** Neon needs an explicit
  `db:migrate` run.
