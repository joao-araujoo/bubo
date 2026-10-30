# Screen map — every Stitch screen → app route → status

This is the working plan for building every screen. Stitch is a **visual reference**: we rebuild
natively with the design system and never copy HTML (ADR-008). See
[stitch-inventory.md](stitch-inventory.md) for the file-level inventory.

**Status:**

- ✅ **done**: implemented with real data.
- 🟡 **partial**: implemented, but part of the Stitch design is deferred (noted).
- ⬜ **todo**: not started. The "needs" column lists what's required.

## How to build the next screen

1. Open the Stitch PNG (`stitch_bubo_read_deeply/…/<folder>/screen.png`) as a visual reference.
2. **API:** add the Zod contract to `packages/contracts` and register the route
   (`API_ROUTE_DEFINITIONS`, `auth: true`).
   - Write the SQL migration (next `NNNN_`) and the matching Drizzle schema.
   - Put the service in `apps/api/src/services`, the route in `apps/api/src/routes`, and the
     tests in `apps/api/test` using the `harness.ts` pattern.
3. **Mobile:** add the client method and hook in `src/lib/api`.
   - Create the route file in `src/app`. Register it inside the right `Stack.Protected` group in
     `src/app/_layout.tsx`.
   - Build it only from `src/design-system` and theme tokens. Mascots come from
     `mascotForState`. Show honest empty and error states.
4. Run `npm run verify`, update this table and `docs/roadmap.md`.

## Map

| Stitch screen                                                    | Route                                                          | Status | Notes / needs                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------- | -------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Home / Hoje**                                                  |                                                                |        |                                                                                                                                                                                                                                                                                                   |
| `bubo_home_hoje` (north star)                                    | `(tabs)/index`                                                 | ✅     | ADR-032: one primary action from draft/reviews/real reading recency, no empty review card; reading context, week and focus mission. Code checked (495 tests); device acceptance pending.                                                                                                          |
| `bubo_home_vis_o_cognitiva_desktop_1440px`                       | —                                                              | n/a    | desktop; content covered by Hoje                                                                                                                                                                                                                                                                  |
| **Auth**                                                         |                                                                |        |                                                                                                                                                                                                                                                                                                   |
| `bubo_login_autentica_o_mobile` / `bubo_login`                   | `(auth)/entrar` + `(auth)/codigo`                              | 🟡     | ADR-038: password → six-digit e-mailed code on untrusted devices, "Lembrar este aparelho" (30 days), resend with cooldown; Google sign-in deferred (OAuth client ids + Apple Sign-In required together on iOS); device acceptance pending                                                         |
| `bubo_cadastro`                                                  | `(auth)/cadastro`                                              | ✅     | consent sentence linking Termos de Uso and Política de Privacidade (ADR-039)                                                                                                                                                                                                                      |
| `bubo_esqueci_minha_senha`                                       | `(auth)/esqueci-senha` (+ legacy `redefinir-senha`)            | ✅     | ADR-038/040: code typed in the app + new password on the same screen; a successful reset signs the reader in on that device (no second code); the e-mailed link stays for older builds                                                                                                            |
| **Onboarding**                                                   |                                                                |        |                                                                                                                                                                                                                                                                                                   |
| `bubo_onboarding_boas_vindas`                                    | `(auth)/boas-vindas`                                           | ✅     | 1/6                                                                                                                                                                                                                                                                                               |
| `bubo_onboarding_h_bito`                                         | `onboarding/index`                                             | ✅     | 2/6                                                                                                                                                                                                                                                                                               |
| `bubo_onboarding_objetivo`                                       | `onboarding/objetivo`                                          | ✅     | 3/6                                                                                                                                                                                                                                                                                               |
| `bubo_onboarding_interesses`                                     | `onboarding/interesses`                                        | ✅     | 4/6                                                                                                                                                                                                                                                                                               |
| `bubo_onboarding_primeiro_livro`                                 | `onboarding/primeiro-livro`                                    | ✅     | catalog search, ISBN and manual entry                                                                                                                                                                                                                                                             |
| `bubo_onboarding_conclu_do`                                      | `onboarding/concluido`                                         | ✅     | "+20 XP" not promised                                                                                                                                                                                                                                                                             |
| **Estante & books**                                              |                                                                |        |                                                                                                                                                                                                                                                                                                   |
| `bubo_minha_estante_bubo_score`                                  | `(tabs)/estante`                                               | 🟡     | ADR-042: search bar to Descobrir, counter tiles as filters, "Lendo agora", 3-column cover grid with status marks/progress/rating, local filter + sort (incl. "Sua nota"). "Bubo Score" per book needs retention data → **Task 06**                                                                |
| `bubo_adicionar_livro_manualmente_mobile_1/_2`                   | `adicionar-livro`                                              | ✅     | ADR-042: search with compact rows and a "+" sheet (Quero ler/Lendo/Já li), quick actions Ler ISBN / Cadastrar à mão; manual form unchanged                                                                                                                                                        |
| `bubo_descobrir_livros_mobile`                                   | `descobrir`                                                    | 🟡     | ADR-031/042: compact search rows with "+" sheet, genre chips, cover-first carousels with "+" on the cover and the real reason; "Para você" prefetched from the Estante; owner: `CATALOG_CONTACT_EMAIL`, Google key, R2, device acceptance                                                         |
| `bubo_scanner_de_isbn_mobile`                                    | `scanner-isbn`                                                 | ✅     | `expo-camera` barcode scanning, manual ISBN fallback and catalog lookup                                                                                                                                                                                                                           |
| `bubo_detalhe_do_livro_caminho_de_mem_ria_2`                     | `livro/[id]`                                                   | 🟡     | ADR-036/042: blurred-cover hero with the 3D book, opens instantly from the shelf cache; status chips, progress card with sheet editor (+10/+25/+50/última), tabs Leitura (memory path, sessions) / Sobre (facts, catalog synopsis, club reviews) / Cards. Memory score/phases deferred            |
| `bubo_a_es_do_livro_bottom_sheets_mobile`                        | `livro/[id]` actions                                           | 🟡     | ADR-042: "⋮" sheet with story and "Remover da estante"; progress editor in a sheet                                                                                                                                                                                                                |
| Estante 3D (original Bubo composition; ADR-037)                  | `estante-3d` (Estante → shelves icon)                          | 🟡     | Cozy wooden bookcase from real entries: spines sized by page count, reading books face out, Bubo on top; tap pulls the book into a 3D spotlight with real details and "Abrir livro". Visualisation only; device acceptance pending                                                                |
| `bubo_hist_rico_de_ciclos_de_leitura_mobile_1/_2`                | `ciclos/[clubId]`                                              | ✅     | club history (ADR-021): Bubo historiador, real totals, year chips, current cycle (days left, group %), timeline, owner start/close. "Score médio"/"+pts" → "na meta" counts                                                                                                                       |
| **Reading session**                                              |                                                                |        |                                                                                                                                                                                                                                                                                                   |
| `bubo_sess_o_de_leitura_focada_1/_2`                             | `sessao/[id]`                                                  | ✅     | ADR-027/032: durable draft, optional return page/last real writing, five-minute goal without auto-finish, mandatory recall and confirmed orphan discard; code checked (495 tests); device acceptance pending.                                                                                     |
| `bubo_resultado_da_sess_o_essa_leitura_ficou`                    | `sessao/[id]` (result step)                                    | ✅     |                                                                                                                                                                                                                                                                                                   |
| `bubo_nova_reflex_o_toasts_mobile`                               | toasts in session/review                                       | ⬜     | small: a toast component in the design system                                                                                                                                                                                                                                                     |
| **Revisar**                                                      |                                                                |        |                                                                                                                                                                                                                                                                                                   |
| `bubo_revisar_hora_de_lembrar_2`                                 | `(tabs)/revisar`                                               | ✅     | due count, badge on the tab                                                                                                                                                                                                                                                                       |
| `bubo_active_recall_sem_espiar`                                  | `revisao`                                                      | ✅     | try → reveal → self-grade (SM-2)                                                                                                                                                                                                                                                                  |
| `bubo_revis_o_espa_ada_isso_ficou_com_voc_2`                     | `revisao` (summary)                                            | ✅     |                                                                                                                                                                                                                                                                                                   |
| `bubo_estat_sticas_curva_de_reten_o_mobile`                      | `estatisticas`                                                 | 🟡     | 7/30/90/365-day self-assessments, daily chart, focus, day parts and book links; observed delayed recall (ADR-030). Predicted curve/Score and device acceptance remain pending.                                                                                                                    |
| **Comunidade & clubs** (**Task 07–08**)                          |                                                                |        |                                                                                                                                                                                                                                                                                                   |
| `bubo_comunidade_liter_ria_mobile`                               | `(tabs)/comunidade`                                            | ✅     | Novidades / Meus clubes / Descobrir, club chips, new-item count, invite code box, "Amigos de leitura" header button                                                                                                                                                                               |
| `bubo_clubes_anti_spoiler_mobile`                                | `clubes/[id]`                                                  | ✅     | anti-spoiler enforced by the API (ADR-019): locked cards with page + "Quero espiar"                                                                                                                                                                                                               |
| `bubo_buscar_e_filtrar_clubes_de_leitura_mobile`                 | `(tabs)/comunidade` (Descobrir)                                | 🟡     | search by club or book, filters (na estante, meta, mais ativos), shelf-affinity count. Genre filters need book genres                                                                                                                                                                             |
| `bubo_perfil_do_clube_de_leitura_mobile_1/_2`                    | `clubes/[id]` (visitor, or ⋮ → Sobre)                          | ✅     | gradient hero, public/private pill, real stats, curator tip with my page, club book. No "Bubo Score"/"+XP" (no data)                                                                                                                                                                              |
| `bubo_criar_novo_clube_de_leitura_mobile`                        | `clubes/novo`                                                  | ✅     | name, proposal, icon, catalog book from shelf, weekly goal, public/private                                                                                                                                                                                                                        |
| `bubo_convidar_amigos_para_o_clube_mobile`                       | `convidar/[clubId]`                                            | ✅     | Task 08 (ADR-020): real QR, `bubo://convite/CODE` link + copy, WhatsApp/Telegram/e-mail/share, owner rotates the code. No friend suggestions (no social graph) nor "+XP"                                                                                                                          |
| — (no Stitch screen)                                             | `convite/[code]`                                               | ✅     | invite deep link → club profile preview → join by code (opens private clubs)                                                                                                                                                                                                                      |
| `bubo_clube_de_leitura_f_rum_enquetes_mobile`                    | `clubes/[id]` tabs + `debates/[clubId]/[postId]`               | ✅     | Debates & Fórum (typed topics, reactions) and Enquetes (vote inline) tabs                                                                                                                                                                                                                         |
| `bubo_criar_novo_t_pico_de_debate_anti_spoiler_mobile`           | `novo-debate/[clubId]`                                         | ✅     | title, type of discussion, chapter + page (stepper), quote, argument, shield preview                                                                                                                                                                                                              |
| `bubo_criar_nova_enquete_do_clube_mobile`                        | `nova-enquete/[clubId]`                                        | ✅     | question, 2–4 options, 3/7 days, single/multiple, lock page. No drafts, no "+XP"                                                                                                                                                                                                                  |
| `bubo_vota_o_e_resultados_ao_vivo_da_enquete_mobile`             | `enquetes/[clubId]/[pollId]`                                   | ✅     | live results (15 s polling), hidden until you vote, change vote, synthesis from real votes, arguments + reactions, composer                                                                                                                                                                       |
| `bubo_diretrizes_modera_o_do_clube_mobile`                       | `clubes/[id]` Diretrizes tab                                   | ✅     | 4 rules, my shield, owner as guardian, FAQ. Visitors see it before joining                                                                                                                                                                                                                        |
| `bubo_membros_estat_sticas_do_clube_mobile`                      | `clubes/[id]` Membros tab                                      | ✅     | real pages/levels, page distribution, club totals, search + filters. "Bubo Score"/"Retenção SRS" replaced by real counts                                                                                                                                                                          |
| `bubo_feed_de_atualiza_es_dos_clubes_mobile`                     | `(tabs)/comunidade` Novidades                                  | 🟡     | newest topics/polls of my clubs, locked per club. Member-activity items (joins, progress) not yet                                                                                                                                                                                                 |
| `bubo_feed_de_atividades_dos_amigos_mobile_1/_2`                 | `amigos`                                                       | ✅     | Atividade / Amigos / Privacidade, "Lendo agora" row, session cards, requests; opt-in sharing (ADR-021). No reactions on activity, no "Destaques"                                                                                                                                                  |
| `bubo_escrever_resenha_avalia_o_anti_spoiler_mobile`             | `nova-resenha/[clubId]`                                        | ✅     | stars + caption, up to 3 tags, title, text with word count, anti-spoiler point, shared in the club. No drafts, "+XP" or "Qualidade Bubo"                                                                                                                                                          |
| `bubo_detalhes_da_resenha_discuss_o_mobile_1/_2`                 | `resenhas/[clubId]/[postId]`                                   | ✅     | author + level + friend button, stars and tags, veil, replies composer (shared with debates). No bookmark/share                                                                                                                                                                                   |
| **Você**                                                         |                                                                |        |                                                                                                                                                                                                                                                                                                   |
| `bubo_perfil_do_leitor_mobile` / `…_voc`                         | `(tabs)/voce`                                                  | ✅     | Task 09: squircle avatar, level + XP to next, books read / Lembrei 30 dias / streak, recent badges, yearly goal, account rows, bell + gear. "Índice cognitivo"/Bubo Score need a retention model                                                                                                  |
| `bubo_mural_de_conquistas_mobile` / `…_n_veis_cognitivos_mobile` | `conquistas`                                                   | 🟡     | level + 13 badges recomputed from activity (ADR-018). Unlock dates, tiers, club/retention badges deferred                                                                                                                                                                                         |
| `bubo_configura_es_e_prefer_ncias_cognitivas_mobile`             | `configuracoes/*` (Você → Configurações)                       | ✅     | ADR-039 hub: `leitura` (rhythm, cards/day, focus, yearly goal), `notificacoes` (push state, reminder + hour, switches), `emails` (optional reading reminders, account e-mails), `aparelho` (theme, haptics), `seguranca` (login code, password, devices, delete), Sobre (legal, contact, version) |
| Conta e segurança / Termos / Privacidade (no Stitch screen)      | `configuracoes/seguranca`, `legal/termos`, `legal/privacidade` | ✅     | ADR-038/039: toggle the e-mailed login code with the password, change password (revokes other devices, e-mails a notice), sign out other devices, delete account; legal documents readable signed out and in                                                                                      |
| `bubo_notifica_es_e_alertas_cognitivos_mobile`                   | `notificacoes`                                                 | ✅     | inbox (Todas / Memória / Comunidade), live "Hora de revisar", grouped by day, mark read; push via Expo + hourly cron (ADR-022)                                                                                                                                                                    |
| `bubo_notifica_es_do_clube_convites_mobile`                      | `notificacoes` (Comunidade)                                    | ✅     | replies to my topics/reviews, friend requests (accept/decline inline), acceptances, new cycles; Guardião Bubo summary. Invites are codes, so there is no per-reader invitation                                                                                                                    |
| Bubo Replay (original Bubo composition; ADR-034)                 | `replay` (Você → Bubo Replay)                                  | ✅     | Monthly/yearly accepted-session chapters and complete books/authors/months report. Local code; verify green (541 tests); device/native acceptance pending.                                                                                                                                        |
| Book Story (original Bubo composition; ADR-034)                  | `story/[id]` (book → Compartilhar livro)                       | ✅     | Real title/author/cover/status, optional ephemeral rating; Papel/Noite/Violeta, 1080 × 1920 PNG. Native capture/sharing/saving and Instagram acceptance pending.                                                                                                                                  |
| **System**                                                       |                                                                |        |                                                                                                                                                                                                                                                                                                   |
| `bubo_splash_screen_animada_mobile`                              | native splash                                                  | 🟡     | native official symbol + JS loading tied to real boot; device acceptance pending                                                                                                                                                                                                                  |
| `bubo_design_system_component_library`                           | `dev/showcase`                                                 | ✅     | DEV only                                                                                                                                                                                                                                                                                          |
| `bubo_current_ui_audit`                                          | —                                                              | n/a    | reference notes                                                                                                                                                                                                                                                                                   |

## Visual polish — auth, onboarding and boot (2026-09-26)

Implemented native form entrance, one-shot official mascot greetings, animated option feedback,
onboarding progress and reduced-motion-aware navigation. Auth headers use the official logo;
recovery uses the confirmed `doubt` pose and `confident` after actual success. Existing layouts,
copy, auth contracts, deferred OAuth/legal controls and five tabs are preserved.

TextField now normalizes native padding and vertical alignment, provides a full-height editing
area, allows text to shrink horizontally beside icons, and keeps next-field keyboard focus.
Buttons wrap long labels instead of clipping them. Reset-password fields now follow Next → Go.

The native splash covers font loading; the JS screen covers actual session loading without
fake progress, minimum display duration or an animation gate. It unmounts immediately when boot
resolves, including error states. No official asset was modified.

Visual acceptance remains pending on an Android/iOS device: check small screens, keyboard and
autofill, 1.6× font scaling, dark theme, reduced motion, fast/slow/error boot and auth flows.
Static checks do not establish visual or authenticated end-to-end acceptance.

## Visual polish — memory review (2026-09-26)

`revisao` keeps its implemented status. Card entrance, note reveal, saved assessment feedback
and the next card/summary use the existing reduced-motion-aware `FadeIn` and mascot greeting.
There are no looping effects or timed advances: saved feedback stays readable until the reader
chooses “Próxima lembrança” or “Ver conclusão”. The header describes the real queue position.

The three requested labels use existing SM-2 values: Lembrei = 4, Quase = 3, Esqueci = 1.
The former separate “Fácil” (5) action is no longer offered; API grades and scheduling are unchanged.
Feedback combines text, icons and theme tokens (green, amber, lavender), with official
`confident`, `doubt` and `worried` poses. Save failures keep the card open and preserve its retry UUID.
No success feedback or advance is shown before the API confirms the save. Summary figures still
come from actual review responses. No assets, dependencies, Hoje or onboarding were changed.

Device acceptance remains pending: light/dark themes, reduced motion, VoiceOver/TalkBack,
large fonts and small screens, keyboard dismissal, failed/retried saves and the last-card summary.

## Catalog coverage and covers (2026-09-27)

Search/Estante usability update (2026-10-04, ADR-033): virtualized results and shelf, stable
Discover search input, bounded background cover metadata/ingestion, queued prefetch and stalled
image fallback. Adicionar/catalog detail/ISBN/manual preserve Quero ler/Lendo/Já li; multiple
books can be added without leaving results. Estante has counts/status filters, local title/author
search, ordering and row-level status actions. Saves show API-accepted state immediately.
This slice still needs visual/device acceptance and publication with the updated API/app.

Rating and grid update (2026-10-04, ADR-035): Estante is a 2-column grid (cover, title, author,
rating or reading progress); status actions moved into the book detail. Sorting is a pill with
icon + bottom sheet. Book detail is lean: large centered cover, title/author, tappable stars for
finished/rated books, progress, status chips, and history/cards only when they have content;
share moved to the header. A root popup asks for a 1–5 rating whenever a book becomes Já li
(status, add as Já li, or a session reaching the last page). Search placeholder shortened to
"Título ou autor". Migration `0016`; device acceptance pending.

Skoob-style update (2026-10-13, ADR-042): 3-column Estante grid with counter-tile filters and
"Lendo agora"; compact search rows with a "+" sheet; cover-first Descobrir carousels; shared
`BookHero` (blurred cover backdrop + 3D book + facts + expandable synopsis) on catalog and shelf
book pages; shelf book pages open instantly from the shelf cache and split into Leitura / Sobre /
Cards. Device acceptance pending.

Discover, add-book, first-book and scanner share the improved catalog service. Text search uses
Google Books/Open Library with bounded alternatives; Brazilian ISBN lookup also uses BrasilAPI.
Results preserve editions and identify languages, unknown edition data and approximate text
matches. ISBN lookup never silently substitutes another ISBN/format. Catalog shelf additions
allow different editions and same-titled books by different authors.

Opening a result or adding one book can ingest one provider cover through `MediaStorage`.
Discovery searches only reuse known cached covers. `MEDIA_PUBLIC_URL` and the existing `MEDIA`
binding enable ingestion; external and typographic fallbacks remain. See ADR-016 for limits.

Pending on Android/iOS: real scanner handoff, edition/language labels, large fonts, small screens,
assistive technology, failed/retried search, and real R2 public image delivery. Automated API/storage
fixtures and selected public provider reads do not establish device acceptance.

## Memory path and Minha memória (2026-09-27)

`livro/[id]` replaces the session/card counts with a timeline built by `buildMemoryPath`: reading
sessions (pages and focus minutes), graded reviews (Lembrei/Quase/Esqueci with the review-screen
colours and icons) and a final step for the next review. A due step is highlighted in
`primarySoft` with "Revisar agora"; a future step is muted with a lock and its date. The
Stitch "Índice cognitivo", "% Retido" and fixed five phases are not shown (ADR-017).

`estatisticas` now uses `FormScreen` (back, eyebrow + title) like the other pushed screens, the
Você stat tiles, a stacked daily chart with a legend and per-day accessibility labels, and
a footer "Ir para Revisar". Loading, error/retry and empty states are unchanged in meaning.

2026-09-30: periods 7/30/90/365, horizontal daily history, reading focus, local day parts,
current card inventory and per-book review counts with detail links are implemented.

2026-10-03 (ADR-030): Minha memória adds **Lembrei após um intervalo**, grouping actual elapsed
review delays into 1–6, 7–29 and 30+ days. Percentages include remembered/total counts. Empty
windows say **Sem revisões**; with no observations, the section is hidden. These are recorded
self-assessments, with no predicted retention curve or Bubo Score. The existing 🟡 screen status
and device acceptance pending are unchanged.

Pending on a device: timeline spacing on small screens, 1.6× fonts, dark theme, TalkBack/VoiceOver
reading order and the chart with a single very busy day.

## Achievements wall (2026-09-27)

`conquistas`, reached from Você → "Mural de conquistas", follows the Stitch mural with existing
components: `FormScreen` (eyebrow "Gamificação Bubo"), a level card with the official
`achievement` pose, `Chip` "Nível N", XP progress, three Você-style tiles and two-column badge
cards. Unlocked badges use the category colour (primary / gold / orange) and a "Conquistada" chip;
locked ones are dashed, muted, show a lock and real progress (`x / alvo`). With nothing unlocked
an honest note points to the Estante. Pending on a device: grid on narrow screens, 1.6× fonts,
dark theme and screen-reader labels.

## Comunidade — clubs and anti-spoiler debates (Task 07, 2026-09-27)

Routes are flat on purpose: Expo Router typed `clubes/[id]/index` as a static route without its
`[id]` param, so nested screens live in `debates/[clubId]/[postId]`, `novo-debate/[clubId]`,
`nova-enquete/[clubId]`, `enquetes/[clubId]/[pollId]`, `convidar/[clubId]` and `convite/[code]`.
Since Task 08 the guidelines are a tab of `clubes/[id]` (`diretrizes/[clubId]` was removed).
Blocked readers are managed in `bloqueados` (Você → Leitores bloqueados).

Visual language follows existing screens: `Screen` header for the tab (like Revisar), `FormScreen`
with eyebrow + title for pushed screens, `Card`, `Chip`, `SectionHeader`, official mascot poses
(`emptyCommunity`, `recallPrompt`, `profile`), primary-soft shield banner, gold dashed spoiler lock
(Stitch amber card). Reports use an inline panel, not an Alert (Android alerts cap at 3 buttons).

Pending on a device: long names and titles, keyboard with the reply composer in the footer,
1.6× fonts, dark theme, TalkBack/VoiceOver on locked cards and radio groups, modal presentation of
`clubes/novo` and `novo-debate/[clubId]`.

## Comunidade part 2 (Task 08 slice 1, 2026-09-28)

Rebuilt from the Stitch compositions (gradient club hero, segmented tabs, tab chips, icon stat
tiles, mascot speech bubbles, pills) with new design-system primitives instead of Card stacks.
Deviations, all for honest data (AGENTS rule 6): no "+XP" pills, no "Bubo Score"/"Retenção SRS",
no "LOTE" eyebrows (Stitch artefact), no friend suggestions, the poll "Síntese do Bubo" is computed
from real votes, and the invite link is `bubo://convite/CODE` (no web domain yet). The invite QR
is always dark on light (`qrPalette`) so scanners work in the dark theme.

Pending on a device: scanning the QR with the phone camera (build with the `bubo` scheme; Expo
Go uses `exp://`), WhatsApp/Telegram hand-off, clipboard, the poll composer with the keyboard,
15 s refresh while open, 1.6× fonts and dark theme on the new screens.

## Comunidade part 3 (Task 08 slice 2, 2026-09-30)

Reviews, friends, cycles and moderation follow the Stitch compositions with the existing
primitives (Raised cards, BuboTip, TabChip, SegmentedTabs, Pill, Stepper, Toggle) plus a feature
`StarRating` (48 pt radio stars). Honest deviations: no "+XP", no review drafts, no "Qualidade
Bubo", no reactions on friend activity, "Score médio" replaced by goal counts, and reviews are
shared only in the club (no public feed). `moderacao` has no Stitch screen and reuses the
Diretrizes language. All nine Comunidade routes are now registered inside the signed-in guard.

Pending on a device: star buttons with TalkBack/VoiceOver, the tag chips wrapping on small
screens, the "Lendo agora" row with long names, the cycle timeline with many cycles, 1.6× fonts and
the dark theme on every new screen.

## Você, preferences and notifications (Task 09, 2026-10-01)

Built from the Stitch compositions with `Raised` surfaces, `BuboTip`, `Pill`, `TabChip`,
`Toggle`, `Stepper` and two additions: `OptionTiles` (tactile option rows) and a real unread
`badge` on `HeaderButton`. Every value is real: level/XP from activity, "Lembrei" over the last
30 days, the yearly goal from the reader's own setting and finished books, unread counts from the
inbox. Honest deviations: no "Índice cognitivo"/Bubo Score, no "Alerta de curva crítica", no
soundscape or sepia palette, no export, no "+XP" in notifications.

Android: `FormScreen` now uses keyboard `padding` (edge-to-edge), notification channels
`lembretes` and `comunidade` with private lock-screen visibility, Android 13 permission asked
after the channels exist, and the official transparent foreground as the small icon.

Pending on a device: Android 13+ permission prompt, muting a channel, tapping a push from a cold
start, keyboard over composers on Android, theme persistence across restarts, 1.6× fonts and the
dark theme on Você, Preferências and Notificações.

## Native widgets (Task 09 extension, ADR-023 → ADR-026 → redesigned by ADR-029, 2026-10-03)

| Screen / system surface                                   | Route                      | Status | Notes / needs                                                                              |
| --------------------------------------------------------- | -------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| Widgets                                                   | `widgets` (Você → Widgets) | ✅     | Real-data previews of 5 widgets, mood timeline, preferences and installation instructions  |
| Liga semanal                                              | `liga`                     | ✅     | `/v1/me/league`; empty state without friends; opened by the league widget and by Amigos    |
| Android home: streak / week / calendar / reading / league | AppWidgetProvider          | 🟡     | Canvas + Plus Jakarta Sans; validated on an Android 15 emulator (states, links, e2e)       |
| iOS home: streak / week / calendar / reading / league     | WidgetKit                  | 🟡     | Same compositions in SwiftUI; Xcode compilation and device acceptance pending              |
| iOS lock (Sequência): circular / rectangular / inline     | WidgetKit                  | 🟡     | Streak + caption; title privacy on rectangular; rendering and VoiceOver acceptance pending |

Use the official poses and canonical theme/fonts; no new tab, fabricated activity or AI dependency.
See [widgets.md](widgets.md) and [TESTAR-TELAS.md](TESTAR-TELAS.md).

## Mandatory recall and push lifecycle (2026-10-03)

`sessao/[id]` now follows timer → closed-book recall → explicit check → server-confirmed result.
Idea, detail and connection/question autosave on the device. Edits invalidate a preview; a check
locks editing and consent before disk/network work. Old notes remain readable. Exact pending
requests keep their UUID; a failed local cleanup shows that the API save succeeded.

The writing checklist feedback describes exercise completion, never understanding or retention.
The optional Gemini question requires consent and does not affect acceptance. No new route/tab
or replacement artwork. Tests and research limits: [core-validation.md](core-validation.md).

Settings request push permission only after a deliberate activation. Returning from system
settings and rotating tokens refresh registration. Notification taps require the current account
and an exact allowed route. Provider setup and Android/iPhone acceptance remain pending; see
[notifications.md](notifications.md).

## Concise screens and observed recall (2026-10-03, ADR-030)

Hoje, Estante, Revisar, Comunidade, Você, Preferências, Widgets, the session and its result,
Minha memória, Notificações, the debate reply label, Nova resenha and Nova enquete now use shorter
copy. Hoje's final explanatory card is removed. Navigation labels are **Você → Preferências**,
**Você → Widgets** and **Revisar → Revisar**; Comunidade uses **Novidades / Meus clubes / Descobrir**.

Boas-vindas and sign-in also lose redundant paragraphs; the welcome pillars now say
**Leitura / Lembrar / Revisão**, without a promise of permanent retention.

The five tabs, real data, canonical assets and theme tokens are preserved. Action instructions,
Gemini consent, privacy, spoiler boundaries, errors and accessibility remain present. Screen
statuses above are unchanged: this copy cleanup and observed recall implementation do not replace
physical Android/iPhone acceptance or Swift compilation.

Local acceptance in this continuation: real sign-in, Home's removed footer, Você, Preferências,
five widget previews and empty 7/30/90/365-day memory views on the existing Android debug emulator
with current JS through Metro and the deployed API. No runtime error observed. The separately
generated ARM64/ARMv7 standalone APK was not installed on a physical device. Populated delayed
recall is covered by API/domain tests; large fonts, TalkBack and launcher widgets remain pending.

## Reading return and adaptive Hoje (2026-10-04, ADR-032)

Code implemented; `npm run verify` passed (495 tests). Hoje has one primary action with deterministic priority:
saved session, loading/error retry, offered reviews, five-minute return after seven local calendar
days without accepted reading, continuation after reading today, normal reading, then book choice.
No recency claim is made without a real `lastReadingDate`; empty review cards are omitted. The
current book, weekly activity and focus goal remain real-data context.

`sessao/[id]` adds an optional return step with the current page and latest real recall/reflection
available in the 20 recent sessions, with a three-line preview and expand/collapse action.
**Tentar lembrar** shows a fixed question answered mentally; **Começar agora** / **Pular e
começar** starts immediately. No answer is stored or sent to Gemini. The five-minute action uses
a normal session with a durable 300-second goal, a light acknowledgement and no automatic finish.
Existing drafts keep their own goal and pending UUID. A confirmed removed book offers local
discard; network errors preserve the draft and offer retry.

While optional history loads or has a retryable failure, a real entry in this account's cache can
start reading with honest loading/unavailable annotation copy. Authentication failures and a
confirmed missing book override cached data. Review priority retains the book as secondary
context; recovery points only to its draft's book. `readToday: true` prevents an absence claim
even when an old recency field conflicts.

The route and five tabs are unchanged. Source tests and the final quality gate do not establish
physical-device acceptance. The new flow still needs process/restart, offline, font-size and
TalkBack/VoiceOver acceptance; see [TESTAR-TELAS.md](TESTAR-TELAS.md).

## Replay and book Stories (2026-10-04, ADR-034)

`replay`, reached from Você, presents monthly/yearly accepted reading in manually advanced
chapters with brief `FadeIn` transitions and reduced motion. The complete report preserves all
books, available author labels and annual monthly evolution. Zero/partial periods remain honest;
manual **Já li** declarations do not become reading, and missing genres/quotations/Pontes are
omitted. Periods use session end instants in the requested IANA time zone.
Mandatory server `generatedAt` dates current-period art as `até DD/MM` and the visible update
timestamp; a stale snapshot is not relabelled as today. Replay is not persisted, refetches on
mount and shows offline when an initial request pauses without data. Tied highlights use
non-exclusive copy.

`story/[id]`, reached from the shelf book detail, previews Papel, Noite and Violeta compositions
with the actual title, author, cover and status. An optional 1–5 rating exists only in the current
artwork. The preview/current Replay chapter becomes a 1080 × 1920 PNG, with a small canonical
logo and content inside Story-safe margins. No private writing enters the image, no sixth tab
is added and no share publishes automatically.

`react-native-view-shot` captures the PNG; the local native `bubo-stories` module handles sharing, saving and Instagram handoff;
Expo Go explains its absence. Direct Instagram handoff needs the public Meta App ID, the
Instagram app and a new native build. `npm run verify` passed (541 tests, format/lint/types/assets/audit green).
Android prebuild, module Kotlin compilation, merged manifest and release JS bundle were checked
locally. A full debug APK was assembled and installed in the emulator; the emulator visual/export run
was interrupted and not completed (code re-reviewed and verify re-run on 2026-10-04). Physical-device acceptance, Swift compilation, actual image delivery, photos permissions, long book/author labels,
large fonts, TalkBack/VoiceOver and device visual acceptance remain pending. See
[replay.md](replay.md), [TESTAR-TELAS.md](TESTAR-TELAS.md) and [CONFIGURAR.md](../CONFIGURAR.md).

## Login codes, e-mail program, settings hub and legal documents (2026-10-12, ADR-038/039)

Sign-in on an untrusted device now has a second step, `(auth)/codigo`: six tactile cells
(`CodeField`), one-time-code autofill, "Lembrar este aparelho" on by default, resend after 60
seconds, and the honest explanation that the Bubo never asks for the code elsewhere. "Esqueci
minha senha" asks for the code and the new password on the same screen; the legacy link screen
stays for older e-mails. Sign-up shows the consent sentence with links to the legal documents.

Você → Configurações is a hub with one screen per concern (reading, phone notifications, e-mails,
device, account security, about) built on a shared `PreferencesForm` shell; Você itself lists
Suas leituras, Comunidade and Conta. Conta e segurança turns the e-mailed login code on or off
with the password, changes the password, signs out the other devices and leads to account
deletion. Termos de Uso and Política de Privacidade are rendered from structured content.

E-mails follow one Duolingo-inspired frame (see [emails.md](emails.md)); "Sentimos sua falta" is
the first optional e-mail, with consent in E-mails do Bubo and a one-click opt-out link.
`npm run verify` is green; migration `0017`, the API deploy, real inbox checks and Android/iPhone
acceptance of these screens are pending.

## Redesign 2.0, part 1: floating tab bar and new Hoje (2026-10-29, ADR-043)

The owner approved the Claude Design prototype "Bubo — Redesign 2.0" for implementation in parts.
Part 1 changes every tab screen and Hoje:

| Screen / element | Route / file                                      | Status | Notes                                                                                                                                                |
| ---------------- | ------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tab bar          | `(tabs)/_layout`, `features/shell/FloatingTabBar` | ✅     | Floating full-width pill: Hoje, Estante, "+", Revisar, Comunidade; real review badge; tab screens keep its height free                               |
| Quick actions    | `features/shell/QuickActionsSheet`                | ✅     | Continue, 5 minutes, add book, scan, search, review, update page — only actions that apply                                                           |
| Você             | `(tabs)/voce` via `ProfileButton`                 | ✅     | Avatar at the top of Hoje, Estante, Revisar and Comunidade (ADR-047)                                                                                 |
| Hoje             | `(tabs)/index`, `features/home/*`                 | ✅     | Book stage on the blurred cover, one primary button + "5 min", milestone, goal/streak/review tiles, ticket, "Pra você hoje", friends reading, Replay |

App font: Nunito. `npm run verify` is green; Android/iPhone acceptance and a new APK are pending.
The remaining parts (reading flow, Revisar, Estante/Livro, Descobrir and the algorithm,
Comunidade, Replay, living mascot) follow the same prototype.

## Redesign 2.0, part 2: reading flow (2026-10-29, ADR-044)

| Screen / element | Route / file                                 | Status | Notes                                                                                                                         |
| ---------------- | -------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Night timer      | `sessao/[id]`, `features/session/NightTimer` | ✅     | Book3D with a growing ribbon bookmark, one leaf per minute, "+N XP até agora", "Antes de voltar" while idle, page sheet       |
| Page sheet       | `features/session/PageSheet`                 | ✅     | − / +, typing, +5, +10 and the next quarter of the book; night tone from the timer, day tone from the recall card             |
| Recall card      | `sessao/[id]`, `features/session/RecallCard` | ✅     | Ideia/Detalhe/Conexão tabs, Caveat handwriting, "Guardado" stamp, "O Bubo confere", final server check then save              |
| Reading receipt  | `sessao/[id]`, `features/session/Receipt`    | ✅     | Printed receipt in IBM Plex Mono with API XP, streak and crossed milestone; text share; Gemini question when requested        |
| Dias seguidos    | `sequencia`, `features/session/StreakNight`  | ✅     | Streak, record, month calendar with runs and protected days, protections, milestones; from Hoje's tile and after a new streak |

`npm run verify` is green; Android/iPhone acceptance and a new APK (accent fonts) are pending.

## Redesign 2.0, part 3: Revisar (2026-10-29, ADR-045)

| Screen / element | Route / file                                   | Status | Notes                                                                                                       |
| ---------------- | ---------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| Revisar          | `(tabs)/revisar`, `features/recall/ReviewTab`  | ✅     | Fanned stack of today's cards with "até +X XP", stamp card with seal and renewal, month challenge, practice |
| Treinos          | `treino` (`modo=escaparam` / `modo=relampago`) | ✅     | Read-only decks from `GET /v1/recall/practice`; flip and count on the device; no XP or rescheduling         |
| Review summary   | `revisao`                                      | ✅     | Same review flow; the summary shows the daily stamp card                                                    |

`npm run verify` is green; the practice route is deployed (2026-10-29) and in the new APK; device acceptance pending.

## Redesign 2.0, part 4: Estante and book page (2026-10-29, ADR-046)

| Screen / element | Route / file                               | Status | Notes                                                                                                                               |
| ---------------- | ------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Estante          | `(tabs)/estante`, `features/shelf/Library` | ✅     | Tab header (ADR-047), full-width search, shelf circles with counts, Continuar lendo, collections, recents                           |
| Estante opening  | `features/shelf/ShelfOpening`              | ✅     | Corridor of the reader's books, official symbol, real counts; once a day                                                            |
| Prateleira       | `prateleira` (`filtro`, `ano`)             | ✅     | The previous grid: shelf and mark filters, local search, ordering                                                                   |
| Livro            | `livro/[id]`, `features/book/BookExtras`   | ✅     | Readers' rating, Leitores no Bubo, status with Relendo, marks, forecast, Sua nota + distribution, Resenhas tab, Quem leu também leu |

`npm run verify` is green; migration `0018` and the API are live (2026-10-29) and in the new APK; device acceptance pending.

## Audit: headers, tab bar and section titles (2026-10-29, ADR-047)

| Element        | Route / file                           | Status | Notes                                                                                       |
| -------------- | -------------------------------------- | ------ | ------------------------------------------------------------------------------------------- |
| Tab header     | `features/shell/TabHeader`             | ✅     | Estante, Revisar, Comunidade, Você: large title, optional context, ≤ 2 actions, avatar      |
| Stack header   | `design-system/FormScreen`             | ✅     | Every pushed/modal screen: back/close, left title, context line below, round 48 pt buttons  |
| Tab bar        | `features/shell/FloatingTabBar`        | ✅     | Icon + label on every tab, one soft-pill indicator, 72 pt                                   |
| Section titles | `design-system/SectionTitle`           | ✅     | One sentence-case heading with optional link/trailing; Hoje, Estante and Revisar use it too |
| Type scale     | `theme/typography` (`meta`, `labelSm`) | ✅     | 12 pt steps replace 74 ad-hoc overrides                                                     |
| Descobrir      | `descobrir`                            | ✅     | Uses the stack header                                                                       |

`npm run verify` is green; Android/iPhone visual acceptance and a new APK are pending.
