# Stitch inventory

Source: `stitch_bubo_read_deeply/stitch_bubo_read_deeply/`. It has 64 screen folders (`code.html`,
usually a `screen.png`), a `DESIGN.md` and 22 image folders.

**Rules:**

- Stitch is a _visual reference_. Its HTML is never copied (ADR-008).
- "BUBO — Home / Hoje" (`bubo_home_hoje`) is the north star.
- Where Stitch disagrees with the brief, the brief wins:
  - The tab is called "Comunidade", not Stitch's "Clubes".
  - Brand tokens follow the brief.

**Legend:**

- **canonical**: the reference to follow for that screen.
- **variant**: an alternative export of the same screen (usually `_1`/`_2`, often HTML only).
- **desktop**: a wide or desktop layout. Reference for content only, since Bubo is native mobile.
- **board**: the PNG shows several states side by side, so it's wider than 390 px.

## 1. Home / Hoje

| folder                                     | png       | status                     | notes                                                                |
| ------------------------------------------ | --------- | -------------------------- | -------------------------------------------------------------------- |
| `bubo_home_hoje`                           | 390×844   | **canonical (north star)** | header → Lendo agora → Recuperação ativa → Semana cognitiva → Missão |
| `bubo_home_vis_o_cognitiva_desktop_1440px` | 1280×1065 | desktop                    | same content, desktop grid                                           |

## 2. Authentication

| folder                          | png       | status    | notes            |
| ------------------------------- | --------- | --------- | ---------------- |
| `bubo_login_autentica_o_mobile` | 390×844   | canonical | Task 02          |
| `bubo_login`                    | 1280×658  | desktop   |                  |
| `bubo_cadastro`                 | 1600×1280 | board     | sign-up, Task 02 |
| `bubo_esqueci_minha_senha`      | 1280×613  | desktop   | Task 02          |

## 3. Onboarding (Task 02)

| folder                           | png       | status    |
| -------------------------------- | --------- | --------- |
| `bubo_onboarding_boas_vindas`    | 1280×1024 | canonical |
| `bubo_onboarding_objetivo`       | 1280×1024 | canonical |
| `bubo_onboarding_interesses`     | 1280×1024 | canonical |
| `bubo_onboarding_h_bito`         | 1600×1280 | canonical |
| `bubo_onboarding_primeiro_livro` | 1280×1024 | canonical |
| `bubo_onboarding_conclu_do`      | 1280×1024 | canonical |

## 4. Estante & books

| folder                                         | png       | status              |
| ---------------------------------------------- | --------- | ------------------- |
| `bubo_minha_estante_bubo_score`                | 390×1396  | canonical           |
| `bubo_descobrir_livros_mobile`                 | 541×1600  | canonical (board)   |
| `bubo_scanner_de_isbn_mobile`                  | 1600×1280 | canonical (board)   |
| `bubo_adicionar_livro_manualmente_mobile_1`    | 1600×1280 | canonical (board)   |
| `bubo_adicionar_livro_manualmente_mobile_2`    | —         | variant (HTML only) |
| `bubo_detalhe_do_livro_caminho_de_mem_ria_2`   | 390×1561  | canonical           |
| `bubo_detalhe_do_livro_caminho_de_mem_ria_1`   | —         | variant (HTML only) |
| `bubo_a_es_do_livro_bottom_sheets_mobile`      | 1600×1340 | canonical (board)   |
| `bubo_hist_rico_de_ciclos_de_leitura_mobile_1` | 706×1600  | canonical (board)   |
| `bubo_hist_rico_de_ciclos_de_leitura_mobile_2` | —         | variant (HTML only) |

## 5. Reading session

| folder                                        | png      | status              |
| --------------------------------------------- | -------- | ------------------- |
| `bubo_sess_o_de_leitura_focada_1`             | 390×855  | canonical           |
| `bubo_sess_o_de_leitura_focada_2`             | —        | variant (HTML only) |
| `bubo_resultado_da_sess_o_essa_leitura_ficou` | 390×1311 | canonical           |
| `bubo_nova_reflex_o_toasts_mobile`            | 545×1600 | canonical (board)   |

## 6. Revisar / memory

| folder                                       | png       | status              |
| -------------------------------------------- | --------- | ------------------- |
| `bubo_revisar_hora_de_lembrar_2`             | 390×1330  | canonical (tab)     |
| `bubo_revisar_hora_de_lembrar_1`             | —         | variant (HTML only) |
| `bubo_active_recall_sem_espiar`              | 390×927   | canonical           |
| `bubo_revis_o_espa_ada_isso_ficou_com_voc_2` | 390×1196  | canonical           |
| `bubo_revis_o_espa_ada_isso_ficou_com_voc_1` | —         | variant (HTML only) |
| `bubo_estat_sticas_curva_de_reten_o_mobile`  | 1100×1600 | canonical (board)   |

## 7. Comunidade & clubs

| folder                                                 | png       | status              |
| ------------------------------------------------------ | --------- | ------------------- |
| `bubo_comunidade_liter_ria_mobile`                     | 390×953   | canonical (tab)     |
| `bubo_comunidade_liter_ria`                            | 1600×1280 | desktop             |
| `bubo_clubes_anti_spoiler_mobile`                      | 390×884   | canonical           |
| `bubo_clubes_de_leitura_anti_spoiler`                  | 1600×1280 | desktop             |
| `bubo_buscar_e_filtrar_clubes_de_leitura_mobile`       | 1149×1600 | canonical (board)   |
| `bubo_perfil_do_clube_de_leitura_mobile_1`             | 706×1600  | canonical (board)   |
| `bubo_perfil_do_clube_de_leitura_mobile_2`             | —         | variant (HTML only) |
| `bubo_clube_de_leitura_f_rum_enquetes_mobile`          | 1279×1600 | canonical (board)   |
| `bubo_criar_novo_clube_de_leitura_mobile`              | 1280×1359 | canonical (board)   |
| `bubo_convidar_amigos_para_o_clube_mobile`             | 1387×1600 | canonical (board)   |
| `bubo_criar_nova_enquete_do_clube_mobile`              | 1600×1498 | canonical (board)   |
| `bubo_vota_o_e_resultados_ao_vivo_da_enquete_mobile`   | 1444×1600 | canonical (board)   |
| `bubo_criar_novo_t_pico_de_debate_anti_spoiler_mobile` | 1528×1600 | canonical (board)   |
| `bubo_diretrizes_modera_o_do_clube_mobile`             | 1029×1600 | canonical (board)   |
| `bubo_membros_estat_sticas_do_clube_mobile`            | 1147×1600 | canonical (board)   |
| `bubo_feed_de_atualiza_es_dos_clubes_mobile`           | 1302×1600 | canonical (board)   |
| `bubo_feed_de_atividades_dos_amigos_mobile_2`          | 390×844   | canonical           |
| `bubo_feed_de_atividades_dos_amigos_mobile_1`          | —         | variant (HTML only) |
| `bubo_escrever_resenha_avalia_o_anti_spoiler_mobile`   | 1404×1600 | canonical (board)   |
| `bubo_detalhes_da_resenha_discuss_o_mobile_1`          | 390×844   | canonical           |
| `bubo_detalhes_da_resenha_discuss_o_mobile_2`          | —         | variant (HTML only) |

## 8. Você / profile & achievements

| folder                                              | png       | status            |
| --------------------------------------------------- | --------- | ----------------- |
| `bubo_perfil_do_leitor_mobile`                      | 390×900   | canonical (tab)   |
| `bubo_perfil_do_leitor_voc`                         | 1600×1280 | desktop           |
| `bubo_mural_de_conquistas_mobile`                   | 390×953   | canonical         |
| `bubo_mural_de_conquistas_n_veis_cognitivos_mobile` | 1160×1600 | canonical (board) |
| `bubo_mural_de_conquistas_n_veis`                   | 1600×1280 | desktop           |

## 9. Notifications & settings

| folder                                               | png       | status            |
| ---------------------------------------------------- | --------- | ----------------- |
| `bubo_notifica_es_e_alertas_cognitivos_mobile`       | 1505×1600 | canonical (board) |
| `bubo_notifica_es_do_clube_convites_mobile`          | 706×1600  | canonical (board) |
| `bubo_configura_es_e_prefer_ncias_cognitivas_mobile` | 412×1600  | canonical         |

## 10. System, splash & design system

| folder                                     | png       | status              | notes                                                          |
| ------------------------------------------ | --------- | ------------------- | -------------------------------------------------------------- |
| `tactile_cognitive_gamification/DESIGN.md` | —         | canonical tokens    | source of the component rules (pushdown, strokes, radii, type) |
| `bubo_design_system_component_library`     | 448×1600  | canonical reference | component sheet                                                |
| `bubo_splash_screen_animada_mobile`        | 706×1600  | canonical (board)   | native splash = official symbol on lavender                    |
| `bubo_splash_screen`                       | 1280×844  | desktop             |                                                                |
| `bubo_current_ui_audit`                    | 1280×1685 | reference           | UI audit notes, not a screen                                   |

## 11. Brand images inside Stitch (not canonical)

- `chatgpt_image_sep_24_2026_10_37_11_pm_*` / `10_42_3*` (22 folders): re-encoded copies of
  `Bubo - Assets/`. Same dimensions, different bytes. Use the official files instead.
- `chatgpt_image_sep_24_2026_10_14_19_pm_1`: early mascot renders.
- `chatgpt_image_sep_24_2026_10_14_19_pm_2`: the official brand board. Source of the pose names
  (see `docs/brand-assets.md`).

## Implemented in Task 01

- **Home / Hoje:** structure and order, as honest empty shells.
- **Tabs:** 5 of them.
- **Design-system primitives:** from `DESIGN.md`.
- **Everything else:** mapped to future tasks in `docs/roadmap.md`.
