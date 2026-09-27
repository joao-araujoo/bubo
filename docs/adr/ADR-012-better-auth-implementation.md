# ADR-012 — Better Auth implementation (Task 02)

- Status: Accepted (implements ADR-005)
- Date: 2026-09-26

## Context

Task 02 delivers sign-up, sign-in, sign-out, password reset and onboarding. The API runs on
Workers with a request-scoped database. The client is a native Expo app, so it has no browser
cookies and sends no `Origin` header of its own.

## Decision

**Setup**

- `better-auth@1.7.6` and `@better-auth/expo@1.7.6`, mounted at `/v1/auth/*`.
- `createAuth()` in `apps/api/src/auth/auth.ts` is built once per request, because the DB handle
  is request-scoped.
- Drizzle adapter with `usePlural: true` over the `0001` tables.

**Sign-up and sessions**

- E-mail + password only: 8–128 characters, auto sign-in after sign-up, no e-mail verification yet.
- Sessions last 30 days and refresh daily.
- Password reset revokes every session.

**Security**

- `telemetry: { enabled: false }`: nothing leaves our infrastructure.
- `advanced.disableOriginCheck: false` always. Better Auth otherwise skips its CSRF/origin check
  when `NODE_ENV=test`, which would make tests weaker than production.
- Trusted origins are `bubo://` everywhere, plus `exp://` in development only (Expo Go). The Expo
  plugin turns the client's `expo-origin` header into `Origin`.
- `authRedirectGuard` in `apps/api/src/auth/redirect-guard.ts` rejects any `callbackURL` or
  `redirectTo` that isn't one of:
  - `bubo://`
  - `exp://` (development only)
  - a same-origin path

  Better Auth accepts untrusted redirect targets on requests without an `Origin` header, which is
  exactly what native requests look like. That would let a password-reset token be sent to a
  third-party site.

- Rate limits are stored in Postgres (`0003_auth_rate_limits`), because Worker isolates are
  short-lived. There's a global rule of 100 requests/min. Tighter limits:
  - `/sign-in/email`: 5 per minute per IP
  - `/sign-up/email`: 5 per minute per IP
  - `/request-password-reset`: 3 per minute per IP

  The client IP comes from `cf-connecting-ip` or `x-forwarded-for`.

**Password reset e-mails**

- They go through an `EmailSender` interface.
- Development: the link is logged locally.
- Every other environment: it fails with `SERVICE_UNAVAILABLE` until a provider is chosen. It never
  fails silently.

**Mobile**

- `createAuthClient` with `expoClient({ storage: SecureStore })` keeps the session cookie in the
  device keychain/keystore.
- The Bubo API client sends that cookie explicitly with `credentials: 'omit'`.
- Session-protected API routes: `withDatabase → withAuth → requireSession`. Missing or invalid
  sessions get a 401 in the standard envelope.

## Consequences

- Tested end-to-end against real Postgres (PGlite): 20 auth/onboarding integration cases plus 4
  redirect-policy unit cases. They cover CSRF, redirect tampering, rate limiting, the reset-token
  flow, data isolation and log redaction.
- The Worker bundle grew to about 3 MB (538 KB gzip). That's within limits, but keep an eye on it.
- Better Auth's scrypt hashing is CPU-heavy. The Workers **Free** plan (10 ms CPU) is not enough
  for sign-in and sign-up. Use the Paid plan in production.
- An e-mail provider (and e-mail verification) is required before production.
- Better Auth endpoints return Better Auth's own error JSON, not our envelope. The app maps their
  codes to pt-BR copy.

## Alternatives considered

- **Bearer tokens with the `bearer` plugin:** unnecessary, since the Expo plugin already manages
  the cookie securely.
- **In-memory rate limiting:** it resets with every isolate, so it's ineffective.
- **Relying on Better Auth's trusted-origin check for redirects:** it doesn't cover native requests.
  Replaced by our explicit guard.
