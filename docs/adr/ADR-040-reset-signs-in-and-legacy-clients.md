# ADR-040: a password reset signs the reader in; old builds are told to update

Date: 2026-10-13. Status: accepted. Amends ADR-038 (login codes and code-based reset).

## Context

The owner reset their password and then could not sign in with the new one. The server side was
correct (reset, hashing, revocation and the new password all pass end to end), but two things made
the experience fail:

1. **Old app builds hang silently.** Since 2026-10-12 the API answers a correct password on an
   untrusted device with `twoFactorRedirect` and no session (ADR-038). Builds made before that
   (the 2026-10-03 test APK, for example) do not know the challenge: `signIn.email` returns no
   error, the app waits for a session that never arrives and nothing happens on screen. A reset
   revokes every session, so the reader meets this right after changing the password.
2. **Two codes in a row.** On current builds, a reset by code was followed by a sign-in that
   e-mailed a second, different code. With slow e-mails it was easy to type the reset code on the
   login screen ("Código incorreto") and conclude that the new password did not work.

## Decision

- **A successful reset opens a session on that device.** After `/email-otp/reset-password` (code)
  or `/reset-password` (the link kept for old builds) succeeds, a Better Auth `after` hook creates
  a fresh session and sets the session cookie. The reset already proved control of the e-mail
  (the same factor as the login code) and the reader just chose the password, so a second code
  adds no security. Every other session is still revoked first (`revokeSessionsOnPasswordReset`)
  and the "Senha alterada" notice is still sent. Failed resets never set a cookie.
- **The app never asks for the new password again.** `esqueci-senha` checks the session after the
  reset; the navigation guard then moves to Hoje or onboarding. Against an API without the hook it
  signs in with the password it already has (shared `signInWithPassword`) and, on an untrusted
  device, opens the code screen with "este é um código de entrada novo, diferente do código da
  senha".
- **Capability header.** Current builds send `x-bubo-auth: login-code` on every auth request
  (`AUTH_CLIENT_HEADER` / `AUTH_CLIENT_LOGIN_CODE` in `@bubo/config`). A `/sign-in/email` answer
  that would start the code challenge for a request **without** the header becomes
  `426 { code: "APP_UPDATE_REQUIRED" }` with no cookies, so an old build shows an error instead of
  doing nothing. The header is not a security control: the code challenge is still issued to any
  client that sends it, and accounts that do not ask for a code (two-factor turned off) sign in
  from old builds as before.
- **Copy.** `APP_UPDATE_REQUIRED` maps to "Esta versão do Bubo não consegue concluir a entrada.
  Atualize o app e tente de novo." The link-reset screen now ends with "Continuar".

- **The navigator stays mounted while a signed-out session refetches.** Better Auth flags a
  signed-out session `isPending` again on every refetch (after a sign-in that starts the code,
  after sending the code, after a failed sign-up). `useAuthState` showed the boot screen for it,
  which unmounted the stack and dropped the reader on Boas-vindas before the code screen opened
  ("volta sempre para o início"). Only the first resolution may show the boot screen now
  (`lib/auth/auth-status.ts`, tested against the real client atom).

## Consequences

- One code per reset; the reader lands in the app right after saving the new password.
- Old builds: a link reset now signs them in (the cookie comes with the reset response); a later
  sign-in that needs a code shows a generic error ("Algo deu errado") because their copy predates
  `APP_UPDATE_REQUIRED`. They need a new build.
- Tests: `login-code.test.ts` (reset by code and by link open a session, mixed-case address,
  wrong code never opens one, reset code is never a login code, legacy 426 without cookies,
  two-factor off still works) and `mobile-auth-client.test.ts` (the real Expo client: trusted
  device → reset → sign-out → new password signs in directly; new device → reset → sign-out →
  new password + login code; a client without the header gets `APP_UPDATE_REQUIRED`).
- Requires an API deploy and a new app build for the in-app changes.
