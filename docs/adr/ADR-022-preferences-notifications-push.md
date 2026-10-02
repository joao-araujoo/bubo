# ADR-022 — Você: cognitive preferences, notification inbox and push

- Status: Accepted
- Date: 2026-10-01

## Context

Task 09 completes "Você" with the owner's Stitch screens "Preferências cognitivas", "Notificações
& alertas cognitivos" and "Notificações do clube & convites", plus the reader profile. Club
notifications were deferred from Task 08 (ADR-021) until push existed. The rules stay: every
number is real (AGENTS rule 6), a lock screen must never leak a spoiler or a private reflection,
and pushes need explicit consent.

## Decision

- **Account preferences (`0013`, table `reader_preferences`, one row per reader, defaults until
  saved).** Each option changes behaviour:
  - _Rigor do intervalo_ (`gentle` / `balanced` / `intensive`) multiplies the SM-2 interval after
    a successful recall by 1.25 / 1 / 0.8 (`adjustInterval`); one-day steps never change.
  - _Revisões por dia_ (5–50, default 20) limits the cards `GET /v1/recall/due` offers; cards
    graded today count (`reviewedToday`, `dailyLimit` in the response) and `dueCount` stays the
    full truth. Revisar explains when the limit is reached; the tab badge and Hoje show only what
    is offered today.
  - _Meta diária de foco_ (15/20/30/45 min) drives Hoje's "Missão de hoje" with
    `focusedMinutesToday` from `/v1/me/stats`.
  - _Meta anual de livros_ (optional) is compared, in Você, with books finished this year.
  - Review reminder (off by default), its local hour and IANA time zone (sent by the device), and
    push switches for community and friends.
- **Device preferences** (theme, haptics) live in AsyncStorage (`lib/device-preferences.tsx`) and
  load before the first frame, so the theme no longer resets on every start.
- **Inbox (`reader_notifications`).** Kinds: `review_due`, `topic_reply` (replies to my topic or
  review, grouped while unread), `friend_request` (shown only while still pending),
  `friend_accepted`, `cycle_started` (club members except the owner). Rows store ids and counts
  only — never reply text — and are filtered at read time: no items from blocked readers (either
  direction) or from clubs the reader left. Read state per item or all at once. Legacy tables
  named `notifications`, `push_devices`, `notification_preferences` and `user_settings` exist in
  the shared Neon database, hence the `reader_` prefix.
- **Push (Expo push service).** `reader_push_tokens` maps Expo tokens to readers (a token moves to
  the account signed in on the device; sign-out removes it; tokens Expo reports as
  `DeviceNotRegistered` are deleted). Messages carry names and club names only, with an in-app
  path from an allowlist. Android uses two channels the reader can mute in system settings:
  `lembretes` and `comunidade`; lock-screen visibility is private. Delivery runs after the action
  succeeded, with a 2.5 s timeout, and a failure never fails the action.
- **Review reminders (cron).** The production Worker runs hourly (`0 * * * *`). For readers with
  the reminder on whose local hour matches, it counts due cards and sends one reminder per local
  day only when something is due (`last_reminder_date`). At most 500 readers per run.
- **Permissions.** The app asks only when the reader turns on a reminder or taps "Ativar
  notificações" (Android 13+ prompts after the channels exist). Expo Go and builds without push
  credentials report "unavailable" honestly; the inbox works everywhere.
- **Not built (no data or product decision):** "Alerta de curva crítica", "Paisagem sonora",
  sepia palette, export to Anki/Notion, cloud-sync badge, "+XP" and Bubo Score in notifications,
  club invitations to specific readers (invites are codes).

## Consequences

- Push needs owner setup: an EAS project id (`eas init`) and, for Android, Firebase credentials
  (`google-services.json` as the `GOOGLE_SERVICES_JSON` EAS file variable and the FCM v1 key in
  EAS). Until then pushes are skipped and the inbox still records everything.
- The Android notification icon references the official transparent adaptive foreground; Android
  renders its alpha shape. An official monochrome icon is still `needs-confirmation`
  (docs/brand-assets.md).
- The persisted query cache moved to `bubo.query-cache.v5` (new fields in stats and due cards).
