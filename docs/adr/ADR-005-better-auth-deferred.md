# ADR-005 — Better Auth, with the wiring deferred to Task 02

- Status: Implemented in Task 02. See ADR-012.
- Date: 2026-09-26

## Context

Authentication is Task 02 (auth + onboarding). The brief allows a Better Auth skeleton in Task 01
only if it's safe. A half-wired auth endpoint would be a security liability: default secrets,
unreviewed session and CORS settings, and routes nobody tested.

## Decision

- No auth routes or Better Auth runtime in Task 01. The `better-auth` package isn't installed yet,
  so there is no dead or unsafe code.
- The ground is prepared instead:
  - `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` are validated by `@bubo/config`. The secret needs
    at least 32 characters, and both are required in production.
  - The core tables exist in `0001_foundation` with the field names Better Auth expects.
- Task 02 will:
  1. Install `better-auth`.
  2. Configure `drizzleAdapter(db, { provider: 'pg', usePlural: true, schema })`.
  3. Mount it under `/v1/auth/*`.
  4. Add the Expo client with secure token storage (`expo-secure-store`).

## Consequences

- Task 02 starts from a validated config and an existing schema. It doesn't have to undo
  anything.
- If a future Better Auth version changes its core schema, Task 02 adds a `0002_` migration.

## Alternatives considered

- **Mounting a Better Auth skeleton now:** unsafe and untested. Rejected.
- **Clerk, Auth0, Supabase Auth:** vendor lock-in and per-user cost. Better Auth keeps the data in
  our Postgres.
- **Hand-rolled sessions:** risky and slow to get right.
