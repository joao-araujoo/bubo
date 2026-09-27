# API (`apps/api`)

- Base path: `/v1`
- Runtime: Cloudflare Workers + Hono
- Live, generated OpenAPI document: `GET /v1/openapi.json`

## Endpoints

| method   | path                              | auth    | purpose                                                             | success                             | failure                                     |
| -------- | --------------------------------- | ------- | ------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------- |
| GET      | `/v1/health`                      | public  | liveness. **No DB, no third parties.**                              | 200 `HealthResponse`                | never fails because of config               |
| GET      | `/v1/ready`                       | public  | readiness: config valid + DB `select 1`                             | 200 `ReadyResponse`                 | 503 `ReadyResponse` (`not_ready`)           |
| GET      | `/v1/openapi.json`                | public  | OpenAPI 3.0 document built from Zod                                 | 200                                 | —                                           |
| GET/POST | `/v1/auth/*`                      | —       | Better Auth (see below)                                             | Better Auth JSON                    | Better Auth JSON; 403 for blocked redirects |
| GET      | `/v1/me`                          | session | reader + onboarding state (`MeResponse`)                            | 200                                 | 401, 503                                    |
| PUT      | `/v1/me/onboarding`               | session | save habit, goals, interests, optional first book                   | 200 `MeResponse`                    | 400 bad JSON, 422 `VALIDATION_FAILED`, 401  |
| GET      | `/v1/shelf`                       | session | the reader's shelf (`ShelfResponse`), newest first                  | 200                                 | 401, 503                                    |
| GET      | `/v1/me/stats?today=YYYY-MM-DD`   | session | XP, streak, week activity, `readToday` from real sessions           | 200 `StatsResponse`                 | 422 bad/missing `today`                     |
| POST     | `/v1/shelf`                       | session | add a book manually (`quero ler` or `lendo`)                        | 201 `ShelfEntry`                    | 409 already on shelf, 422                   |
| GET      | `/v1/shelf/:id`                   | session | one entry + its recent sessions                                     | 200 `ShelfEntryDetail`              | 404 (also for other readers' entries)       |
| PATCH    | `/v1/shelf/:id`                   | session | status / current page / page count                                  | 200 `ShelfEntry`                    | 404, 422 (page beyond the book)             |
| DELETE   | `/v1/shelf/:id`                   | session | remove the entry and its sessions                                   | 200 `{ deleted: true }`             | 404                                         |
| POST     | `/v1/sessions`                    | session | record a finished focused session (idempotent on `id`)              | 201 new / 200 retry `SessionResult` | 404, 422 implausible timing or pages        |
| GET      | `/v1/recall/due?today=YYYY-MM-DD` | session | cards due today or earlier (+ counts, next due date)                | 200 `DueCardsResponse`              | 422 bad `today`                             |
| POST     | `/v1/recall/cards`                | session | create a card for a book on the shelf (first due tomorrow)          | 201 `RecallCard`                    | 404, 422                                    |
| DELETE   | `/v1/recall/cards/:id`            | session | delete a card                                                       | 200 `{ deleted: true }`             | 404                                         |
| POST     | `/v1/recall/cards/:id/review`     | session | self-grade a recall (SM-2), idempotent on `id`                      | 201 new / 200 retry `ReviewResult`  | 404, 409 not due yet, 422                   |
| POST     | `/v1/auth/delete-user`            | session | Better Auth: delete the account (`{ password }`); all data cascades | 200                                 | 400/401 wrong password                      |

**Better Auth endpoints** (under `/v1/auth`):

- `POST /sign-up/email`
- `POST /sign-in/email`
- `POST /sign-out`
- `GET /get-session`
- `POST /request-password-reset`
- `GET /reset-password/:token` (e-mailed link, which redirects to the app)
- `POST /reset-password`

See ADR-012 for origin and redirect rules and rate limits.

**Session:** a `better-auth.session_token` cookie. The mobile app stores it in SecureStore and sends
it as a `Cookie` header.

`PUT /v1/me/onboarding` is idempotent:

- Re-submitting updates the answers.
- The original completion time is kept.
- The first book is never duplicated (matched by title, case-insensitive).
- All writes happen in one transaction.

DB-backed routes return `503 SERVICE_UNAVAILABLE` when `DATABASE_URL` or `BETTER_AUTH_SECRET` is
missing.

## Conventions

- Every response carries `X-Request-Id`. A well-formed incoming id (8–128 chars `[A-Za-z0-9._:-]`)
  is echoed back. Otherwise a UUID is generated.
- Errors always use this envelope:

  ```json
  {
    "error": {
      "code": "NOT_FOUND",
      "message": "…",
      "requestId": "…",
      "issues": [{ "path": "…", "message": "…" }]
    }
  }
  ```

  The codes are:
  - `BAD_REQUEST`
  - `VALIDATION_FAILED`
  - `UNAUTHORIZED`
  - `FORBIDDEN`
  - `NOT_FOUND`
  - `CONFLICT`
  - `RATE_LIMITED`
  - `SERVICE_UNAVAILABLE`
  - `UPSTREAM_ERROR`
  - `INTERNAL_ERROR`

  Unknown errors become `INTERNAL_ERROR` with no internals exposed.

- Logs are one JSON line per request (`method`, `path`, `status`, `durationMs`, `requestId`).
  Keys that look like secrets, tokens, passwords, authorization or database URLs are redacted.
- Security headers come from `hono/secure-headers`. CORS is enabled only when
  `APP_ENV=development`, because native apps don't need it.

## Services

- **`GeminiService`** (`src/services/gemini.ts`):
  - `generateText(prompt, { systemInstruction, temperature, maxOutputTokens, json })`
  - Key in a header, with a timeout.
  - Errors map to `SERVICE_UNAVAILABLE`, `RATE_LIMITED` or `UPSTREAM_ERROR`.
- **`MediaStorage`** (`src/services/media.ts`):
  - Wraps the R2 `MEDIA` binding (bucket `bubo`).
  - `mediaKey('covers' | 'avatars' | 'uploads', …segments)` rejects traversal and odd characters.
  - `putImage` accepts only JPEG, PNG or WebP up to 5 MB.

## Adding a route

1. Add schemas to `packages/contracts` and an entry to `API_ROUTE_DEFINITIONS`.
2. Implement it in `apps/api/src/routes/*` using `AppError` for expected failures.
3. Test it with `app.request()` and injected dependencies (`apps/api/test`).
4. Add a typed method to the mobile `api` client and a query hook.

## Security note

- Only `/v1/health`, `/v1/ready` and `/v1/openapi.json` are public. They expose no user data.
- Every data route is mounted behind `withDatabase → withAuth → requireSession`. Queries are always
  scoped to `session.user.id`.
- New data routes must follow the same pattern and be listed with `auth: true` in
  `API_ROUTE_DEFINITIONS`.
