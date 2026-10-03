# Roadmap

## Núcleo e push — 2026-10-03

- API publicada com migrações `0014`/`0015`, `verify` verde (409 testes), smoke de produção
  30/30 e conta temporária apagada. APK Android assinado com quatro widgets e permissão de
  notificações verificados. Evidências e limites em [release.md](release.md).
- Sessões novas exigem recordação em três partes: ideia, detalhe e ligação ou dúvida. Conferência
  explícita na tela e recálculo obrigatório na API antes de progresso, XP e card. Rascunho durável,
  retries antigos preservados e avaliação versionada armazenada (`0014`; ADR-027).
- O checklist mede preenchimento do exercício, não correção do livro nem retenção. Gemini opcional
  sugere uma pergunta com consentimento; indisponibilidade não impede a avaliação local. Fontes,
  casos com capítulos reais e plano de calibração humana em [core-validation.md](core-validation.md).
- Push recebe recibos persistentes, vínculo ao login, correções de consentimento e lembretes
  transacionais, navegação por conta e mensagens divertidas curadas (`0015`). Diagnóstico local:
  `npm run push:check`. Veja [notifications.md](notifications.md).
- Task 06 ainda precisa calibrar retenção longitudinal e fidelidade factual com fontes. Task 09
  ainda precisa de Expo/FCM/APNs configurados e homologação em Android/iPhone. Compilação não
  comprova recebimento no aparelho.
- A nova API de sessão requer a nova build mobile; builds antigas com reflexão opcional não podem
  criar novas sessões. UUIDs já aceitos continuam confirmáveis. Distribuir os dois em conjunto.

## Continuação — 2026-09-30

- Emails (2026-10-01; ADR-025): boas-vindas/confirmação opcional, recuperação e aviso de senha
  alterada implementados com arte oficial. Teste Resend entregue e encontrado no Gmail INBOX.
  `bubo.nyoneo.com.br` preparado; dono adiou DNS/ativação pública. Veja [emails.md](emails.md).

- Minha memória: interface de 7/30/90/365 dias, histórico diário com rolagem, foco,
  horários das tentativas e revisões por livro com acesso ao detalhe. Cache por conta,
  data, período e fuso. Sem retenção estimada ou Score; aceite em aparelho pendente.
- As 34 ideias do proprietário estão no [checklist futuro](ideias-futuras.md), com
  critérios de aceite, dependências e sequência sugerida; os widgets 29–33 avançaram na Task 09.
- Task 08 concluída: resenhas, amigos e feed de amigos, ciclos de leitura do clube e moderação
  geral publicados (veja a seção da Task 08).
- Task 09 concluída (2026-10-01): Preferências cognitivas com efeito real, Notificações, push com
  lembrete diário de revisão e Você refeito no layout do Stitch. Push no aparelho depende da
  configuração do dono (EAS + Firebase).
- Task 09 ampliada (2026-10-01): widgets nativos Android/iOS, prévias e preferências em
  **Você → Bubo na sua tela**. APK Android compilado/assinado; iOS e aceite em aparelhos pendentes.
  Veja [widgets.md](widgets.md) e ADR-023. Próxima fase principal continua sendo o modelo
  documentado de retenção da Task 06; Live Activity é um recorte separado do backlog.

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

## ✅ Task 08 — Comunidade part 2 (code complete and deployed, 2026-09-30; device acceptance pending)

### Slice 1 (2026-09-28)

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

### Slice 2 (2026-09-30, ADR-021)

- **Database:** `0010_club_book_reviews` (rating 1–5 + up to 3 tags on club topics),
  `0011_club_reading_cycles` (cycles + participant snapshot), `0012_reader_friendships`
  (friendships + social preferences). Applied to Neon on 2026-09-30.
- **API (10 routes):** reviews via `/v1/clubs/:id/posts?reviews=1` and the existing topic routes;
  `GET|POST /v1/clubs/:id/cycles`, `POST /v1/clubs/:id/cycles/:cycleId/close`;
  `GET /v1/community/friends`, `PUT /v1/community/friends/:userId`,
  `GET /v1/community/friends-feed` (with `readingNow`), `PUT /v1/me/social-preferences`;
  `GET|POST /v1/me/moderation` (`MODERATOR_USER_IDS` only), `isModerator` on `/v1/me`.
- **Mobile (Stitch layouts):**
  - `nova-resenha/[clubId]` ("Avaliar & Resenhar"): book card, Bubo tip, 48 pt stars with a
    caption, "Como essa leitura reverberou?" chips, word count, anti-spoiler toggle with half /
    my page / ending points and an exact page, "Onde compartilhar".
  - `resenhas/[clubId]/[postId]`: author card with "Amizade"/"Aceitar", stars, tags, veil and
    replies. The club **Resenhas** tab and the book detail "Avaliar & resenhar" entry (catalog
    books only) lead here.
  - `amigos` ("Feed de amigos"): Atividade / Amigos / Privacidade, "Lendo agora" row, session
    cards, requests and opt-in toggles. The Comunidade header gained an "Amigos de leitura"
    button.
  - `ciclos/[clubId]` ("Ciclos & leituras anteriores"): Bubo historiador, real totals, year chips,
    current cycle with days left and group progress, timeline, owner start/close. The club Ciclos
    tab became a row under the book strip.
  - `moderacao`: queue with counts and reasons, reveal toggle, remove/keep.
- **Fixed:** `_layout` still registered the deleted `diretrizes/[clubId]` and left nine
  Comunidade routes outside the signed-in guard; OpenAPI and `me` contract tests were stale; the
  friend/cycle routes referenced the rate limiter before declaring it; social preference writes
  were not rate-limited; the cycle query key could hold `undefined`. Query cache key bumped to v4.
- **Tests:** domain `cycles` (group %, days left, weeks, summary), API friends (`readingNow`,
  consent windows, blocks), review tags (lock, reveal, duplicates, tags without rating) through
  the real mobile client, OpenAPI route list.
- **Production (2026-09-30):** API version `95b22fbd` deployed; two-account smoke test (see
  [release.md](release.md)).
- **Deferred:** club notifications and an inbox move to Task 09 (they need push and read state;
  invites are codes, not per-user invitations). A public review feed, review drafts and "+XP"
  need product decisions. Device acceptance of every Comunidade screen is pending.

## 🟡 Task 09 — Você, preferences, notifications, push and widgets (core deployed; native widget acceptance pending)

- **Database:** `0013_reader_preferences_notifications` — `reader_preferences`, `reader_push_tokens`,
  `reader_notifications` (legacy `notifications`/`push_devices`/`user_settings` exist in Neon,
  hence `reader_`). ADR-022.
- **API (6 routes + cron):** `GET|PUT /v1/me/preferences`, `POST /v1/me/push-token`,
  `DELETE /v1/me/push-token/:token`, `GET /v1/notifications`, `POST /v1/notifications/read`.
  Replies, friend requests/acceptances and new cycles write the inbox and push (names only, never
  content; per-category switches; unregistered tokens deleted). Hourly cron sends the review
  reminder at each reader's local hour, once a day, only when cards are due.
- **Preferences with real effect:** review rigor scales SM-2 intervals (1.25 / 1 / 0.8); the daily
  review limit caps `/v1/recall/due` (`dailyLimit`, `reviewedToday`); the daily focus goal drives
  Hoje's mission (`focusedMinutesToday`); the yearly goal appears in Você.
- **Mobile (Stitch layouts):**
  - `configuracoes` ("Preferências cognitivas"): Bubo tip, SM-2 rigor tiles, cards per day,
    focus goal tiles, yearly goal, palette tiles, haptics, push status/permission, reminder +
    hour chips, community/friends switches, anti-spoiler shield (locked on), save footer.
  - `notificacoes`: Todas / Memória / Comunidade, live "Hora de revisar" card, Guardião Bubo
    summary, Hoje / Esta semana / Antes, accept/decline friend requests inline, mark all read.
  - `(tabs)/voce` rebuilt from "Meu perfil": squircle avatar, level pill, XP to next level, books
    read / Lembrei 30 dias / streak, recent badges, yearly goal ring, reading profile, account
    rows; bell with the real unread count and settings gear (also a bell in Hoje).
  - New primitives: `OptionTiles`, `HeaderButton` badge. Theme and haptics are saved on the
    device (`lib/device-preferences.tsx`) and load before the first frame.
  - Push: `lib/notifications.ts` (Android channels `lembretes`/`comunidade`, Android 13
    permission after channels, Expo token, allowlisted deep links on tap, token removed on
    sign-out). `expo-notifications` added with `npx expo install`.
- **Android pass:** `FormScreen` keyboard uses `padding` on Android too (edge-to-edge in SDK 57
  no longer resizes the window, so composers and publish buttons were hidden by the keyboard);
  badge text without font padding; alerts checked for the 3-button limit; hardware back on the
  focus session already confirms through `beforeRemove`.
- **Fixed from earlier phases:** the theme choice was never saved (reset on every start);
  duplicated doc comment in the stats contract; Revisar/Hoje/tab badge now show what is offered
  today.
- **Tests:** domain `preferences` (rigor, limit, local clock); DB constraints and cascades for
  `0013`; API `notifications.test.ts` (preferences validation, tokens moving between accounts,
  grouped replies without content, switches, blocks, read state, friend and cycle events,
  unregistered tokens, daily limit + rigor, focus minutes, cron once per local day); mobile client
  for the new routes.
- **Needs the owner:** EAS project id (`eas init`) and Firebase/FCM for Android push; an official
  monochrome notification icon (`needs-confirmation`). See CONFIGURAR.md.
- **Not built (no data or decision):** "Alerta de curva crítica" (needs a retention model),
  "Paisagem sonora", sepia palette, Anki/Notion export, cloud-sync badge, invitations to specific
  readers.

### Slice 2 — Native widgets (2026-10-01, ADR-023)

- **Android:** three resizable home widgets (Continuar leitura, Ritmo da semana, Bubo completo),
  system pin request when supported, real book/page/progress, reading-day activity, capped review
  counts and guarded deep links. No Android keyguard widget is registered.
- **iOS:** reading/rhythm small/medium/large; complete medium/large and compact lock screen
  variants. App Group and embedded WidgetKit target configured by the local Expo plugin.
- **App:** `widgets`, reached from Você; real-data previews, enable/disable, weekly reading target
  and lock screen title privacy (hidden by default). No extra tab.
- **Data:** `/v1/me/stats` adds owner-scoped `weekReadingDates` (sessions only); existing cognitive
  week unchanged. Snapshots expire; clear on account change, disabling, sign-out/revocation and
  deletion. Old downloads cannot resurrect cleared data. No new migration.
- **Assets:** official PNGs and fonts copied byte for byte, light/dark native tokens generated
  from the existing theme. Poses reading/review/celebrating/empty/sleeping/welcome/neutral.
- **Local validation:** domain/publisher/native-generation tests, Android prebuild, Android/iOS
  autolinking, iOS mod/project generation and Android/iOS JS exports. Follow-up ADR-024:
  free local Android APK compiled for ARM64/ARMv7, signature, three widget receivers and embedded
  JS verified; full verify green (330 tests). Java/SDK bootstrap and cached builds are automated.
  macOS/Xcode remain unavailable; Swift compilation and Android/iPhone device acceptance stay
  open in CONFIGURAR and TESTAR-TELAS. See [build-mobile.md](build-mobile.md).
- **API deployment:** reading-only stats published as Worker version `1f7b4dcc` after green
  `npm run deploy:api` (316 tests); Neon through `0013`, no pending migration. No mobile build
  or store release was performed.
- **Earlier-phase audit:** initial full verify green. Corrected outdated screen-test guidance
  that still said settings/inbox were missing, and push copy that promised any installed build
  would work despite missing owner configuration.

### Slice 3 — Duolingo-style widget redesign (2026-10-01, ADR-026)

- **Four widgets:** Sequência (small + iPhone lock screen), Sequência da semana (week checks),
  Calendário de leitura (month runs) and Continuar leitura (white book card). They replace
  Ritmo da semana / Bubo completo; previously installed widgets must be added again.
- **Look:** full-bleed scene gradients from `widgetScenes`, flame + streak number (lit only
  with activity today, red "!" while at risk), short caption and the official Bubo peeking
  from the bottom edge; vector decorations generated by the plugin for Android and iOS.
- **Moods by hour** decided in `@bubo/domain` (`buildWidgetMoods`, `widgetMoodNow`): day
  nudge, 18h/21h/22h streak-at-risk escalation only with a real streak, celebration after
  activity, sleep at night, honest stale/no-data states. Snapshot v2.
- **API:** `/v1/me/stats` adds `monthActiveDates` (default `[]`). No migration.
- **App:** `widgets` rebuilt with faithful previews and today's mood timeline.
- **Pending:** launcher/WidgetKit device acceptance, Swift compilation (no macOS here).

## Later (see [screens.md](screens.md) for the full list)

- **Task 06 leftovers:** retention model → retention curve and Bubo Score; badge unlock ledger;
  device acceptance of `estatisticas` periods/breakdowns UI (implemented 2026-09-30).
- **Task 08 leftovers:** device acceptance of the Comunidade screens.
- **Task 09 leftovers:** owner push setup (EAS project id, Firebase/FCM), official monochrome
  notification icon, device acceptance (Android 13 permission, channels, deep links, keyboard).
- **AI (Gemini, server-side):** recall question suggestions and reflection feedback, inside existing
  flows. There is no AI or chat tab.
- **Before the first store release:**
  - Privacy Policy and Terms (consent at sign-up)
  - mandatory e-mail verification (optional confirmation implemented in ADR-025)
  - data export (LGPD)
  - Workers Paid plan

  See [release.md](release.md).
