# AGENTS.md — working on Bubo

This guide is for AI agents and humans contributing to this repository. Follow it strictly.

## Product in one paragraph

Bubo helps readers _retain_ what they read. They read with focus, recall without peeking and review
at the right time, alone or in anti-spoiler clubs. The tone is warm, tactile and encouraging. The
official purple owl, Bubo, carries the emotional language. The UI language is Brazilian
Portuguese.

## Non-negotiable rules

1. **npm only.** Never add pnpm, Yarn or Bun files, commands or lockfiles.
2. **No OpenAI.** Gemini is the only LLM, called only from the API (`GeminiService`). The mobile
   app never holds AI keys or calls AI providers.
3. **Official assets are canonical.**
   - Never redesign, regenerate, trace, recolour or placeholder the logo or mascot.
   - Never use emoji or Stitch mascots in their place.
   - Use `src/assets/registry.ts` (`<BuboMascot state="…" />`).
   - If a state has no dedicated pose, use the closest official pose and document it. Unknown
     poses are marked `needs-confirmation`.
4. **Stitch is a reference, never a source.** Don't copy Stitch HTML. "BUBO — Home / Hoje" is the
   north star.
5. **Four tabs in the floating bar** (ADR-043): Hoje, Estante, Revisar, Comunidade, with the
   quick-actions "+" in the middle. Você keeps its route and opens from the profile avatar at
   the top of the screens. No AI/Chat tab.
6. **No fake business data.** Screens show honest empty states until real data exists. Sample data
   is allowed only in the DEV showcase route.
7. **No secrets in the repo or the app bundle.** `EXPO_PUBLIC_*` is public.
8. **No deploys and no remote changes** (Cloudflare, Neon, R2) unless a task explicitly asks for
   them.
9. **No git commits, branches or pushes** unless explicitly asked.

## Repository map

- `apps/mobile`: Expo SDK 57, Expo Router (`src/app`), theme (`src/theme`), components
  (`src/design-system`), features (`src/features`), infrastructure (`src/lib`).
- `apps/api`: Hono on Workers. Entry `src/index.ts` → `createApp()`. Routes in `src/routes`,
  services in `src/services`.
- `packages/*`: config, contracts, domain, scoring, database, testing. Consumed from source.
- `docs/`: start at [docs/README.md](docs/README.md). The ADRs explain every major choice.

## Commands

```sh
npm install            # root only
npm run verify         # MUST pass before you finish any task
npm run dev:mobile | dev:api | lint | format | typecheck | test | doctor
npm run assets:build | assets:check | audit:repo | package:zip
npm run db:migrate:check   # read-only; `db:migrate` applies (Neon from apps/api/.dev.vars)
npm run build:android     # free standalone APK with native widgets; includes verify
npm run install:android   # install existing APK on an authorized USB device
npm run build:android:setup | build:android:check
npm run email:preview     # local examples; no credentials or sending
npm run email:check       # read-only diagnostics unless --send-to is explicitly provided
npm run push:check        # read-only local Expo/Firebase/native diagnostics; never sends
```

After adding a screen, run `npx expo start` once in `apps/mobile` (a few seconds is enough) so
`.expo/types/router.d.ts` knows the new route; otherwise typecheck rejects typed `router.push`.

On Windows use PowerShell or cmd. All scripts are cross-platform Node.

## Coding conventions

- **TypeScript:** strict, with `noUncheckedIndexedAccess`.
  - No `any`, no `@ts-ignore`, no TODO/FIXME in code.
  - Use `import { type X }` for types.
- **Shared rules** go in `packages/domain` or `packages/scoring`: pure and tested. Shapes go in
  `packages/contracts`.
- **API:**
  - Every route is under `/v1`, has a contract and an `API_ROUTE_DEFINITIONS` entry, and has
    tests.
  - Expected failures throw `AppError(code, …)`.
  - Never log secrets or echo user-provided secrets.
- **Mobile:**
  - Use only theme tokens (no raw colours outside `src/theme`) and design-system components.
  - Server state goes in TanStack Query (no Redux).
  - Haptics go through `haptics.*`. Animations go through `FadeIn` or `useReducedMotion`.
  - Touch targets ≥ 48, with accessibility roles, labels and states.
  - Headers by screen kind (ADR-047): tab screens use `TabHeader`; pushed/modal screens use
    `FormScreen` `title` + optional `subtitle` below it (no eyebrows above titles); sections use
    `SectionTitle`. Text sizes come from the type scale (`meta`/`labelSm` for 12 pt), not overrides.
- **Database:** add a new `migrations/NNNN_name.sql` and update the Drizzle schema together. Never
  edit an applied migration.
- **Dependencies:**
  - Pin exact versions.
  - For Expo native modules, use `npx expo install` or the SDK's `bundledNativeModules.json`
    version.
  - Justify new dependencies in the PR or ADR.

## Definition of done

- `npm run verify` is green: format, lint, typecheck, tests, assets:check, audit:repo.
- New behaviour has tests (packages and API).
- The relevant docs and ADRs are updated.
- No new policy violations and no fake data.

## Auth rules (Task 02)

- Every data route goes behind `withDatabase → withAuth → requireSession`, scopes every query to
  `session.user.id`, and is registered with `auth: true`.
- Never weaken `authRedirectGuard`, trusted origins or `disableOriginCheck: false`. Never enable
  Better Auth telemetry.
- Mobile auth goes through `authClient`. The session cookie stays in SecureStore, and screens never
  read or log it. Login codes and reset codes are never logged anywhere; only
  `lib/auth/trusted-device.ts` touches the cookie jar, and only to keep the trust cookie.
- `apps/api/.local/` (PGlite data) holds real local accounts. Never commit or ship it.

## Current status and next step

Tasks 01–05 and 07–09 are complete in code (Task 05 still needs owner/device acceptance, see
[docs/roadmap.md](docs/roadmap.md)):

- foundation
- auth + onboarding
- reading sessions + Estante
- Revisar + production readiness
- Discover + catalog + ISBN
- Comunidade: clubs + anti-spoiler debates + moderation (Task 07)
- Comunidade part 2: invites, polls, reviews, friends, cycles, global moderation (Task 08)
- Você: preferences with real effect, notification inbox, push + review reminder cron (Task 09)

**Redesign 2.0, part 1 (2026-10-29; ADR-043):** the owner approved the Claude Design prototype
("Bubo — Redesign 2.0") for implementation in parts. Part 1 is in code: the app font is Nunito
(Plus Jakarta Sans only for native widgets), the floating full-width tab bar with the
quick-actions "+" (`features/shell`), `ProfileButton` at the top, `ScreenBottomInset` for tab
screens, `ProgressRing`, and the new Hoje as a "book stage" painted with the current book's
blurred cover (one primary button, milestone, goal/streak/review tiles, daily ticket, "Pra você
hoje", friends reading, Replay entry). Pure rules in `@bubo/domain/home.ts` (tested). No API,
migration or remote change; `npm run verify` green. Next parts: reading flow, Revisar,
Estante/Livro, Descobrir + algorithm, Comunidade, Replay, living mascot. Device acceptance and a
new APK pending.

**Redesign 2.0, part 2 (2026-10-29; ADR-044):** the reading flow follows the prototype with the
same session behaviour (draft, recovery, checklist, UUID, coach, rating prompt). `features/session`
now has the night timer (`NightTimer`: Book3D + ribbon bookmark, one leaf per focused minute,
page sheet on "Terminei por hoje"), the recall card (`RecallCard`: tabs, Caveat handwriting,
"Guardado" stamp mirroring the server checklist locally, final deliberate check + save), the
reading receipt (`Receipt`: IBM Plex Mono, only API XP/streak and the crossed milestone) and
`/sequencia` (`StreakNight`, from Hoje's streak tile and after a session that grew the streak).
Scene colours are the fixed `readingPalette`; accent fonts are `accentFontFamily`. Pure rules in
`@bubo/domain/reading-flow.ts` and the per-answer helpers of `@bubo/scoring/session-recall.ts`
(tested). No API, migration or remote change; device acceptance and a new APK pending.

**Redesign 2.0, part 3 (2026-10-29; ADR-045):** Revisar follows the prototype
(`features/recall/ReviewTab`): fanned stack of today's real cards with "até +X XP"
(`reviewXpRange`), the daily stamp card (`dailyStamps`, ink stamps, gold seal, "renova em Nh"; no
bonus XP), the month challenge (20 active days, `monthlyChallenge`) and two practice decks from the
new read-only `GET /v1/recall/practice` (lapsed cards, 60-second round; screen `treino`, nothing
sent, no XP or rescheduling). Pure rules in `@bubo/domain/review-practice.ts` (tested), API tests
in `recall.test.ts`. No migration; the route was deployed on 2026-10-29 (API `47ce4ca7…`). Device
acceptance pending.

**Redesign 2.0, part 4 (2026-10-29; ADR-046):** Estante is a library home
(`features/shelf/Library`: tab header since ADR-047, shelf circles, Continuar lendo,
collections, recents), the once-a-day opening corridor (`ShelfOpening`) and the old grid in
`prateleira`. Migration `0018_shelf_marks` adds Favorito/Tenho/Desejado and "Relendo" (a mark on
reading/paused, never a status; ends on finishing). `GET /v1/shelf/:id/community` returns only
anonymous counts with floors (readers 2+, ratings 5+, also-read 3/2+). The book page shows them,
the marks, the finish forecast and a Resenhas tab. Rules in `@bubo/domain/library.ts` (tested), API
tests in `book-community.test.ts`, legal text updated. Migration `0018` applied on Neon and API
`47ce4ca7…` deployed on 2026-10-29 (smoke: health/ready 200, new routes 401 without a session).

**Design audit (2026-10-29; ADR-047):** one header per screen kind — `features/shell/TabHeader`
(Estante, Revisar, Comunidade, Você: large title, ≤ 2 actions, avatar; Hoje keeps its stage) and
one `FormScreen` header (left title, context `subtitle` below, round 48 pt `HeaderButton`; eyebrows,
square buttons and `align` removed; Descobrir migrated). Tab bar shows labels with one active pill;
`SectionTitle` is the single section heading; new `meta`/`labelSm` tokens replaced 74 overrides.
No API or migration of its own; `npm run verify` green. A new test APK with parts 1–4 and this
audit was built on 2026-10-29 (`build/android/bubo-test.apk`, see docs/release.md); device
acceptance pending.

**Discover (2026-10-03; ADR-031):** `GET /v1/catalog/discover` builds Skoob-style shelves from a
taste graph (Dijkstra over shelf → authors/subjects → books, `@bubo/domain/recommend.ts`) using
only Open Library works with Portuguese editions, plus "Mais lidos no Bubo" (≥ 2 real readers).
Catalog burst 503 fixed (5 s queue, keyless Google `skipped`); covers no longer flash the
typographic fallback. Owner: `CATALOG_CONTACT_EMAIL`, device acceptance.

**Search/Estante (2026-10-04; ADR-033):** search returns real partial books after a 1.2 s merge
window while slower sources finish in background; cover metadata/ingestion has a 100 ms foreground
allowance. Virtualized lists, bounded prefetch, six-second stalled image candidates, stable search
focus and API-accepted cache updates. Estante has local title/author search, counts/status filters,
ordering and quick status actions. Adding supports Quero ler/Lendo/Já li across details, ISBN and
manual entry, without leaving results. Direct `finished` insertion is atomic; no sessions/XP/
streaks are generated. `finishedAt` is a declaration now, not a historical completion date for
Replay. Local implementation; updated API/app publication and visual/device acceptance pending.
Stories and monthly/annual Replay have a local recorded-reading implementation (ideas 21–23,
ADR-034); native delivery and acceptance remain pending.

**Replay and Stories (2026-10-04; ADR-034):** owner-scoped `GET /v1/me/replay` derives month/year
metrics from accepted sessions, never manual `finishedAt` declarations or local drafts. Convert
`endedAt` into the requested IANA time zone and label partial history; omit unsupported genres,
quotations, Pontes and private writing.
`generatedAt` from the server dates current-period artwork as `até DD/MM`; never relabel a stale
snapshot as today. Replay is excluded from persisted query caches, refetches on mount and shows
offline when its initial query is paused without data. Tied highlights use non-exclusive copy.
Replay is reached from Você; `story/[id]` from the book detail. Manual chapters, brief
reduced-motion-aware fades and a complete report; export current chapter/book as
1080 × 1920 PNG. Paper/night/violet styles use canonical tokens, fonts and a small official logo.
The Story shows the private saved shelf rating (ADR-035) and never publishes a review. Local `bubo-stories` native
module handles image delivery/saving; Expo Go shows previews and native unavailability. Direct
Instagram handoff requires a real public `EXPO_PUBLIC_INSTAGRAM_APP_ID`, Instagram and a new native
build. No migration or remote change is required. `npm run verify` passed (541 tests;
format/lint/types/assets/audit green). Android prebuild, Kotlin/manifest, release JS bundle and
full debug APK compilation/installation in an emulator checked; the emulator visual/export run was
interrupted and not completed (code re-reviewed and verify re-run 2026-10-04). Physical Android/iPhone/Instagram acceptance remains pending. See [docs/replay.md](docs/replay.md).

**Rating and grid Estante (2026-10-04; ADR-035):** private 1–5 `shelf_entries.rating` (`0016`,
applied to Neon; API deployed 2026-10-04 with Replay and ADR-033), `PATCH /v1/shelf/:id` `rating`. A root popup asks for a
rating whenever a book becomes Já li (status, add as Já li, session reaching the last page). Story
uses the saved rating (switchable). Estante is a 2-column grid; status actions live in the lean
book detail; sort pill + sheet; short search placeholder. verify passed (545 tests). Device
acceptance pending.

**3D book (2026-10-11; ADR-036):** `livro/[id]` opens on `Book3D` (design system): the flat
`BookCover` hinged on its right edge and tilted, a paper fore-edge whose depth is derived from
the real page count (`bookThickness`, `@bubo/domain`), hinge groove, gloss and shadow, all from
`bookPalette` tokens. Native-driver `Animated` only, single-level transforms; press turns the
book to face the reader; reduced motion keeps it still. Shelves/search/Stories keep the flat
cover. No API/migration/remote change. Device acceptance pending.

**Estante 3D (2026-10-11; ADR-037):** `estante-3d` (Estante header, shelves icon) draws the real
shelf as a cozy wooden bookcase (`Bookcase3D`): spines sized by page count (`spineWidth`), rows
from `packShelfRows` (`@bubo/domain`, tested), reading books face out, Bubo (`main` pose) on
top; tap → `ShelfSpotlight` with `Book3D` and real details, "Abrir livro". Visualisation only,
no writes. `shelfPalette` tokens. Book3D shadow softened (layered ellipses). Device acceptance
pending.

**Login codes, e-mail program, settings hub and legal (2026-10-12; ADR-038/039):** with an
e-mail provider, `sign-in/email` on an untrusted device answers `twoFactorRedirect` (Better Auth
`two-factor`, OTP only, hashed, 10 min, 5 attempts) and the app opens `(auth)/codigo`; "Lembrar
este aparelho" is the 30-day `trust_device` cookie, kept across sign-out by
`lib/auth/trusted-device.ts`. Password reset uses `email-otp` codes typed in the app (the link
flow stays for old builds); `/change-password` and deletion send notices. Without Resend the
plugin is not registered, sign-in needs only the password and `/v1/me.loginCodeAvailable` is
false. Optional e-mails need `reader_preferences.email_reading_reminders`, carry a signed
one-click opt-out (`/v1/email/unsubscribe`) and are logged in `reader_email_events`; the hourly
cron sends "Sentimos sua falta" (rules in `@bubo/domain/email-program.ts`). One e-mail frame
(logo, 200 px pose, headline, ≤ 40 words, code box or one button) with 6 embedded official poses.
Você → Configurações is a hub (`configuracoes/{index,leitura,notificacoes,emails,aparelho,seguranca}`)
on a shared `PreferencesForm`; `legal/termos` and `legal/privacidade` render
`features/legal/content.ts` and are linked from sign-up. `EXPO_PUBLIC_SUPPORT_EMAIL` (optional)
shows "Fale conosco". Migration `0017` applied on Neon, Resend domain `bubo.nyoneo.com.br`
verified, `RESEND_API_KEY`/`EMAIL_FROM` set on the Worker and API version `06a4c5e3…` deployed
(all 2026-10-12, `npm run email:activate` → `deploy:api`); production smoke passed and the
temporary account was removed. Login codes are now enforced in production; `dev:api` also sends
real e-mails (`.dev.vars`). Device and visual inbox acceptance pending.

**Reset, light e-mails and Skoob-style Estante (2026-10-13; ADR-040/041/042):** a successful
password reset (code or old link) now opens a session on that device (Better Auth `after` hook;
others still revoked), so `esqueci-senha` never asks for the new password or a second code. Builds
send `x-bubo-auth: login-code` (`@bubo/config`); a sign-in without it that would get the code
challenge answers `426 APP_UPDATE_REQUIRED` instead of hanging (root cause of the owner's
"senha nova não entra": pre-2026-10-12 builds ignore `twoFactorRedirect`). `useAuthState` shows
the boot screen only before the first session resolution: Better Auth re-flags a signed-out
session pending on each refetch, which used to unmount the navigator and drop the reader on
Boas-vindas instead of the code screen. E-mails have no
attachments: content-hashed ~30 KB PNGs (official pose in soft circles + logo) from
`GET /v1/email/art/:file`, white minimal frame. Estante: search bar to Descobrir, counter-tile
filters, "Lendo agora", 3-column cover grid; search rows with a "+" sheet (Quero ler/Lendo/Já
li); cover-first Descobrir (prefetched from Estante); shared `BookHero` (blurred cover + 3D book,
facts, synopsis) on `catalogo/[id]` and `livro/[id]` (instant from the shelf cache; tabs
Leitura/Sobre/Cards; progress editor in a sheet). New tokens `backdropVeil`/`bgClear`. No
migration. API `c264fd30…` deployed 2026-10-13 (production smoke: legacy 426, current
`twoFactorRedirect`, e-mail art 200; temporary account deleted). Device/inbox acceptance and a
new APK pending.

**Reading return (2026-10-04; ADR-032):** ideas 01–03/06 implemented/consolidated in code:
durable-session consolidation, real page/latest available writing from 20 recent sessions
(three-line preview + expand), optional fixed warmup question answered mentally, five-minute
normal session and one primary action in Hoje. Optional history loading/retryable failures may
use this account's real cached entry; authentication errors and confirmed missing books prevail.
Priority: saved draft → loading/error retry → offered reviews → return after 7+ local calendar
days without reading → continuation after reading today → normal reading → choose a book.
Real reading today prevents a return claim from stale recency; review priority shows secondary
book context, while recovery offers only its draft's book.
`/v1/me/stats.lastReadingDate` comes only from accepted owner-scoped sessions. A 300-second goal
and its acknowledgement persist in the local draft; never replace an existing draft, finish
automatically or award activity before the API accepts. Only a confirmed missing shelf entry
offers explicit local draft discard; network failures preserve it. `npm run verify` passed
(495 tests; format/lint/typecheck/assets/audit green). No current visual/device run, migration,
deployment, remote change or git commit. Device acceptance remains pending; no new owner setup.

**Task 06 (memory and stats)** is done except a documented retention model (curve, Bubo Score).
Observed delayed recall is implemented (ADR-030): self-assessments grouped by actual 1–6,
7–29 and 30+ day gaps, with counts and no prediction. Calibrated retention and Score remain open.
Continuation validation (2026-10-03): verify passed (441 tests), API published, production smoke passed and
temporary accounts removed. Current ARM64/ARMv7 test APK includes five widget receivers and
concise copy. Main screens were checked via current JS on an existing Android debug emulator;
physical-device acceptance and Swift compilation remain pending (docs/release.md).
**Task 07 (Comunidade: clubs, anti-spoiler debates, reports, blocks; ADR-019)** is complete and
deployed. **Task 08 (Comunidade part 2)** is complete and deployed: slice 1 (ADR-020: private clubs +
invites, members, polls, reactions, club feed; `0009`) and slice 2 (ADR-021: book reviews with
tags, friends + opt-in friends feed, club reading cycles, global moderation via
`MODERATOR_USER_IDS`; `0010`–`0012`). Device acceptance is pending. **Task 09 (ADR-022; `0013`)** is complete and
deployed: preferences, inbox, Expo push (hourly cron), Você rebuilt. Push on devices needs the
owner (EAS project id, Firebase). **Next:** accept the reading-return and Replay/Stories slices on a device, then
continue the ordered future-ideas checklist (saved quotations and their recall links, 07/09).
Task 06's calibrated retention
model/Score and source-bounded AI flows remain separate open work.

**Core and push (2026-10-03; ADR-027/028):** new sessions require a three-part recall exercise
(idea, detail, connection/question) that passes the server's versioned writing checklist before
progress, XP or cards are saved (`0014`). It does not verify book facts or measure retention.
Gemini only suggests an optional consented question; failure never blocks the local checklist.
Push has persistent provider receipts, session-bound registrations, atomic daily reminders and
account-checked native navigation (`0015`). Expo/FCM/APNs configuration and device acceptance are
still required. See [docs/core-validation.md](docs/core-validation.md) and
[docs/notifications.md](docs/notifications.md). Coordinate the new API and APK: older builds lack
required recall fields, while already accepted UUIDs remain retryable.

**Task 09 widgets (2026-10-01; ADR-023):** Android App Widgets and iOS WidgetKit code implemented,
with `widgets` previews/settings in Você. Source lives in `apps/mobile/modules/bubo-widgets`,
`native-widgets` and the local config plugin. Generated PNGs/fonts/tokens always come from
canonical assets/theme. Android APK compilation/signing verified (ADR-024); Swift compilation
and Android/iPhone device acceptance are pending;
see [docs/widgets.md](docs/widgets.md). **Redesign (ADR-026):** four Duolingo-style widgets
(Sequência, Sequência da semana, Calendário de leitura, Continuar leitura) with scenes from
`widgetScenes`, hourly moods from `@bubo/domain` and `monthActiveDates` in `/v1/me/stats`. Do not confuse prebuild/autolinking/JS export with native
device validation. Live Activities remain backlog 34; Android keyguard is not registered.

**Widgets redesign, streak protection and weekly league (2026-10-03; ADR-029):** Android widgets
are drawn on a Canvas (`BuboPainter.kt`) with Plus Jakarta Sans from module assets, because
RemoteViews ignore `@font`; never put `<View>` or other non-RemoteViews classes in widget layouts
(it caused "Can't load widget" in Sequência da semana). One clean surface (`widgetPalette`), no
scenes. Streak protection is derived (`computeStreakState`, 7 active days → 1, max 2, from
2026-10-03); `/v1/me/stats.streakFreeze`. Weekly friends league: `GET /v1/me/league`, screen
`liga`, fifth widget; only consented sharing friends. Snapshot v3. Validated on an Android 15
emulator; physical device and Swift compilation pending.

- Owner-only setup lives in [CONFIGURAR.md](CONFIGURAR.md); the screen test script in
  [docs/TESTAR-TELAS.md](docs/TESTAR-TELAS.md). Keep both current when screens or config change.
- Transactional emails (ADR-025): optional signup verification/welcome, reset, reset security
  notice. Preserve auto sign-in and session revocation during provider failures. Resend test
  reached owner Gmail INBOX; bubo.nyoneo.com.br DNS/public activation deferred by owner.
  Instructions: [docs/emails.md](docs/emails.md), [docs/emails-dns.md](docs/emails-dns.md).
- The shared Neon database has empty legacy tables (`clubs`, `club_polls`, `posts`, …). Never
  reuse those names; never drop them without the owner.
- Remote state (Neon migrations, Worker deploys, R2) lives in
  [docs/release.md](docs/release.md) → "Current remote state". Update it after every remote
  change.
- The owner authorized applying Neon migrations and deploying the API to Cloudflare as part of
  task work (2026-09-27): `verify` → `db:migrate:check` → `db:migrate` → `deploy:api` →
  smoke test `/v1/health` and `/v1/ready`. Commits still only when asked.

- The per-screen build plan is [docs/screens.md](docs/screens.md). Update it whenever a screen
  changes status.
- Releases follow [docs/release.md](docs/release.md). Remote migrations and API deploys have the
  owner's standing go-ahead (above); anything else remote (R2 public access, domains, plan, DNS)
  still needs an explicit request.

## Reading data rules (Task 03)

- Streak, XP, the week and missions are **derived from `reading_sessions` only** (ADR-014). Never
  store or show numbers that don't come from real activity.
- Sessions are idempotent on a client UUID. Keep that id stable across retries.

## Community rules (Task 07)

- Anti-spoiler is enforced by the API, never only in the app: content whose `spoiler_page` is beyond
  the reader's shelf page is sent `locked` with no text. Only `?reveal=1` returns it.
- Every new kind of user-generated content ships with report, block and author delete, and appears
  in the owner's moderation view. Logs carry ids and reasons, never the content.
- Clubs read one shared **catalog** book so page numbers mean the same for everyone.
- Pure rules go in `@bubo/domain/community.ts`; new tables use the `reading_club_` prefix.
