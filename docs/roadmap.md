# Roadmap

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

## 🟡 Task 05 — Discover + catalog + ISBN

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
- Neon: existing `DATABASE_URL` confirmed in the API's local configuration. Schema/ledger match
  Bubo, 0001–0007 already applied, zero pending. One identifiable isolated record was written,
  read back and removed with absence verified. No user shelf was populated and no secret changed.

## 🟡 Task 06 — Memory and stats (first vertical slice)

- `GET /v1/me/memory?today=YYYY-MM-DD`: seven days of owner-scoped review counts, grouped in
  Postgres from existing `review_logs`. No migration required.
- `estatisticas`, reached from Você → Minha memória: daily Lembrei/Quase/Esqueci self-assessments,
  real total, loading/error/retry and honest empty state. Cache is scoped by user/day and refreshed
  after reviews. These counts are not estimated retention, cognitive improvement or a Bubo Score.
- API tests cover auth, calendar validation, empty history, persisted/idempotent reviews,
  account isolation and date boundaries. Visual/device acceptance remains pending.
- Retention curve, book memory path, reading cycles, achievements/levels and Bubo Score remain.

## Later (see [screens.md](screens.md) for the full list)

- **Task 06, memory and stats:**
  - retention curve (`bubo_estat_sticas_curva_de_reten_o_mobile`)
  - memory path on the book screen
  - reading cycles
  - achievements and cognitive levels
  - the Bubo Score
- **Tasks 07–08, Comunidade:** anti-spoiler clubs, forum and polls, reviews, friends' feed. It
  ships with moderation, reporting and blocking.
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
