# ADR-004 — Neon Postgres + Drizzle ORM, SQL-first migrations

- Status: Accepted. ADR-013 refines it: in Task 02 the Worker switched to the Neon Pool driver for
  transactions, and tests and local dev use PGlite.
- Date: 2026-09-26

## Context

Bubo needs relational data (books, reading cycles, recall cards, clubs). The API runs on Workers,
so it can't hold TCP pools. The brief asks for Drizzle + `@neondatabase/serverless` if compatible,
and a `0001_` migration.

## Decision

- Neon Postgres, reached with `@neondatabase/serverless@1.1.0`:
  - The HTTP driver (`neon()`) is used inside the Worker. It's stateless per request.
  - `Pool` over WebSocket is used only by the migration script, for transactions.
- `drizzle-orm@0.45.3` (`drizzle-orm/neon-http`) for typed queries. Compatible: this is the
  officially supported driver pairing.
- Migrations are plain SQL in `packages/database/migrations/NNNN_name.sql`, starting at
  `0001_foundation.sql`. They're applied by `npm run db:migrate --workspace @bubo/database`, which
  needs `DATABASE_URL`, is idempotent and tracks runs in `_bubo_migrations`.
- `test/schema.test.ts` fails if the Drizzle schema and the SQL migrations disagree on tables or
  columns, or if the numbering breaks.
- `0001_foundation` creates only the Better Auth core tables: `users`, `sessions`, `accounts`,
  `verifications`. It uses plural names and snake_case columns (see ADR-005).

## Consequences

- Migrations are reviewable SQL, with no generator lock-in and no journal files to keep in sync.
- Developers must update the schema and the SQL together. The test enforces it.
- No migration was run against any remote database in Task 01.

## Alternatives considered

- **drizzle-kit generate/migrate:** it numbers from `0000` and needs its journal. We may adopt it
  later for diffing. Its output can be copied into the next `NNNN_` file.
- **Prisma:** heavier on Workers, with a separate engine and schema language.
- **Cloudflare D1 (SQLite):** weaker fit for relational features, and the brief chose Neon.
- **Hyperdrive + TCP driver:** a valid future option for heavy queries. HTTP is simpler for now.
