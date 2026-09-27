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

| Stitch screen                                                    | Route                                      | Status | Notes / needs                                                                              |
| ---------------------------------------------------------------- | ------------------------------------------ | ------ | ------------------------------------------------------------------------------------------ |
| **Home / Hoje**                                                  |                                            |        |                                                                                            |
| `bubo_home_hoje` (north star)                                    | `(tabs)/index`                             | ✅     | header streak/XP, Lendo agora, Recuperação ativa, semana cognitiva, missão                 |
| `bubo_home_vis_o_cognitiva_desktop_1440px`                       | —                                          | n/a    | desktop; content covered by Hoje                                                           |
| **Auth**                                                         |                                            |        |                                                                                            |
| `bubo_login_autentica_o_mobile` / `bubo_login`                   | `(auth)/entrar`                            | 🟡     | Google sign-in deferred (OAuth client ids + Apple Sign-In required together on iOS)        |
| `bubo_cadastro`                                                  | `(auth)/cadastro`                          | 🟡     | terms/privacy checkbox deferred until the legal docs exist                                 |
| `bubo_esqueci_minha_senha`                                       | `(auth)/esqueci-senha` + `redefinir-senha` | ✅     | Resend in production                                                                       |
| **Onboarding**                                                   |                                            |        |                                                                                            |
| `bubo_onboarding_boas_vindas`                                    | `(auth)/boas-vindas`                       | ✅     | 1/6                                                                                        |
| `bubo_onboarding_h_bito`                                         | `onboarding/index`                         | ✅     | 2/6                                                                                        |
| `bubo_onboarding_objetivo`                                       | `onboarding/objetivo`                      | ✅     | 3/6                                                                                        |
| `bubo_onboarding_interesses`                                     | `onboarding/interesses`                    | ✅     | 4/6                                                                                        |
| `bubo_onboarding_primeiro_livro`                                 | `onboarding/primeiro-livro`                | ✅     | catalog search, ISBN and manual entry                                                      |
| `bubo_onboarding_conclu_do`                                      | `onboarding/concluido`                     | ✅     | "+20 XP" not promised                                                                      |
| **Estante & books**                                              |                                            |        |                                                                                            |
| `bubo_minha_estante_bubo_score`                                  | `(tabs)/estante`                           | 🟡     | "Bubo Score" per book needs retention data → **Task 06**                                   |
| `bubo_adicionar_livro_manualmente_mobile_1/_2`                   | `adicionar-livro`                          | ✅     |                                                                                            |
| `bubo_descobrir_livros_mobile`                                   | `descobrir`                                | 🟡     | catalog API and search done; provider covers are external until R2 ingestion               |
| `bubo_scanner_de_isbn_mobile`                                    | `scanner-isbn`                             | ✅     | `expo-camera` barcode scanning, manual ISBN fallback and catalog lookup                    |
| `bubo_detalhe_do_livro_caminho_de_mem_ria_2`                     | `livro/[id]`                               | 🟡     | status, progress, sessions and cards done. "Caminho de memória" timeline → **Task 06**     |
| `bubo_a_es_do_livro_bottom_sheets_mobile`                        | `livro/[id]` actions                       | 🟡     | actions exist inline; bottom-sheet presentation is a polish item                           |
| `bubo_hist_rico_de_ciclos_de_leitura_mobile_1/_2`                | `livro/[id]/ciclos`                        | ⬜     | **Task 06**: re-reads ("ciclos") need a `reading_cycles` table                             |
| **Reading session**                                              |                                            |        |                                                                                            |
| `bubo_sess_o_de_leitura_focada_1/_2`                             | `sessao/[id]`                              | ✅     | restoring a timer after the OS kills the app is deferred                                   |
| `bubo_resultado_da_sess_o_essa_leitura_ficou`                    | `sessao/[id]` (result step)                | ✅     |                                                                                            |
| `bubo_nova_reflex_o_toasts_mobile`                               | toasts in session/review                   | ⬜     | small: a toast component in the design system                                              |
| **Revisar**                                                      |                                            |        |                                                                                            |
| `bubo_revisar_hora_de_lembrar_2`                                 | `(tabs)/revisar`                           | ✅     | due count, badge on the tab                                                                |
| `bubo_active_recall_sem_espiar`                                  | `revisao`                                  | ✅     | try → reveal → self-grade (SM-2)                                                           |
| `bubo_revis_o_espa_ada_isso_ficou_com_voc_2`                     | `revisao` (summary)                        | ✅     |                                                                                            |
| `bubo_estat_sticas_curva_de_reten_o_mobile`                      | `estatisticas`                             | ⬜     | **Task 06**: retention curve from `review_logs` + `estimateRetention` (`@bubo/scoring`)    |
| **Comunidade & clubs** (**Task 07–08**)                          |                                            |        |                                                                                            |
| `bubo_comunidade_liter_ria_mobile`                               | `(tabs)/comunidade`                        | ⬜     | clubs, members, posts tables; moderation first                                             |
| `bubo_clubes_anti_spoiler_mobile`                                | `clubes`                                   | ⬜     | anti-spoiler = each post has a page/chapter; hide posts beyond the reader's `current_page` |
| `bubo_buscar_e_filtrar_clubes_de_leitura_mobile`                 | `clubes/buscar`                            | ⬜     | search + filters by book/genre (`GENRES`)                                                  |
| `bubo_perfil_do_clube_de_leitura_mobile_1/_2`                    | `clubes/[id]`                              | ⬜     |                                                                                            |
| `bubo_criar_novo_clube_de_leitura_mobile`                        | `clubes/novo`                              | ⬜     |                                                                                            |
| `bubo_convidar_amigos_para_o_clube_mobile`                       | `clubes/[id]/convidar`                     | ⬜     | invite links (deep link `bubo://`)                                                         |
| `bubo_clube_de_leitura_f_rum_enquetes_mobile`                    | `clubes/[id]/forum`                        | ⬜     |                                                                                            |
| `bubo_criar_novo_t_pico_de_debate_anti_spoiler_mobile`           | `clubes/[id]/novo-topico`                  | ⬜     | spoiler threshold per topic                                                                |
| `bubo_criar_nova_enquete_do_clube_mobile`                        | `clubes/[id]/nova-enquete`                 | ⬜     |                                                                                            |
| `bubo_vota_o_e_resultados_ao_vivo_da_enquete_mobile`             | `clubes/[id]/enquete/[pollId]`             | ⬜     | "ao vivo" = polling first. Durable Objects/WebSocket later                                 |
| `bubo_diretrizes_modera_o_do_clube_mobile`                       | `clubes/[id]/diretrizes`                   | ⬜     | reports + moderation actions (App Store UGC requirement)                                   |
| `bubo_membros_estat_sticas_do_clube_mobile`                      | `clubes/[id]/membros`                      | ⬜     |                                                                                            |
| `bubo_feed_de_atualiza_es_dos_clubes_mobile`                     | `comunidade/feed`                          | ⬜     |                                                                                            |
| `bubo_feed_de_atividades_dos_amigos_mobile_2`                    | `comunidade/amigos`                        | ⬜     | follows table; privacy settings                                                            |
| `bubo_escrever_resenha_avalia_o_anti_spoiler_mobile`             | `livro/[id]/resenha`                       | ⬜     | reviews with spoiler flag                                                                  |
| `bubo_detalhes_da_resenha_discuss_o_mobile_1/_2`                 | `resenhas/[id]`                            | ⬜     |                                                                                            |
| **Você**                                                         |                                            |        |                                                                                            |
| `bubo_perfil_do_leitor_mobile` / `…_voc`                         | `(tabs)/voce`                              | 🟡     | profile, appearance, sign-out and account deletion done. Stats → **Task 06**               |
| `bubo_mural_de_conquistas_mobile` / `…_n_veis_cognitivos_mobile` | `conquistas`                               | ⬜     | **Task 06**: achievements derived from sessions/reviews (never granted manually)           |
| `bubo_configura_es_e_prefer_ncias_cognitivas_mobile`             | `configuracoes`                            | ⬜     | persist theme + session length + reminders (`expo-notifications`)                          |
| `bubo_notifica_es_e_alertas_cognitivos_mobile`                   | `notificacoes`                             | ⬜     | push via Expo Push API from the Worker (cron trigger for due reviews)                      |
| `bubo_notifica_es_do_clube_convites_mobile`                      | `notificacoes` (clubs tab)                 | ⬜     | after Comunidade                                                                           |
| **System**                                                       |                                            |        |                                                                                            |
| `bubo_splash_screen_animada_mobile`                              | native splash                              | 🟡     | native official symbol + JS loading tied to real boot; device acceptance pending           |
| `bubo_design_system_component_library`                           | `dev/showcase`                             | ✅     | DEV only                                                                                   |
| `bubo_current_ui_audit`                                          | —                                          | n/a    | reference notes                                                                            |

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
