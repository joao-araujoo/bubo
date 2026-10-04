# Production release checklist

Nothing in this repository deploys by itself. Every step below is a deliberate action by the
owner of the Cloudflare, Neon, Resend, Expo and store accounts. Follow the steps in order.

## Current remote state (keep this updated after every remote change)

Last updated 2026-10-03 (ADR-031 Discover recommendations and catalog burst fix deployed; no migration). Owner-facing checklist in Portuguese:
[../CONFIGURAR.md](../CONFIGURAR.md).

- **API URL:** `https://bubo-api.bubo-api.workers.dev` (Worker `bubo-api`, version
  `f312daaa-2afd-430f-a447-7f08422792fa`, 2026-10-03 ADR-031: `GET /v1/catalog/discover`,
  catalog queue 5 s / 6 s deadline, short queries answered empty, keyless Google `skipped`;
  verify 461 tests; migrations through `0015`) with an hourly cron trigger (`0 * * * *`,
  review reminders). The account's `workers.dev` subdomain `bubo-api` was
  registered automatically by the first deploy; renaming it changes every Worker URL on the account.
- **Worker secrets:** `DATABASE_URL` (Neon pooled URL from `apps/api/.dev.vars`),
  `BETTER_AUTH_SECRET` (random, stored only in Cloudflare; rotating it signs everyone out),
  `BETTER_AUTH_URL` = the URL above. **Not set:** `RESEND_API_KEY`/`EMAIL_FROM` (password reset
  answers 503), `GOOGLE_BOOKS_API_KEY` (Google 429; Open Library/BrasilAPI answer),
  `MEDIA_PUBLIC_URL`, `GEMINI_API_KEY`, `CATALOG_CONTACT_EMAIL`, `MODERATOR_USER_IDS` (the
  moderation queue answers 403 to everyone until the owner adds their user id).
- **Neon:** migrations `0001`–`0015` applied, 0 pending (`0014` and `0015` on 2026-10-03, after verify: 407 tests). Production and the owner's local
  `dev:api` share this database — split into a `production` branch before real users.
- **Legacy tables in Neon:** about 40 empty tables that no Bubo migration created (`clubs`,
  `club_members`, `club_polls`, `content_reports`, `posts`, `blocks`, `works`, `editions`, …). They
  are untouched. New Bubo tables must not reuse those names (hence `reading_club_*` in 0008–0012 and `reader_*` in 0013).
- **R2:** bucket `bubo` bound as `MEDIA`; public delivery not configured.
- **Plan:** Workers Paid not confirmed (password hashing can exceed Free CPU limits under load).
- **Expo Go vs production:** production trusts only `bubo://`; Expo Go (`exp://`) works only with a
  development API. Testing against production needs a native build; the free local Android
  route is `npm run build:android` (see [build-mobile.md](build-mobile.md)).
- **Discover + catalog fix (2026-10-03; ADR-031):** three publishes the same evening
  (`3185f320…`, `cbcfb82f…`, `268a1b7b…`, final `f312daaa…`), each after `verify` and a read-only
  migration check (0 pending). The production smokes found two more causes that local tests had
  not: Open Library rejects queries under 3 characters (422 → 503) and author names with initials
  did not match. Final production smoke 18/18: health/ready, anonymous 401, 2-letter search 200
  empty, 5 concurrent searches 200, three shelf additions, Discover 200 (`openlibrary: ok`, all
  Portuguese, shelf books excluded, reasons such as "Mesma autoria de Duna"), cached repeat, genre
  200, invalid genre 422, account deletion, revoked session 401, sign-in 401. One earlier QA
  account (`qa-discover-…@example.com`) lost its random password when a smoke script aborted; it
  was found by a read-only query (exactly one row) and deleted by exact id with cascade (0 users,
  shelf rows and sessions left). Later smokes clean up in `finally`. No secrets were changed;
  `CATALOG_CONTACT_EMAIL` and `GOOGLE_BOOKS_API_KEY` remain unset. Existing APKs benefit from the
  API fixes; the new Discover screen, 3-letter search and cover loading need a new APK.
- **Smoke tests (2026-09-27):** core flow (health, ready, sign-up, memory, catalog, ISBN, add,
  session → card, shelf detail, OpenAPI, achievements, reset → 503, account deletion) and the
  Comunidade flow with two accounts both passed; every test account was deleted.
- **Smoke test (2026-09-28, Task 08):** private club + invite, polls, arguments, reactions,
  members, feed, report/restore, code rotation — 27/27 passed with two accounts, both deleted.
- **Smoke test (2026-09-30, Task 08 slice 2):** catalog book, private club, review with tags
  (lock, reveal, idempotent retry, invalid tags 422), friend request/accept, feed empty before
  opt-in, sharing on, session shared without its reflection, `readingNow`, cycle start (member 403),
  participation and close, moderation 403 and `isModerator` false, 401 without session — 28/28,
  both accounts deleted. Catalog search is intermittent (Google 429 without a key, slow Open
  Library), and this machine clock was ~15 s behind the Worker.
- **Smoke test (2026-10-01, Task 09):** health, ready, preference defaults/save/422, push token
  register/reject/remove, due cards with `dailyLimit`, `focusedMinutesToday`, club + friend
  request in the inbox, acceptance, answered request leaves the inbox, reply notification without
  text, mark all read, 401 without session — 22/22, both accounts deleted.
- **Push:** the Worker calls the Expo push service; no EAS project id or Firebase credentials are
  configured yet, so no device receives pushes (the inbox works).
- **Observed recall and review concurrency (2026-10-03; ADR-030):** `npm run verify` passed
  with 441 tests; read-only migration check returned zero pending and no database changes.
  Published `3707c06b-9559-4b8a-b4d9-8f9e3dc54bd0`, retaining R2, the hourly cron and the
  three existing secrets. `GET /v1/me/memory` now groups self-assessments by actual elapsed
  time; review writes lock the owner's card and recheck the client UUID after waiting.
  Production smoke passed 23 checks: health/ready/OpenAPI, anonymous 401, signup/onboarding,
  four memory periods and invalid period, concurrent same UUID (201/200), another UUID (409),
  one review and one XP award, no observation below 24 hours, card/book cascade deletion.
  No migration or provider credentials were added; no emails or pushes were sent and no
  device tokens were registered.
  Both isolated temporary accounts were deleted: the first smoke needed a production secure-cookie
  adjustment and narrowly scoped cleanup; the successful QA account was deleted through the API.
  Three cleanup checks confirmed deletion, session revocation and rejected sign-in, followed by a
  read-only database check confirming no continuation accounts remain. Local credentials removed.
- **Recall + push lifecycle (2026-10-03; ADR-027/028):** verify passed (407 tests), migrations
  `0014` and `0015` applied and a subsequent read-only check found zero pending. Deployed the
  initial version `fcdd1815-0c24-4091-bfb3-cbf40c703714`, preserving the hourly cron, R2 binding and three existing secrets.
  New sessions require the server writing checklist; distribute the new APK with this API.
  Already accepted UUIDs remain idempotently confirmable. Optional Gemini coaching is
  unavailable because the Worker has no `GEMINI_API_KEY`; book factual verification and
  calibrated retention remain unavailable by design.
- **Recall production smoke (2026-10-03):** 27/27 checks passed: health/ready/OpenAPI, isolated
  signup, reminder opt-out, empty preview/missing recall rejection without XP/progress/cards,
  concise checklist acceptance, optional coach contract, preview without activity writes,
  final write, retry with one session/card, tomorrow's personal review and anonymous 401.
  The temporary account was deleted, its session returned 401 and subsequent sign-in returned 401. No device tokens, messages or provider credentials were created.
- **Recall short-answer follow-up (2026-10-03):** fixed false rejection of Portuguese one-letter
  words (`a/e/o`) in specific three-word answers, while rejecting article-only padding. An
  empty exercise now scores zero and waits for three answers before checking repetition.
  Verify passed with 409 tests and the follow-up API was published. Production smoke
  expanded to 30/30, including those three regressions; its second temporary account was
  deleted and both session/sign-in revocation were confirmed. No new migration or mobile
  contract was needed; evaluation runs only in the API.
- **Android artifact (2026-10-03):** signed test APK at `build/android/bubo-test.apk`, ARM64/ARMv7,
  embedded JS, four widget receivers and merged `POST_NOTIFICATIONS` verified. First
  `packageRelease` failed; rerunning Gradle with preserved caches succeeded. No cause was
  reproduced and no device was connected. iOS compilation and Android/iPhone acceptance
  remain pending. See [build-mobile.md](build-mobile.md).
- **Current Android artifact (2026-10-03; ADR-030):** regenerated after the final concise-copy
  changes, including welcome/sign-in. `npm run build:android` passed its full verify (441 tests)
  and Gradle release build. Test signature, embedded JS, `POST_NOTIFICATIONS` and all five widget
  receivers (including `LeagueWidget`) verified. ARM64/ARMv7; built at 20:20 America/Sao_Paulo;
  SHA-256 `bd9acdda36c44c178a0c594a709dcb3686f42773e8c993e3aaff9031a9c7d0ac`.
  No physical device install or iOS compilation in this continuation. Current JS was checked
  separately on the existing Android emulator debug installation via Metro, not by installing
  this ARM release artifact on its x86_64 image.
  Emulator QA covered real sign-in, Home's removed footer, Você, Preferências, five widget previews
  and empty memory views at 7/30/90/365 days; no React Native error or fatal exception observed.
  No reading activity or preferences were saved. The emulator and temporary Metro were stopped.
  Populated delayed-recall cases are covered by API/domain tests; launcher widgets, large fonts,
  TalkBack and physical-device acceptance were not repeated in this slice.
- **Widgets API (2026-10-01):** `/v1/me/stats` adds reading-only `weekReadingDates`. No new
  migration; check found zero pending and migration command made no changes. `npm run deploy:api`
  passed verify (316 tests) and published `1f7b4dcc-3eb1-465b-96e9-e42f5902cbd7`, retaining the existing hourly cron.
  No mobile distribution or store submission was performed in that API slice.
  Follow-up local ADR-024: Android APK compiled for ARM64/ARMv7 with verified signature,
  three widget receivers and embedded JS; no remote change. Swift/device acceptance is pending.
  See [widgets.md](widgets.md) and [build-mobile.md](build-mobile.md).
- **Widgets API smoke (2026-10-01):** production health/ready 200, stats without a session 401,
  OpenAPI 200 containing `weekReadingDates`. Authenticated reading-data checks were run locally
  against PGlite; no production test account or shelf was created in this slice.
- **Migration check:** use `npm run db:migrate:check` (read-only). Until 2026-09-28 the root
  `db:migrate -- --check` applied migrations because npm swallowed `--check`; fixed.
- **Resend follow-up (2026-10-01; ADR-025):** root .env key authenticated; a real owner test
  reached Gmail INBOX with official inline artwork (`delivered` in Resend). Created sending
  subdomain `bubo.nyoneo.com.br` (id `9cfb0fca-15f7-43db-975e-79fb05dbff0a`), tracking off,
  receiving disabled. Owner deferred DNS; status not_started, Worker email secrets still absent.
  Public email delivery remains unavailable until verification/configuration. See [emails-dns.md](emails-dns.md).
- **Emails API deploy (2026-10-01):** verify passed (340 tests); migration check found zero pending,
  no database changes. Published `ad7ebef7-169a-4b9f-a48d-9607fd2cb83e`, preserving the hourly cron and existing
  secrets. Production health/ready 200, unauthenticated stats 401, verification email action 503
  while unconfigured. No paid plan or email campaign was enabled; no DNS records were changed.

## 0. Before anything

- [ ] **Rotate any credential that was ever pasted into a file or chat:** the Neon password and
      the Gemini key.
- [ ] `npm install && npm run verify` is green.
- [ ] `npm run check:bundle --workspace @bubo/api` prints the production bindings. This is a dry
      run and uploads nothing.

## 1. Database (Neon)

1. Create a **production branch or database** in Neon. Copy the **pooled** connection string.
2. Confirm the target, then inspect pending migrations without writes:
   `npm run db:migrate --workspace @bubo/database -- --check`.
   The migrator reads process `DATABASE_URL`, falling back only to the gitignored
   `apps/api/.dev.vars`; it derives a direct Neon connection in memory. No secret is printed.
   Apply only after reviewing compatibility. Migrations are idempotent and transactional:
   ```sh
   # PowerShell: $env:DATABASE_URL="postgres://…"; npm run db:migrate
   DATABASE_URL="postgres://…" npm run db:migrate
   ```
   Expected output lists only applied pending files (currently through `0015_reader_push_receipts.sql`),
   or `migrations up to date`.
3. Keep a Neon branch per environment. Never point development at production.

## 2. E-mail (Resend)

1. Verify your sending domain in Resend: add the SPF/DKIM DNS records.
2. Create an API key with **sending access only**.
3. Pick the sender, e.g. `Bubo <nao-responda@seu-dominio.com>`.

## 3. API (Cloudflare Workers)

1. Keep the current plan for the owner's free test. Password hashing may exceed Workers Free
   CPU limits under load; validate authenticated device flows before a public release. Any paid
   upgrade requires a separate owner decision and is outside this setup.
2. Create the R2 bucket `bubo`: `npx wrangler r2 bucket create bubo`.
3. Set the secrets. Each command prompts for the value, so nothing lands in shell history:
   ```sh
   cd apps/api
   npx wrangler secret put DATABASE_URL --env production
   npx wrangler secret put BETTER_AUTH_SECRET --env production   # ≥ 32 random chars
   npx wrangler secret put BETTER_AUTH_URL --env production      # https://api.your-domain
   npx wrangler secret put RESEND_API_KEY --env production       # optional pair, see below
   npx wrangler secret put EMAIL_FROM --env production
   npx wrangler secret put GEMINI_API_KEY --env production       # optional
   ```
   **Without Resend** (allowed since 2026-09-27, owner decision): the API runs normally and
   `POST /v1/auth/request-password-reset` answers `503 SERVICE_UNAVAILABLE` for every address;
   the app shows "O serviço está indisponível no momento". Set both secrets to enable reset.
   Setting only one of the pair fails config validation.
4. Deploy with `npm run deploy:api`. It runs `verify` first, then
   `wrangler deploy --env production`.
5. Attach a custom domain (`api.your-domain`) to the `bubo-api` Worker. `BETTER_AUTH_URL` must
   match it.
6. Smoke test:
   - `GET https://api.your-domain/v1/health` → 200, `environment: production`
   - `GET https://api.your-domain/v1/ready` → 200. A 503 lists the missing variable names.

**Safety net:** the top-level `wrangler.toml` Worker is `bubo-api-dev`, so a deploy without
`--env production` can't overwrite production. Production refuses to boot "ready" without
`https://` auth links, a database and a secret. Email remains an optional configuration pair.

## 4. Mobile (EAS)

For a free Android device test with widgets, start with [build-mobile.md](build-mobile.md).
It creates a standalone test APK locally without an EAS account or remote configuration.
The following steps are the optional cloud/store distribution route, not prerequisites for
local Android testing.

1. Install the CLI and log in: `npm i -g eas-cli`, then `eas login`. Link the project with
   `cd apps/mobile && eas init`, which writes the project id.
2. Set the API URL per environment. It's public by design:
   ```sh
   eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://api.your-domain --visibility plaintext
   eas env:create --environment preview    --name EXPO_PUBLIC_API_URL --value https://api.your-domain --visibility plaintext
   ```
   `app.config.ts` **fails the build** when a preview or production build has no `https://` URL.
3. Internal test build: `eas build --profile preview --platform android` (APK) or `ios`.
4. Store build: `eas build --profile production --platform all`, then
   `eas submit --profile production`.

## 5. Store requirements (already covered / still to do)

- ✅ In-app account deletion: Você → "Excluir conta". The password is re-checked and all data is
  erased.
- ✅ No tracking and no third-party analytics. Better Auth telemetry is disabled.
- ✅ Export compliance: `ITSAppUsesNonExemptEncryption: false`, since only standard TLS is used.
- ⬜ Privacy Policy and Terms URLs, required by both stores. Add them to the store listings and to
  sign-up.
- ⬜ If Google sign-in is added, **Sign in with Apple** becomes mandatory on iOS.
- ⬜ Community features (Task 07+) need reporting, blocking and moderation before release (UGC
  rules).

## 6. After release

- Watch Workers Logs, which are structured JSON with `requestId`.
- A new migration means: add `NNNN_*.sql`, run `npm run db:migrate` against production **before**
  deploying code that needs it, then deploy.
- Rollback the API with `npx wrangler rollback --env production`. Migrations only ever add, so an
  older Worker keeps working.
