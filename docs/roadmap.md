# Roadmap

## Continuação — 2026-09-30

- Minha memória: interface de 7/30/90/365 dias, histórico diário com rolagem, foco,
  horários das tentativas e revisões por livro com acesso ao detalhe. Cache por conta,
  data, período e fuso. Sem retenção estimada ou Score; aceite em aparelho pendente.
- As 34 ideias do proprietário estão no [checklist futuro](ideias-futuras.md), com
  critérios de aceite, dependências e sequência sugerida. Ainda não implementadas.
- Próxima etapa da Comunidade: resenhas com anti-spoiler, denúncia, bloqueio, exclusão
  e moderação, seguida de amizades e ciclos.

## ✅ Task 01 — Foundation

- Monorepo, tooling and quality gates.
- API skeleton (health, ready, OpenAPI, Gemini and R2 services).
- `0001_foundation`.
- Mobile shell: design system, official assets, 5 tabs, Home shell, DEV showcase.
- Docs and ADR-001…011.

## ✅ Task 02 — Auth + Onboarding

- **Better Auth on `/v1/auth/*`:**
  - e-mail + password: sign-up, sign-in, sign-out, password reset
  - Expo plugin with SecureStore
  - trusted origins, redirect guard, DB-backed rate limits
- **API:** `GET /v1/me`, `PUT /v1/me/onboarding` (transactional, idempotent), `GET /v1/shelf`.
- **Database:** `0002_onboarding` (reader profile, books, shelf) and `0003_auth_rate_limits`, plus
  a shared migrator.
- **Local stack with no cloud:** `npm run dev:api` uses PGlite when there's no `DATABASE_URL`.
- **Mobile:**
  - guards (`Stack.Protected`)
  - screens: boas-vindas, cadastro, entrar, esqueci/redefinir senha
  - onboarding 2–6 (hábito, objetivos, interesses, primeiro livro, concluído)
  - Hoje "Lendo agora" and Estante show real data; Você shows the profile, appearance and sign-out
- ADR-012 and ADR-013.

**Deferred on purpose:**

- Google sign-in (the Stitch button): needs OAuth client ids.
- Terms/privacy consent: no legal documents yet.
- Catalog search and ISBN scan in "primeiro livro".
- The "+20 XP" promise: no XP system yet.

## ✅ Task 03 — Reading sessions + Estante

- **Estante:** manual add (quero ler / lendo), grouping by status, and a book screen with status
  chips, a progress and page-count editor, session history and removal.
- **Focused reading session:**
  - timestamp-based timer, keep-awake, confirmation before leaving
  - page reached + optional reflection
  - result screen with real minutes, pages, XP and streak
- **API:** `POST/GET/PATCH/DELETE /v1/shelf[/:id]`, `POST /v1/sessions` (idempotent, with
  plausibility checks) and `GET /v1/me/stats`.
- **Database:** `0004_reading_sessions`.
- **Hoje** is now fully real: streak and XP in the header, cognitive week, "Missão de hoje", and
  "Continuar leitura" / "Atualizar".
- **UI fix:** `Raised` two-layer depth for buttons and cards, and centred onboarding badges.
- ADR-014.

**Deferred on purpose:**

- Restoring a running session after the OS kills the app.
- Book covers.
- Catalog search and ISBN scan.

## ✅ Task 04 — Revisar (active recall + spaced review) and production readiness

- **Recall cards:**
  - created automatically from session reflections, or written by hand on the book screen
  - review flow "sem espiar": try, reveal, self-grade
  - SM-2 scheduling, a due badge on the Revisar tab, and real "Recuperação ativa" on Hoje
  - reviews count toward the streak, the week and XP
- **API:** `GET /v1/recall/due`, `POST /v1/recall/cards`, `DELETE /v1/recall/cards/:id`,
  `POST /v1/recall/cards/:id/review` (idempotent, no early review).
- **Database:** `0005_recall` (`recall_cards`, `review_logs`).
- **Production:**
  - Resend e-mail for password reset
  - in-app account deletion (store requirement / LGPD)
  - production config validation: https auth URL, e-mail and DB required
  - a safe `wrangler.toml` (dev Worker named apart from production)
  - `deploy:api` and `db:migrate` scripts
  - `eas.json` with https-enforced release builds
  - [release.md](release.md)
- **[screens.md](screens.md):** every Stitch screen mapped to a route, a status and its needs.
- ADR-015.

## ✅ Task 05 — Discover + catalog + ISBN (code complete; owner acceptance pending)

- Done: server-side catalog lookup (Open Library / Google Books / BrasilAPI ISBN, cached), Discover, first-book and
  add-book search, manual fallback, and ISBN scanner (`expo-camera`). See ADR-016.
- Done: light theme as the default and a visual pass on Estante, Revisar, login, onboarding,
  focused reading and profile using real account data. Other existing screens still need visual
  review on a device.
- Done: edition-preserving deduplication, bounded title/author alternatives, ISBN-10/13
  equivalence, partial failures and approximate-match/language labels.
- Done locally: bounded cover ingestion through `MediaStorage` when opening or adding one book;
  search reuses cached covers without downloads. Requires `MEDIA` and `MEDIA_PUBLIC_URL`;
  external/typographic fallback remains available.
- Public read-only probes: Open Library returned editions for “Dom Casmurro”; BrasilAPI/CBL
  returned ISBN `9788545702870`; keyless Google Books returned quota HTTP 429.
- Remaining: device acceptance for search/scanner/edition selection and cover fallback;
  Google with an owner-configured key and real R2 delivery. No remote configuration,
  upload, migration or deployment was performed. Neon persistence was separately verified below.
  Fixtures do not prove provider coverage.

- Search regression fixed: the mobile client had omitted `/catalog/search`, turning a route 404
  into “not found”. Authenticated client/API tests cover the actual URL, cookie, results, empty
  results and failures. Live authenticated API probes returned title/author, ISBN-10 and ISBN-13
  results with Open Library/BrasilAPI despite Google's quota failure (ADR-016).
- Closed 2026-09-27: catalog routes documented in [api.md](api.md); screens re-checked against
  the shared patterns. What remains needs the owner and cannot be done in code: device
  acceptance (scanner, edition labels, large fonts, assistive tech), a Google Books key, and R2
  `MEDIA_PUBLIC_URL` configuration. See [release.md](release.md).
- Neon: existing `DATABASE_URL` confirmed in the API's local configuration. Schema/ledger match
  Bubo, 0001–0007 already applied, zero pending. One identifiable isolated record was written,
  read back and removed with absence verified. No user shelf was populated and no secret changed.

## 🟡 Task 06 — Memory and stats (slices 1–3 done)

- `GET /v1/me/memory?today=YYYY-MM-DD`: seven days of owner-scoped review counts, grouped in
  Postgres from existing `review_logs`. No migration required.
- `estatisticas`, reached from Você → Minha memória: daily Lembrei/Quase/Esqueci self-assessments,
  real total, loading/error/retry and honest empty state. Cache is scoped by user/day and refreshed
  after reviews. These counts are not estimated retention, cognitive improvement or a Bubo Score.
- API tests cover auth, calendar validation, empty history, persisted/idempotent reviews,
  account isolation and date boundaries. Visual/device acceptance remains pending.
- **Slice 2 (2026-09-27):**
  - `livro/[id]` "Caminho de memória": a real timeline of the book's sessions and graded
    reviews, then the next review ("hoje" + "Revisar agora", or the next date). Pure
    `buildMemoryPath` in `@bubo/domain`; `GET /v1/shelf/:id` now includes the book's last 20
    reviews (owner-scoped, no migration).
  - `estatisticas` rebuilt on `FormScreen` with the Você stat-tile pattern, a stacked 7-day
    Lembrei/Quase/Esqueci chart and an explicit "not retention" note (`summarizeMemoryDays`).
  - ADR-017. Domain and API tests cover ordering, truncation, due/upcoming steps, owner
    isolation and idempotent retries.
- **Slice 3 (2026-09-27): achievements and cognitive levels** (ADR-018).
  - `GET /v1/me/achievements?today=`: level from real XP (8 levels in `@bubo/scoring`) and
    13 badges (`@bubo/domain`) recomputed on every read from sessions, reviews and the shelf.
    No table or migration; nothing is granted manually.
  - `conquistas` (Você → "Mural de conquistas"): level card + progress, conquistas/streak tiles,
    badges by category with locked progress. Cache invalidated after sessions, reviews and shelf
    changes.
  - Tests: pure rules (thresholds, caps, longest streak across months/years) and API (auth,
    date validation, idempotent session retries, owner isolation, broken current streak).
- **Audit (2026-09-27):**
  - `npm run verify` green; Android JS bundle exported successfully (`expo export`).
  - Live smoke test on the local API (PGlite): health/ready, sign-up, catalog search via Open
    Library (Google still HTTP 429 without a key), ISBN `9788545702870` via BrasilAPI, add from
    catalog, session with reflection → card, shelf detail with `reviews`, OpenAPI.
  - Fixed: the offline query cache (persisted, busted only by app version) could hand the new
    book screen a cached detail without `reviews` after an OTA update. Cache key bumped to
    `bubo.query-cache.v2` (the orphaned v1 entry in AsyncStorage is harmless and unused).
- **First production deploy (2026-09-27):** API live at `https://bubo-api.bubo-api.workers.dev`
  against the existing Neon database (no pending migrations). Launched without e-mail by owner
  decision: config accepts production without Resend (pair must be complete if set) and
  `request-password-reset` answers 503 up front, because Better Auth would otherwise reply 200
  and drop the e-mail in a background task. Details and what is still unset:
  [release.md](release.md) → "Current remote state".
- **Test stability:** API suite capped at 4 vitest workers (PGlite per suite crashed forks on a
  12-core/16 GB Windows machine); per-test harness hooks get the same 60 s as `beforeAll`.
- **Reading cycles — re-scoped:** the Stitch "Histórico de ciclos" is a _club_ history (group
  progress, club cycles, archived cycles), so it moves to Comunidade (Tasks 07–08). Personal
  re-reads have no product need yet; when they do, add `reading_cycles` then.
- Remaining in Task 06: retention curve and Bubo Score (need a documented model + ADR first),
  badge unlock dates/tiers (need an unlock ledger), device acceptance of all Task 06 screens.

## 🟡 Task 07 — Comunidade: clubs + anti-spoiler debates (code complete, deployed)

- **Database:** `0008_community` (`reading_clubs`, `reading_club_members`, `reading_club_posts`,
  `reading_club_replies`, `reading_club_reports`, `user_blocks`). The `reading_club` prefix avoids
  empty legacy tables (`clubs`, `club_members`, `content_reports`, `club_polls`…) that already exist
  in the shared Neon database and were never created by Bubo migrations. Nothing was dropped.
- **API (ADR-019):** 17 routes under `/v1/clubs`, `/v1/reports`, `/v1/blocks`. Anti-spoiler is
  enforced server-side: content beyond the reader's shelf page is sent `locked` without text;
  `?reveal=1` is the explicit peek. Replies inherit at least the topic page. Joining requires
  accepting the guidelines and shelves the club's (catalog) book.
- **Moderation:** report (hidden for the reporter at once; 3 distinct reports hide it for all but
  author and owner), owner remove/restore with per-item report counts, author delete, block
  (one-way, all clubs), 5 owned clubs per reader, 30 writes/min per reader.
- **Mobile:** Comunidade tab (my clubs, discover, search), `clubes/novo`, `clubes/[id]`,
  `novo-debate/[clubId]`, `debates/[clubId]/[postId]`, `diretrizes/[clubId]`, `bloqueados`
  (Você → Leitores bloqueados). Flat routes because Expo Router typed `clubes/[id]/index` without
  its param.
- **Tests:** domain rules, DB constraints/cascades, 15 API scenarios (auth, membership, locks,
  reveal, idempotency, cross-club isolation, reports threshold, owner review, blocks, account
  deletion) and the real mobile client driving the whole flow.
- **Production (2026-09-27):** `0008` applied to Neon, API version `9c50e6bd` deployed. A two-account
  production smoke test (create, discover, join, locked topic, peek, reply page inheritance, report,
  owner restore, block/unblock, delete club, delete accounts) passed.
- **Task 05 fix found in this audit:** `descobrir` had no entry point in the app. Estante now has a
  "Descobrir livros" button (compass) in its header.
- **Owner guides:** [../CONFIGURAR.md](../CONFIGURAR.md) (everything left to configure) and
  [TESTAR-TELAS.md](TESTAR-TELAS.md) (every screen, how to reach it, what to check).
- **Task 08** continues below (`diretrizes/[clubId]` became the club's "Diretrizes" tab).

## 🟡 Task 08 — Comunidade part 2 (slice 1 done and deployed, 2026-09-28)

- **Database:** `0009_club_polls_invites` (additive): topic kind/chapter/quote, club visibility +
  invite code, polls (options, votes, arguments), reactions, reports on polls/arguments.
- **API (ADR-020):** 12 new routes — `GET /v1/community/feed`, `POST /v1/clubs/join`,
  `GET /v1/clubs/invite/:code`, `POST /v1/clubs/:id/invite-code`, `GET /v1/clubs/:id/members`,
  `GET|POST /v1/clubs/:id/polls`, `GET|DELETE /v1/clubs/:id/polls/:pollId`,
  `PUT /v1/clubs/:id/polls/:pollId/vote`, `PUT|DELETE /v1/clubs/:id/polls/:pollId/argument`,
  `PUT /v1/reactions`. Private clubs are invisible (404) without the code; poll results stay
  hidden until the reader votes; everything spoiler-locked like topics.
- **Mobile (Stitch layouts):** Comunidade tab rebuilt (Feed Geral / Seus Clubes / Descobrir, filters,
  "Recebeu um convite?"), `clubes/[id]` with tabs Debates & Fórum / Enquetes / Membros / Diretrizes
  and the "Perfil do clube" hero, `clubes/novo` (public/private), `novo-debate/[clubId]` (type,
  chapter, quote), `nova-enquete/[clubId]`, `enquetes/[clubId]/[pollId]` (live results,
  synthesis from real votes, arguments with reactions, composer), `convidar/[clubId]` (real QR,
  link with copy, WhatsApp/Telegram/e-mail/share, owner rotates the code) and `convite/[code]`
  (deep link `bubo://convite/CODE` → preview → join). New design-system primitives: ActionRow,
  BottomSheet, BuboTip, GradientCard, IconTile, Pill, SectionTitle, SegmentedTabs, StatTile,
  Stepper, TabChip, Toggle. New deps: `qrcode-generator` (pure JS QR) and `expo-clipboard`
  (SDK module, included in Expo Go).
- **Task 06 follow-up in the same slice (API only):** `/v1/me/memory` takes `days`
  (7/30/90/365) and `tz`, adds per-book tallies, time-of-day attempts, card totals and focus; shelf
  detail adds `reviewTotals`; badges get a fixed medal tier. `estatisticas` still shows 7 days.
- **Tests:** domain (percentages, invite codes, page buckets, day parts, recall strength, tiers),
  DB constraints, API suites `community-clubs-2` and `community-polls`, memory breakdowns, and the
  real mobile client driving invites/polls/arguments/reactions/members/feed.
- **Production (2026-09-28):** `0009` applied to Neon, API version `a71892ff` deployed, two-account
  smoke test (private club, discover hidden, 404 for outsiders, preview, join by code, poll +
  idempotent retry, hidden results, vote, argument, reaction, members, feed, report, owner restore,
  code rotation, old code 404, member cannot rotate, delete club, delete accounts) passed 27/27.
- **Fixed in this audit:** root `db:migrate -- --check` did not forward `--check` and applied
  migrations (this is how `0009` reached Neon, right after a green verify). Root script fixed and
  `npm run db:migrate:check` added. Club profile used a mascot _state_ `takingNotes` that does not
  exist (now the official _pose_).
- **Remaining in Task 08:** reviews/resenhas (`livro/[id]/resenha`, `resenhas/[id]`), friends +
  friends' feed (needs follows and privacy settings), club reading cycles ("Histórico de ciclos"),
  club notifications + invites inbox (needs push, Task 09), Bubo-wide admin moderation tool,
  device acceptance of every Comunidade screen.

## Later (see [screens.md](screens.md) for the full list)

- **Task 06 leftovers:** retention model → retention curve and Bubo Score; badge unlock ledger;
  device acceptance of `estatisticas` periods/breakdowns UI (implemented 2026-09-30).
- **Task 08 leftovers:** see the list above.
- **Task 09, Você:** settings and cognitive preferences, notifications (Expo Push + a Worker cron
  for due reviews).
- **AI (Gemini, server-side):** recall question suggestions and reflection feedback, inside existing
  flows. There is no AI or chat tab.
- **Before the first store release:**
  - Privacy Policy and Terms (consent at sign-up)
  - e-mail verification
  - data export (LGPD)
  - Workers Paid plan

  See [release.md](release.md).
