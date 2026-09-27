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
  - Reset links are sent by Resend in production. In development they're logged locally. Anywhere
    else, with no provider configured, the request fails. It never drops the e-mail silently.
- **Account deletion:** Você → "Excluir conta" (`/v1/auth/delete-user`).
  - The password is re-checked.
  - Every row owned by the reader cascades from `users`: sessions, shelf, reading sessions, cards,
    reviews and profile.
  - The reader's manually added books are deleted too.
- **Production config:** `/v1/ready` stays 503 unless all of these are set:
  - `DATABASE_URL`
  - `BETTER_AUTH_SECRET`
  - an `https://` `BETTER_AUTH_URL`
  - `RESEND_API_KEY`
  - `EMAIL_FROM`

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

## Supply chain

- Direct dependencies are pinned. Expo packages use the SDK's `~` ranges, as `expo install`
  expects.
- npm 11 `allowScripts` permits install scripts only for `esbuild` and `workerd`.
- There is no OpenAI dependency, and there are no other package managers.

## Before production (known gaps)

- E-mail verification at sign-up. The Resend sender already exists, so it only needs wiring.
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
