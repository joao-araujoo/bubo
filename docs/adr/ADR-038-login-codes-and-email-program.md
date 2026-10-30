# ADR-038: e-mailed login codes, code-based password reset and the Bubo e-mail program

Date: 2026-10-12. Status: accepted.

## Context

The owner asked for a safer sign-in (a code at login with a "remember this device" option),
password reset without depending on deep links, and Duolingo-style e-mails: brand, mascot, one
headline, a short body and one action, with the mascot carrying the emotion. The study of the
references kept three lessons: everything above the fold on a phone, about forty words, and a
subject line that says exactly what happened. Bubo's tone is warm and never guilt-tripping, so
the "you made Duo sad" register was deliberately not copied.

The e-mail provider (Resend) was already working for the owner. Better Auth 1.7.6 ships the
`two-factor` (OTP method) and `email-otp` plugins, so no custom code handling, hashing or attempt
counting had to be written.

## Decision

- **Login code.** The `two-factor` plugin is registered with the OTP method only (TOTP disabled,
  no backup codes). Every account has `users.two_factor_enabled = true` (migration `0017`, set
  again in the user-create hook). Sign-in with a correct password answers
  `{ twoFactorRedirect: true }` without a session; the app calls `/two-factor/send-otp` and
  `/two-factor/verify-otp`. Codes are six digits, hashed at rest, valid for ten minutes, five
  attempts per code, three sends per minute per IP, ten verifications per minute per IP. The
  reader can turn the code off and on in Configurações → Conta e segurança (password required).
- **Remember this device.** `verify-otp` with `trustDevice: true` sets Better Auth's signed
  `trust_device` cookie (30 days, bound to the account, rotated on every sign-in). The Expo client
  wipes its cookie jar on sign-out, so the app keeps the trust cookie aside before `signOut` and
  puts it back (`lib/auth/trusted-device.ts`). If the jar format ever changes the helper finds
  nothing and the reader is simply asked for a code again.
- **No provider, no code.** The plugin is registered only when e-mail can be delivered. Without
  Resend (local development, or production without the secrets) sign-in needs only the password
  and `GET /v1/me` reports `loginCodeAvailable: false`, so the app shows the switch as locked.
  Code requests answer 503 up front, like the existing reset and verification requests.
- **Password reset by code.** The `email-otp` plugin handles `/email-otp/request-password-reset`
  and `/email-otp/reset-password` (same hashing, expiry and attempt limits, sessions revoked,
  security notice sent). Only `forget-password` codes are ever e-mailed: Bubo has no passwordless
  sign-in, so `sign-in` codes stay stored, hashed and unreachable, and the e-mail verification
  link is unchanged. The link-based reset stays for older app versions.
- **Account notices.** The "senha alterada" e-mail is also sent after the in-app password change
  (`/change-password`, which revokes the other sessions), and a farewell e-mail confirms account
  deletion. Delivery failures never block the change or the deletion.
- **E-mail program and consent.** Account and security e-mails have no switch. Optional e-mails
  need `reader_preferences.email_reading_reminders` (default on, visible in Configurações →
  E-mails do Bubo, older apps keep working because the contract defaults the field), carry a
  signed one-click opt-out link (`GET|POST /v1/email/unsubscribe?token=`, RFC 8058 headers) and
  are logged in `reader_email_events` (ids and kinds only).
- **"Sentimos sua falta".** The hourly cron e-mails readers with consent, a book in progress, at
  least one accepted session, seven or more days without reading and no such e-mail in the last
  thirty days, at ten in the morning of their own time zone. The rules live in
  `@bubo/domain/email-program.ts` and are checked in SQL and again before sending. The claim is
  written before the send; a provider failure releases it; the provider idempotency key is
  reader + local day. The e-mail shows the real book, page and days away and links to the book.
- **Design.** One frame for every e-mail: logo, 200 px official pose (inline CID, no public
  image host), tracked eyebrow, 30 px headline, short body with at most one bold fact, a code
  block or one tactile button, a muted note and a footer that says why the reader got the e-mail.
  Codes appear in the subject and the body, grouped `482 913`, never in a button. Two more
  official poses (`curious`, `neutral`) were embedded by `email:assets`; nothing was redrawn.

## Consequences

- Migration `0017` is additive (columns with defaults plus two tables); it has not been applied
  to Neon and the API has not been deployed in this slice. Older builds keep signing in without a
  code until the new API is live; the new app on the old API shows the code switch as unavailable.
- Local development without Resend never asks for a code, so screens must be accepted on a build
  pointed at an API with the provider.
- Sign-in on a new device now depends on the e-mail arriving; the reset code also replaces the
  link in the app. Both flows show "reenviar" with a 60-second cooldown.
- Enabling or disabling the code and changing the password rotate the session; push tokens are
  session-bound (ADR-028), so the app re-registers right away.
- Weekly digest, streak-at-risk and "new device signed in" e-mails remain proposals in
  [emails.md](../emails.md) with eligibility rules; none is sent.
- Device acceptance (Android and iPhone, real inbox) is pending.
