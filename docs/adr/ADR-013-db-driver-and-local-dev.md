# ADR-013 — Neon Pool per request, PGlite for tests and local development

- Status: Accepted (refines ADR-004)
- Date: 2026-09-26

## Context

Onboarding writes a profile, a book and a shelf entry. Those three writes must be atomic.
Drizzle's `neon-http` driver doesn't support interactive transactions. We also want to run the full
stack (auth included) with no cloud resources: no remote Neon changes without an explicit
decision, and tests that run offline.

## Decision

**Worker (Neon)**

- `createDatabase(url)` returns `{ db, close }`, with Drizzle over `@neondatabase/serverless`
  **Pool** (WebSocket), so transactions are supported.
- It's opened per request by `withDatabase` and closed with `ctx.waitUntil(close())`. A Pool is
  never shared across requests.
- `pingDatabase` keeps using the HTTP driver: it's cheap and stateless.

**Migrations**

- One driver-agnostic migrator (`packages/database/src/migrator.ts`) runs everywhere:
  - PGlite, in tests and the local server
  - Neon Pool, via `npm run db:migrate --workspace @bubo/database`, which needs `DATABASE_URL`

**Tests and local development**

- `@electric-sql/pglite@0.5.8` provides embedded Postgres 17 in WASM. `apps/api/dev/pglite.ts`
  applies every migration and hands the same Drizzle schema to the app.
- The PGlite database is cast to the Neon type. Only the driver-specific type parameters differ:
  both share `drizzle-orm/pg-core`.
- `npm run dev:api` runs `scripts/dev-api.mjs`:
  - `DATABASE_URL` set in `apps/api/.dev.vars` → `wrangler dev` (Worker + Neon).
  - Not set → `apps/api/dev/local-server.ts`: the same Hono app on Node, `@hono/node-server`,
    PGlite persisted in `apps/api/.local/` (gitignored and excluded from the ZIP), an in-memory
    R2 bucket, and `0.0.0.0:8787` so a phone on the LAN can reach it.

## Consequences

- Auth and onboarding tests run against real Postgres semantics (constraints, cascades,
  transactions) in seconds, with no network.
- The local dev server isn't the Workers runtime. Use `wrangler dev` (with a Neon dev branch)
  before releases.
- `apps/api/.local/` holds real local accounts. Never commit or ship it.

## Alternatives considered

- **`neon-http` with `db.batch`:** PGlite has no equivalent, so tests would diverge.
- **Docker Postgres:** an extra system dependency on Windows.
- **Running migrations on the user's Neon database automatically:** that's a remote change, and it
  needs an explicit go-ahead.
