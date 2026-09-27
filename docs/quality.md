# Quality gates

`npm run verify` is the definition of done (ADR-011).

| step           | tool                                          | scope                                                 |
| -------------- | --------------------------------------------- | ----------------------------------------------------- |
| `format:check` | Prettier 3.9                                  | all text files except raw design drops and binaries   |
| `lint`         | ESLint 10 + typescript-eslint 8 + react-hooks | whole repo, `--max-warnings=0`                        |
| `typecheck`    | TypeScript 6.0 (`tsc`, strict)                | each workspace                                        |
| `test`         | Vitest 5                                      | `packages/*`, `apps/api`                              |
| `assets:check` | `scripts/check-assets.mjs`                    | official asset hashes, derived files, mobile registry |
| `audit:repo`   | `scripts/audit-repo.mjs`                      | repository policy (below)                             |

## Repository policy (`audit:repo`)

The audit fails on any of these:

- lockfiles or scripts from pnpm, Yarn or Bun
- OpenAI packages, imports or endpoints
- Gemini keys or endpoints inside `apps/mobile/src`
- `@ts-ignore`, `@ts-nocheck` or explicit `any` in code
- TODO / FIXME / XXX / HACK markers in code
- raw hex colours in `apps/mobile/src` outside `src/theme`
- committed-looking secrets: Google API keys, `sk-` keys, credentialed Postgres URLs
- a tab set that isn't exactly the five official tabs

It also warns, without failing, if local secret files exist. Those are gitignored and excluded from
the ZIP.

## Test inventory

| package            | covers                                                                                                                                                                                                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@bubo/config`     | env defaults, empty-string handling, production requirements, no secret echo                                                                                                                                                                                                                       |
| `@bubo/contracts`  | error model, health/ready schemas, OpenAPI generation, onboarding/me schemas, security on protected routes                                                                                                                                                                                         |
| `@bubo/domain`     | reading progress edge cases, Monday→Sunday week, local dates, Result, ISO dates, streak, session→shelf progress, status timestamps                                                                                                                                                                 |
| `@bubo/scoring`    | retention curve, SM-2 intervals/reset/min ease, XP caps                                                                                                                                                                                                                                            |
| `@bubo/database`   | Drizzle ↔ SQL sync, numbering, plural keys; migrator on PGlite (idempotency, rollback), CHECK constraints, cascades                                                                                                                                                                                |
| `@bubo/testing`    | helpers themselves                                                                                                                                                                                                                                                                                 |
| `@bubo/api`        | health (no DB), ready (all states, no URL leak), request id, 404 envelope, security headers, redacted logs, OpenAPI, Gemini client, R2 storage, redaction                                                                                                                                          |
| `@bubo/api` auth   | real Better Auth on PGlite: sign-up, sign-in, sign-out, duplicate/weak passwords, 401s, forged cookie, 503s, onboarding (422, idempotency, skip), shelf, isolation, reset flow + session revocation, no account enumeration, redirect guard, CSRF/origin, rate limit, no secrets in logs           |
| `@bubo/api` shelf  | shelf CRUD, duplicates (409), status/page rules, removal cascade, cross-reader isolation (404), sessions (progress, XP cap, finish on last page, idempotent retry, implausible timing/pages rejected), stats (zero state, streak across days, week)                                                |
| `@bubo/api` recall | reflection → card, manual cards + validation, cross-reader isolation, SM-2 intervals (1 → 6 → reset), no early review (409), idempotent retry, XP, review days in streak/week; e-mail (Resend request, failures, dev-only logging, HTML escaping); account deletion (password check, full cascade) |

## Mobile

The mobile app has no unit-test runner yet (see ADR-011). It's covered by:

- typecheck and lint
- `expo install --check`
- `expo config`
- `expo export` bundle smoke tests (Android and iOS)
- typed routes (`.expo/types`), checked after `expo start`

The audit also fails when a committed `*.example` template carries a value for a secret variable.
