# Production release checklist

Nothing in this repository deploys by itself. Every step below is a deliberate action by the
owner of the Cloudflare, Neon, Resend, Expo and store accounts. Follow the steps in order.

## Current remote state (keep this updated after every remote change)

Last updated 2026-09-28 (Task 08 slice 1 deploy). Owner-facing checklist in Portuguese:
[../CONFIGURAR.md](../CONFIGURAR.md).

- **API URL:** `https://bubo-api.bubo-api.workers.dev` (Worker `bubo-api`, version
  `a71892ff-995b-4e5a-a804-0af8a8d1c694`). The account's `workers.dev` subdomain `bubo-api` was
  registered automatically by the first deploy; renaming it changes every Worker URL on the account.
- **Worker secrets:** `DATABASE_URL` (Neon pooled URL from `apps/api/.dev.vars`),
  `BETTER_AUTH_SECRET` (random, stored only in Cloudflare; rotating it signs everyone out),
  `BETTER_AUTH_URL` = the URL above. **Not set:** `RESEND_API_KEY`/`EMAIL_FROM` (password reset
  answers 503), `GOOGLE_BOOKS_API_KEY` (Google 429; Open Library/BrasilAPI answer),
  `MEDIA_PUBLIC_URL`, `GEMINI_API_KEY`, `CATALOG_CONTACT_EMAIL`.
- **Neon:** migrations `0001`–`0009` applied, 0 pending (`0009_club_polls_invites` on 2026-09-28). Production and the owner's local
  `dev:api` share this database — split into a `production` branch before real users.
- **Legacy tables in Neon:** about 40 empty tables that no Bubo migration created (`clubs`,
  `club_members`, `club_polls`, `content_reports`, `posts`, `blocks`, `works`, `editions`, …). They
  are untouched. New Bubo tables must not reuse those names (hence `reading_club_*` in 0008 and 0009).
- **R2:** bucket `bubo` bound as `MEDIA`; public delivery not configured.
- **Plan:** Workers Paid not confirmed (password hashing can exceed Free CPU limits under load).
- **Expo Go vs production:** production trusts only `bubo://`; Expo Go (`exp://`) works only with a
  development API. Testing against production needs an EAS build.
- **Smoke tests (2026-09-27):** core flow (health, ready, sign-up, memory, catalog, ISBN, add,
  session → card, shelf detail, OpenAPI, achievements, reset → 503, account deletion) and the
  Comunidade flow with two accounts both passed; every test account was deleted.
- **Smoke test (2026-09-28, Task 08):** private club + invite, polls, arguments, reactions,
  members, feed, report/restore, code rotation — 27/27 passed with two accounts, both deleted.
- **Migration check:** use `npm run db:migrate:check` (read-only). Until 2026-09-28 the root
  `db:migrate -- --check` applied migrations because npm swallowed `--check`; fixed.

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
   Expected output lists only applied pending files (currently through `0007_shelf_entry_pages.sql`),
   or `migrations up to date`.
3. Keep a Neon branch per environment. Never point development at production.

## 2. E-mail (Resend)

1. Verify your sending domain in Resend: add the SPF/DKIM DNS records.
2. Create an API key with **sending access only**.
3. Pick the sender, e.g. `Bubo <nao-responda@seu-dominio.com>`.

## 3. API (Cloudflare Workers)

1. **Workers Paid plan.** Password hashing needs more than the Free plan's 10 ms CPU.
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
`https://` auth links, e-mail, a database and a secret.

## 4. Mobile (EAS)

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
