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

- Done: server-side catalog lookup (Open Library / Google Books, cached), Discover, first-book and
  add-book search, manual fallback, and ISBN scanner (`expo-camera`). See ADR-016.
- Done: light theme as the default and a visual pass on Estante, Revisar, login, onboarding,
  focused reading and profile using real account data. Other existing screens still need visual
  review on a device.
- Remaining: ingest book covers into R2. Current HTTPS provider covers may be unavailable.

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
