# Security

## Secrets

- Server secrets (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `GEMINI_API_KEY`) live only in Worker
  secrets. Locally they go in `apps/api/.dev.vars`, which is gitignored.
- The mobile app only receives `EXPO_PUBLIC_*` values, which are public by definition.
  `npm run doctor` fails if `apps/mobile/.env` contains server secrets. `audit:repo` fails on
  Gemini references in mobile code.
- Validation errors and `/v1/ready` report variable _names_, never values.
- Logs redact keys matching secret, token, password, authorization, cookie, api key and database
  URL.
- The ZIP packager excludes `.env*` (except `.env.example`) and `.dev.vars*` (except the example).

## API surface

- **Public, unauthenticated:** `/v1/health`, `/v1/ready`, `/v1/openapi.json`. They're
  intentional: they expose no user data. `/v1/ready` reveals only whether the database is
  configured and reachable.
- **Authentication** (Better Auth, ADR-012):
  - Passwords are 8–128 characters and hashed with scrypt.
  - Sessions last 30 days in a `SameSite=Lax` cookie. It's `Secure` in production.
  - On the device, the cookie lives in SecureStore (keychain/keystore).
- **CSRF and origin:** cookie-authenticated auth calls must come from a trusted origin: `bubo://`,
  or `exp://` in development only. The check is enforced even in tests.
- **Open-redirect protection:** `authRedirectGuard` blocks any `callbackURL` or `redirectTo`
  outside the app scheme. This protects password-reset tokens.
- **Rate limits** are stored in Postgres, per IP: sign-in and sign-up 5/min, reset request 3/min,
  global 100/min.
- **Password reset:**
  - The request answers the same way whether or not an account exists.
  - Tokens last 1 hour and are single-use.
  - A reset revokes all sessions.
  - Reset links are sent by Resend in production. Development without a provider logs only that
    the email was not sent, never the recipient or authentication link. Anywhere
    else, with no provider configured, the request is refused up front with 503 (the same answer
    for every address). Better Auth sends in a background task and would otherwise answer 200, so
    the refusal happens before it (`apps/api/src/app.ts`, test `email-disabled.test.ts`).
- **Account deletion:** Você → "Excluir conta" (`/v1/auth/delete-user`).
  - The password is re-checked.
  - Every row owned by the reader cascades from `users`: sessions, shelf, reading sessions, cards,
    reviews and profile.
  - The reader's manually added books are deleted too.
- **Email verification (ADR-025):** optional on signup, signed one-hour link; guarded callbacks.
  Manual resends limited to 3/min/IP. Unconfigured production returns 503 uniformly. Security
  notification failures cannot prevent password-reset session revocation. Email logs omit auth
  links and recipients; Resend idempotency headers contain event hashes, never tokens.
- **Production config:** `/v1/ready` stays 503 unless all of these are set:
  - `DATABASE_URL`
  - `BETTER_AUTH_SECRET`
  - an `https://` `BETTER_AUTH_URL`

  `RESEND_API_KEY` + `EMAIL_FROM` are optional but must be set together (owner decision,
  2026-09-27: launch without e-mail, password reset disabled until Resend is configured).

  Release app builds fail without an `https://` API URL.

- **Authorization:** every data route requires a session, and every query is scoped to
  `session.user.id`. Tests cover isolation between two readers.
- **Personal data in logs:** request logs carry no bodies. Validation issues carry paths only, never
  submitted values. Tests check that passwords and session tokens never appear in logs.
- **Hardening in place:**
  - `hono/secure-headers`
  - CORS only in development
  - no stack traces in responses
  - request ids for correlation
  - R2 keys validated against traversal
  - image type and size limits
  - Gemini key sent in a header, never in the URL

## User-generated content (Comunidade, ADR-019)

- Anti-spoiler is enforced server-side: locked topics and replies are sent without text; only an
  explicit `?reveal=1` returns it.
- Every club route requires a session and membership checks run in the service. Topics are always
  scoped to their club id (a topic id from another club answers 404).
- Report, block, author delete and owner remove/restore exist and are tested. Three distinct
  reports hide an item until the club owner reviews it.
- Logs carry ids and the report reason only, never the reported text or the reader's details.
- 30 writes per minute per reader (per isolate) and 5 owned clubs per reader.
- **Gap before a store release:** no Bubo-wide moderation tool or support contact. See
  [../CONFIGURAR.md](../CONFIGURAR.md).

## Supply chain

- Direct dependencies are pinned. Expo packages use the SDK's `~` ranges, as `expo install`
  expects.
- npm 11 `allowScripts` permits install scripts only for `esbuild` and `workerd`.
- There is no OpenAI dependency, and there are no other package managers.

## Before production (known gaps)

- Verify the Resend domain and configure the sender before enabling public email delivery.
  Optional signup verification is implemented (ADR-025); requiring it remains an owner decision.
- Terms of Use and Privacy Policy. The sign-up consent checkbox from Stitch was left out because
  the documents don't exist yet.
- The Workers Paid plan: scrypt hashing exceeds the Free plan's 10 ms CPU limit.
- Data export (LGPD portability). Account deletion is done.

The full release sequence is in [release.md](release.md).

## Not verified

- No penetration test.
- No deploy, so production headers and TLS aren't observed.
- No accessibility audit with assistive technologies. Components carry roles, labels and states,
  but WCAG conformance needs manual testing with VoiceOver and TalkBack.
