# API (`apps/api`)

- Base path: `/v1`
- Runtime: Cloudflare Workers + Hono
- Live, generated OpenAPI document: `GET /v1/openapi.json`

## Endpoints

| method   | path                                   | auth    | purpose                                                                                                    | success                             | failure                                     |
| -------- | -------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------- |
| GET      | `/v1/health`                           | public  | liveness. **No DB, no third parties.**                                                                     | 200 `HealthResponse`                | never fails because of config               |
| GET      | `/v1/ready`                            | public  | readiness: config valid + DB `select 1`                                                                    | 200 `ReadyResponse`                 | 503 `ReadyResponse` (`not_ready`)           |
| GET      | `/v1/openapi.json`                     | public  | OpenAPI 3.0 document built from Zod                                                                        | 200                                 | —                                           |
| GET/POST | `/v1/auth/*`                           | —       | Better Auth (see below)                                                                                    | Better Auth JSON                    | Better Auth JSON; 403 for blocked redirects |
| GET      | `/v1/me`                               | session | reader + onboarding state (`MeResponse`)                                                                   | 200                                 | 401, 503                                    |
| PUT      | `/v1/me/onboarding`                    | session | save habit, goals, interests, optional first book                                                          | 200 `MeResponse`                    | 400 bad JSON, 422 `VALIDATION_FAILED`, 401  |
| GET      | `/v1/shelf`                            | session | the reader's shelf (`ShelfResponse`), newest first                                                         | 200                                 | 401, 503                                    |
| GET      | `/v1/me/stats?today=YYYY-MM-DD`        | session | XP, streak, week activity, `readToday` from real sessions                                                  | 200 `StatsResponse`                 | 422 bad/missing `today`                     |
| GET      | `/v1/me/achievements?today=`           | session | level (from XP) + 13 badges recomputed from activity (ADR-018)                                             | 200 `AchievementsResponse`          | 422 bad/missing `today`                     |
| GET      | `/v1/me/memory?today=&days=&tz=`       | session | Lembrei/Quase/Esqueci by day (7/30/90/365), by book, by local time of day; cards, focus (ADR-020)          | 200 `MemoryStatsResponse`           | 422 bad `today`/`days`/`tz`                 |
| POST     | `/v1/shelf`                            | session | add a book manually (`quero ler` or `lendo`)                                                               | 201 `ShelfEntry`                    | 409 already on shelf, 422                   |
| GET      | `/v1/shelf/:id`                        | session | one entry + recent sessions, its cards and its last 20 reviews                                             | 200 `ShelfEntryDetail`              | 404 (also for other readers' entries)       |
| PATCH    | `/v1/shelf/:id`                        | session | status / current page / page count                                                                         | 200 `ShelfEntry`                    | 404, 422 (page beyond the book)             |
| DELETE   | `/v1/shelf/:id`                        | session | remove the entry and its sessions                                                                          | 200 `{ deleted: true }`             | 404                                         |
| POST     | `/v1/sessions/assessment`              | session | check idea/detail/connection without recording; optional consented Gemini question                         | 200 `AssessSessionResponse`         | 404 owner entry, 422 shape, 429             |
| POST     | `/v1/sessions`                         | session | record after server-side recall checklist passes (idempotent on `id`)                                      | 201 new / 200 retry `SessionResult` | 404, 422 recall, timing or pages            |
| GET      | `/v1/recall/due?today=YYYY-MM-DD`      | session | cards due today or earlier (+ counts, next due date)                                                       | 200 `DueCardsResponse`              | 422 bad `today`                             |
| POST     | `/v1/recall/cards`                     | session | create a card for a book on the shelf (first due tomorrow)                                                 | 201 `RecallCard`                    | 404, 422                                    |
| DELETE   | `/v1/recall/cards/:id`                 | session | delete a card                                                                                              | 200 `{ deleted: true }`             | 404                                         |
| POST     | `/v1/recall/cards/:id/review`          | session | self-grade a recall (SM-2), idempotent on `id`                                                             | 201 new / 200 retry `ReviewResult`  | 404, 409 not due yet, 422                   |
| GET      | `/v1/catalog/search?q=&limit=`         | session | Google Books + Open Library (+ BrasilAPI ISBN), merged by edition                                          | 200 `CatalogSearchResponse`         | 422 short `q`, 429, 503 all sources failed  |
| GET      | `/v1/catalog/books/:catalogId`         | session | one catalog edition + whether it is on the shelf                                                           | 200 `CatalogBookResponse`           | 404 unknown id, 429                         |
| GET      | `/v1/catalog/isbn/:isbn`               | session | ISBN-10/13 lookup (scanner); never substitutes another ISBN                                                | 200 `CatalogBookResponse`           | 404 no book, 422 invalid ISBN, 429          |
| GET      | `/v1/clubs?q=`                         | session | my clubs + public clubs to discover (search name/book)                                                     | 200 `ClubsResponse`                 | 401                                         |
| POST     | `/v1/clubs`                            | session | create a club around a catalog book from my shelf                                                          | 201 `ClubDetail`                    | 404 entry, 409 5 clubs, 422 manual book     |
| GET      | `/v1/clubs/:id`                        | session | club, my role, my page, open reports (owner)                                                               | 200 `ClubDetail`                    | 404                                         |
| DELETE   | `/v1/clubs/:id`                        | session | delete club + all content (owner)                                                                          | 200 `{ deleted: true }`             | 403, 404                                    |
| PUT      | `/v1/clubs/:id/membership`             | session | join (`acceptGuidelines: true`), shelves the book                                                          | 200 `ClubDetail`                    | 404, 422                                    |
| DELETE   | `/v1/clubs/:id/membership`             | session | leave (owner can't)                                                                                        | 200 `{ deleted: true }`             | 409 owner                                   |
| GET      | `/v1/clubs/:id/posts`                  | session | topics; beyond my page → `locked`, no text                                                                 | 200 `ClubPostsResponse`             | 403 not member                              |
| POST     | `/v1/clubs/:id/posts`                  | session | topic anchored to a page (idempotent on `id`)                                                              | 201 new / 200 retry `ClubPost`      | 403, 409 id, 422 page, 429                  |
| GET      | `/v1/clubs/:id/posts/:postId`          | session | topic + replies; `?reveal=1` = espiar                                                                      | 200 `ClubTopicResponse`             | 403, 404                                    |
| DELETE   | `/v1/clubs/:id/posts/:postId`          | session | author deletes / owner removes                                                                             | 200 `{ deleted: true }`             | 403, 404                                    |
| POST     | `/v1/clubs/:id/posts/:postId/replies`  | session | reply (page ≥ topic page; idempotent)                                                                      | 201 / 200 `ClubReply`               | 403, 404, 409, 422, 429                     |
| DELETE   | `/v1/clubs/:id/replies/:replyId`       | session | author deletes / owner removes                                                                             | 200 `{ deleted: true }`             | 403, 404                                    |
| POST     | `/v1/clubs/:id/moderation`             | session | owner: remove or restore, resolves reports                                                                 | 200 `{ status }`                    | 403, 404                                    |
| POST     | `/v1/reports`                          | session | report topic/reply/poll/argument (idempotent; 3 → hidden)                                                  | 200 `{ reported: true }`            | 403, 404, 422 own, 429                      |
| GET      | `/v1/blocks`                           | session | readers I blocked                                                                                          | 200 `BlocksResponse`                | 401                                         |
| POST     | `/v1/blocks`                           | session | block a reader (idempotent)                                                                                | 200 `BlocksResponse`                | 404, 422 self                               |
| DELETE   | `/v1/blocks/:userId`                   | session | unblock                                                                                                    | 200 `BlocksResponse`                | 401                                         |
| GET      | `/v1/community/feed`                   | session | newest 30 topics + polls of my clubs, locked per club; `newLast24h`                                        | 200 `CommunityFeedResponse`         | 401                                         |
| GET      | `/v1/clubs/invite/:code`               | session | preview the club an invite leads to (also private clubs)                                                   | 200 `ClubSummary`                   | 404 unknown/rotated code                    |
| POST     | `/v1/clubs/join`                       | session | join by code (`acceptGuidelines: true`), shelves the book; idempotent                                      | 200 `ClubDetail`                    | 404, 422                                    |
| POST     | `/v1/clubs/:id/invite-code`            | session | owner: replace the invite code (old one stops working)                                                     | 200 `{ inviteCode }`                | 403, 404                                    |
| GET      | `/v1/clubs/:id/members`                | session | members, their page, level, page distribution, club totals                                                 | 200 `ClubMembersResponse`           | 403 not member                              |
| GET      | `/v1/clubs/:id/polls`                  | session | polls, newest first, spoiler-locked like topics                                                            | 200 `ClubPollsResponse`             | 403                                         |
| POST     | `/v1/clubs/:id/polls`                  | session | create a poll: 2–4 options, 3/7 days, lock page (idempotent on `id`)                                       | 201 new / 200 retry `ClubPoll`      | 403, 409 id, 422, 429                       |
| GET      | `/v1/clubs/:id/polls/:pollId`          | session | poll + arguments; results only after voting/closing/author; `?reveal=1`                                    | 200 `ClubPollDetail`                | 403, 404                                    |
| DELETE   | `/v1/clubs/:id/polls/:pollId`          | session | author deletes / owner removes                                                                             | 200 `{ deleted: true }`             | 403, 404                                    |
| PUT      | `/v1/clubs/:id/polls/:pollId/vote`     | session | replace my vote while open                                                                                 | 200 `ClubPoll`                      | 403, 404, 409 closed, 422                   |
| PUT      | `/v1/clubs/:id/polls/:pollId/argument` | session | write/edit my one argument (vote first)                                                                    | 200 `PollArgument`                  | 403 removed, 404, 422 no vote, 429          |
| DELETE   | `/v1/clubs/:id/polls/:pollId/argument` | session | delete my argument                                                                                         | 200 `{ deleted: true }`             | 404                                         |
| PUT      | `/v1/reactions`                        | session | toggle insight/idea/counterpoint on a topic or argument                                                    | 200 `ReactionResponse`              | 403 not member, 404, 422 own                |
| GET      | `/v1/clubs/:id/posts?reviews=1`        | session | only book reviews (rating 1–5, up to 3 tags), locked like topics (ADR-021)                                 | 200 `ClubPostsResponse`             | 403                                         |
| GET      | `/v1/clubs/:id/cycles`                 | session | club reading cycles, newest first (≤ 50), progress from sessions                                           | 200 `ClubCyclesResponse`            | 403 not member                              |
| POST     | `/v1/clubs/:id/cycles`                 | session | owner: open a cycle (goal pages, 7/14/30/60/90 days), snapshot members; idempotent `id`                    | 200 `ClubCyclesResponse`            | 403, 409 open cycle/id, 422, 429            |
| POST     | `/v1/clubs/:id/cycles/:cycleId/close`  | session | owner: close a cycle (idempotent)                                                                          | 200 `ClubCyclesResponse`            | 403, 404                                    |
| GET      | `/v1/community/friends`                | session | my friends, requests and privacy preferences                                                               | 200 `FriendsResponse`               | 401                                         |
| PUT      | `/v1/community/friends/:userId`        | session | `request` (shared club only), `accept` (recipient) or `remove`                                             | 200 `FriendsResponse`               | 404 unavailable, 409 limit, 422 self, 429   |
| GET      | `/v1/community/friends-feed`           | session | opted-in friends: book in progress + sessions after consent (catalog books, no reflections)                | 200 `FriendsFeed`                   | 401                                         |
| PUT      | `/v1/me/social-preferences`            | session | allow requests / share activity (off by default; forward-only)                                             | 200 `FriendsResponse`               | 422, 429                                    |
| GET      | `/v1/me/moderation?reveal=1`           | session | `MODERATOR_USER_IDS` only: open reports across clubs; texts only with `reveal=1`                           | 200 `ModerationQueue`               | 403                                         |
| POST     | `/v1/me/moderation`                    | session | `MODERATOR_USER_IDS` only: remove or keep reported content, resolves its reports                           | 200 `{ status }`                    | 403, 404 no open report                     |
| GET      | `/v1/me/preferences`                   | session | review rigor, daily review limit, focus goal, yearly goal, reminder + hour + zone, push switches (ADR-022) | 200 `ReaderPreferences`             | 401                                         |
| PUT      | `/v1/me/preferences`                   | session | replace every preference                                                                                   | 200 `ReaderPreferences`             | 422 (zone, ranges), 429                     |
| POST     | `/v1/me/push-token`                    | session | register this device's Expo token (moves between accounts)                                                 | 200 `{ registered: true }`          | 422 not an Expo token, 429                  |
| DELETE   | `/v1/me/push-token/:token`             | session | forget one of my tokens (sign-out); idempotent                                                             | 200 `{ registered: false }`         | 401                                         |
| GET      | `/v1/notifications`                    | session | inbox (50): due reviews, replies to my topics, friend requests/acceptances, new cycles; no content         | 200 `NotificationsResponse`         | 401                                         |
| POST     | `/v1/notifications/read`               | session | mark `{ ids }` or `{ all: true }` as read                                                                  | 200 `NotificationsResponse`         | 422                                         |
| POST     | `/v1/auth/delete-user`                 | session | Better Auth: delete the account (`{ password }`); all data cascades                                        | 200                                 | 400/401 wrong password                      |

**Better Auth endpoints** (under `/v1/auth`):

- `POST /sign-up/email`
- `POST /sign-in/email`
- `POST /sign-out`
- `GET /get-session`
- `POST /request-password-reset`
- `GET /reset-password/:token` (e-mailed link, which redirects to the app)
- `POST /reset-password`
- `POST /send-verification-email` (`{ email, callbackURL? }`; same redirect guard; 3/min/IP)
- `GET /verify-email` (signed one-hour token + trusted callback)

Signup sends one combined welcome/verification email when the provider is configured.
Verification remains optional; existing auto sign-in is preserved. Password reset sends a
security notice; provider failure never interrupts old-session revocation. Unconfigured
production reset/verification requests answer uniform 503. See [emails.md](emails.md), ADR-025.

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

## Scheduled job (cron)

The production Worker runs hourly (`0 * * * *`, `wrangler.toml`). `runScheduled` sends the daily
review reminder to readers who turned it on, at their local hour, once per local day and only when
cards are due (ADR-022). Pushes go through the Expo push service with Android channels
`lembretes` and `comunidade`; text carries names only, never content.

## Session recall (ADR-027)

New session UUIDs require `recall: { idea, detail, connection }`, each bounded by
`SESSION_RECALL_FIELD_MAX_LENGTH`. `POST /v1/sessions/assessment` is a preview; final recording
recalculates the versioned checklist inside the transaction before changing progress, XP or cards.
Existing accepted UUIDs retain their original result, including legacy sessions.

`assessment.score` is writing-checklist completion, not factual accuracy or retention.
`factualVerification` is always `unavailable`: the API does not hold the read book text.
Optional `coach: true` sends only the exercise to Gemini for a follow-up question. Provider failures
do not change acceptance. See [core-validation.md](core-validation.md) for evidence and limits.

## Widget data (Task 09 extension, ADR-023)

`GET /v1/me/stats?today=YYYY-MM-DD` additionally returns `weekReadingDates`: sorted unique dates
with owner-scoped **reading_sessions**, Monday–Sunday. Review-only dates do not enter this field.
`weekActiveDates` keeps the existing cognitive-activity contract. Native widgets combine this
with `/v1/shelf` and `/v1/recall/due` through the authenticated mobile client; no widget API route,
token exposure or migration is introduced. Shared local payload: `widgetSnapshotSchema` (v2).

`monthActiveDates` (ADR-026): sorted dates from the first day of `today`'s month up to `today`
with a session or a review, for the widget calendar. Defaults to `[]` when absent.
