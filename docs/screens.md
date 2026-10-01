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

| Stitch screen                                                    | Route                                            | Status | Notes / needs                                                                                                                                                               |
| ---------------------------------------------------------------- | ------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Home / Hoje**                                                  |                                                  |        |                                                                                                                                                                             |
| `bubo_home_hoje` (north star)                                    | `(tabs)/index`                                   | ✅     | header streak/XP, Lendo agora, Recuperação ativa, semana cognitiva, missão                                                                                                  |
| `bubo_home_vis_o_cognitiva_desktop_1440px`                       | —                                                | n/a    | desktop; content covered by Hoje                                                                                                                                            |
| **Auth**                                                         |                                                  |        |                                                                                                                                                                             |
| `bubo_login_autentica_o_mobile` / `bubo_login`                   | `(auth)/entrar`                                  | 🟡     | Google sign-in deferred (OAuth client ids + Apple Sign-In required together on iOS)                                                                                         |
| `bubo_cadastro`                                                  | `(auth)/cadastro`                                | 🟡     | terms/privacy checkbox deferred until the legal docs exist                                                                                                                  |
| `bubo_esqueci_minha_senha`                                       | `(auth)/esqueci-senha` + `redefinir-senha`       | ✅     | Resend in production                                                                                                                                                        |
| **Onboarding**                                                   |                                                  |        |                                                                                                                                                                             |
| `bubo_onboarding_boas_vindas`                                    | `(auth)/boas-vindas`                             | ✅     | 1/6                                                                                                                                                                         |
| `bubo_onboarding_h_bito`                                         | `onboarding/index`                               | ✅     | 2/6                                                                                                                                                                         |
| `bubo_onboarding_objetivo`                                       | `onboarding/objetivo`                            | ✅     | 3/6                                                                                                                                                                         |
| `bubo_onboarding_interesses`                                     | `onboarding/interesses`                          | ✅     | 4/6                                                                                                                                                                         |
| `bubo_onboarding_primeiro_livro`                                 | `onboarding/primeiro-livro`                      | ✅     | catalog search, ISBN and manual entry                                                                                                                                       |
| `bubo_onboarding_conclu_do`                                      | `onboarding/concluido`                           | ✅     | "+20 XP" not promised                                                                                                                                                       |
| **Estante & books**                                              |                                                  |        |                                                                                                                                                                             |
| `bubo_minha_estante_bubo_score`                                  | `(tabs)/estante`                                 | 🟡     | "Bubo Score" per book needs retention data → **Task 06**                                                                                                                    |
| `bubo_adicionar_livro_manualmente_mobile_1/_2`                   | `adicionar-livro`                                | ✅     |                                                                                                                                                                             |
| `bubo_descobrir_livros_mobile`                                   | `descobrir`                                      | 🟡     | edition-aware search done; owner items: Google key, R2 `MEDIA_PUBLIC_URL`, device acceptance                                                                                |
| `bubo_scanner_de_isbn_mobile`                                    | `scanner-isbn`                                   | ✅     | `expo-camera` barcode scanning, manual ISBN fallback and catalog lookup                                                                                                     |
| `bubo_detalhe_do_livro_caminho_de_mem_ria_2`                     | `livro/[id]`                                     | 🟡     | status, progress, sessions, cards and a real "Caminho de memória" timeline (ADR-017). Memory score/phases deferred                                                          |
| `bubo_a_es_do_livro_bottom_sheets_mobile`                        | `livro/[id]` actions                             | 🟡     | actions exist inline; bottom-sheet presentation is a polish item                                                                                                            |
| `bubo_hist_rico_de_ciclos_de_leitura_mobile_1/_2`                | `ciclos/[clubId]`                                | ✅     | club history (ADR-021): Bubo historiador, real totals, year chips, current cycle (days left, group %), timeline, owner start/close. "Score médio"/"+pts" → "na meta" counts |
| **Reading session**                                              |                                                  |        |                                                                                                                                                                             |
| `bubo_sess_o_de_leitura_focada_1/_2`                             | `sessao/[id]`                                    | ✅     | restoring a timer after the OS kills the app is deferred                                                                                                                    |
| `bubo_resultado_da_sess_o_essa_leitura_ficou`                    | `sessao/[id]` (result step)                      | ✅     |                                                                                                                                                                             |
| `bubo_nova_reflex_o_toasts_mobile`                               | toasts in session/review                         | ⬜     | small: a toast component in the design system                                                                                                                               |
| **Revisar**                                                      |                                                  |        |                                                                                                                                                                             |
| `bubo_revisar_hora_de_lembrar_2`                                 | `(tabs)/revisar`                                 | ✅     | due count, badge on the tab                                                                                                                                                 |
| `bubo_active_recall_sem_espiar`                                  | `revisao`                                        | ✅     | try → reveal → self-grade (SM-2)                                                                                                                                            |
| `bubo_revis_o_espa_ada_isso_ficou_com_voc_2`                     | `revisao` (summary)                              | ✅     |                                                                                                                                                                             |
| `bubo_estat_sticas_curva_de_reten_o_mobile`                      | `estatisticas`                                   | 🟡     | 7/30/90/365-day self-assessments, daily chart, focus, day parts and book links. Retention curve/Score need a model (ADR-017); device acceptance pending.                    |
| **Comunidade & clubs** (**Task 07–08**)                          |                                                  |        |                                                                                                                                                                             |
| `bubo_comunidade_liter_ria_mobile`                               | `(tabs)/comunidade`                              | ✅     | Feed Geral / Seus Clubes / Descobrir, club chips, "Radar dos clubes", invite code box, "Amigos de leitura" header button                                                    |
| `bubo_clubes_anti_spoiler_mobile`                                | `clubes/[id]`                                    | ✅     | anti-spoiler enforced by the API (ADR-019): locked cards with page + "Quero espiar"                                                                                         |
| `bubo_buscar_e_filtrar_clubes_de_leitura_mobile`                 | `(tabs)/comunidade` (Descobrir)                  | 🟡     | search by club or book, filters (na estante, meta, mais ativos), affinity tip. Genre filters need book genres                                                               |
| `bubo_perfil_do_clube_de_leitura_mobile_1/_2`                    | `clubes/[id]` (visitor, or ⋮ → Sobre)            | ✅     | gradient hero, public/private pill, real stats, curator tip with my page, club book. No "Bubo Score"/"+XP" (no data)                                                        |
| `bubo_criar_novo_clube_de_leitura_mobile`                        | `clubes/novo`                                    | ✅     | name, proposal, icon, catalog book from shelf, weekly goal, public/private                                                                                                  |
| `bubo_convidar_amigos_para_o_clube_mobile`                       | `convidar/[clubId]`                              | ✅     | Task 08 (ADR-020): real QR, `bubo://convite/CODE` link + copy, WhatsApp/Telegram/e-mail/share, owner rotates the code. No friend suggestions (no social graph) nor "+XP"    |
| — (no Stitch screen)                                             | `convite/[code]`                                 | ✅     | invite deep link → club profile preview → join by code (opens private clubs)                                                                                                |
| `bubo_clube_de_leitura_f_rum_enquetes_mobile`                    | `clubes/[id]` tabs + `debates/[clubId]/[postId]` | ✅     | Debates & Fórum (typed topics, reactions) and Enquetes (vote inline) tabs                                                                                                   |
| `bubo_criar_novo_t_pico_de_debate_anti_spoiler_mobile`           | `novo-debate/[clubId]`                           | ✅     | title, type of discussion, chapter + page (stepper), quote, argument, shield preview                                                                                        |
| `bubo_criar_nova_enquete_do_clube_mobile`                        | `nova-enquete/[clubId]`                          | ✅     | question, 2–4 options, 3/7 days, single/multiple, lock page. No drafts, no "+XP"                                                                                            |
| `bubo_vota_o_e_resultados_ao_vivo_da_enquete_mobile`             | `enquetes/[clubId]/[pollId]`                     | ✅     | live results (15 s polling), hidden until you vote, change vote, synthesis from real votes, arguments + reactions, composer                                                 |
| `bubo_diretrizes_modera_o_do_clube_mobile`                       | `clubes/[id]` Diretrizes tab                     | ✅     | 4 rules, my shield, owner as guardian, FAQ. Visitors see it before joining                                                                                                  |
| `bubo_membros_estat_sticas_do_clube_mobile`                      | `clubes/[id]` Membros tab                        | ✅     | real pages/levels, page distribution, club totals, search + filters. "Bubo Score"/"Retenção SRS" replaced by real counts                                                    |
| `bubo_feed_de_atualiza_es_dos_clubes_mobile`                     | `(tabs)/comunidade` Feed Geral                   | 🟡     | newest topics/polls of my clubs, locked per club. Member-activity items (joins, progress) not yet                                                                           |
| `bubo_feed_de_atividades_dos_amigos_mobile_1/_2`                 | `amigos`                                         | ✅     | Atividade / Amigos / Privacidade, "Lendo agora" row, session cards, requests; opt-in sharing (ADR-021). No reactions on activity, no "Destaques"                            |
| `bubo_escrever_resenha_avalia_o_anti_spoiler_mobile`             | `nova-resenha/[clubId]`                          | ✅     | stars + caption, up to 3 tags, title, text with word count, anti-spoiler point, shared in the club. No drafts, "+XP" or "Qualidade Bubo"                                    |
| `bubo_detalhes_da_resenha_discuss_o_mobile_1/_2`                 | `resenhas/[clubId]/[postId]`                     | ✅     | author + level + friend button, stars and tags, veil, replies composer (shared with debates). No bookmark/share                                                             |
| **Você**                                                         |                                                  |        |                                                                                                                                                                             |
| `bubo_perfil_do_leitor_mobile` / `…_voc`                         | `(tabs)/voce`                                    | 🟡     | Profile, appearance, sign-out/account deletion and Minha memória entry. Stats device acceptance pending.                                                                    |
| `bubo_mural_de_conquistas_mobile` / `…_n_veis_cognitivos_mobile` | `conquistas`                                     | 🟡     | level + 13 badges recomputed from activity (ADR-018). Unlock dates, tiers, club/retention badges deferred                                                                   |
| `bubo_configura_es_e_prefer_ncias_cognitivas_mobile`             | `configuracoes`                                  | ⬜     | persist theme + session length + reminders (`expo-notifications`)                                                                                                           |
| `bubo_notifica_es_e_alertas_cognitivos_mobile`                   | `notificacoes`                                   | ⬜     | push via Expo Push API from the Worker (cron trigger for due reviews)                                                                                                       |
| `bubo_notifica_es_do_clube_convites_mobile`                      | `notificacoes` (clubs tab)                       | ⬜     | Task 09: needs push + read state (ADR-021)                                                                                                                                  |
| **System**                                                       |                                                  |        |                                                                                                                                                                             |
| `bubo_splash_screen_animada_mobile`                              | native splash                                    | 🟡     | native official symbol + JS loading tied to real boot; device acceptance pending                                                                                            |
| `bubo_design_system_component_library`                           | `dev/showcase`                                   | ✅     | DEV only                                                                                                                                                                    |
| `bubo_current_ui_audit`                                          | —                                                | n/a    | reference notes                                                                                                                                                             |

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
Retention/Score still need a model; device acceptance remains pending.

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
