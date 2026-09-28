# ADR-017 — Memory views derived only from recorded activity

- Status: Accepted
- Date: 2026-09-27

## Context

Task 06 starts the memory and stats screens. The Stitch references
(`bubo_estat_sticas_curva_de_reten_o_mobile`, `bubo_detalhe_do_livro_caminho_de_mem_ria_2`) show
retention percentages, a "Bubo Score", five fixed memory phases and an Ebbinghaus curve. Bubo has
no validated retention model yet, and AGENTS.md forbids numbers that do not come from real
activity (ADR-014).

## Decision

- **Minha memória (`estatisticas`)** reads `GET /v1/me/memory?today=`: seven days of
  Lembrei/Quase/Esqueci counts grouped in Postgres from `review_logs`. The screen shows totals,
  days with reviews, the share of attempts graded "Lembrei" and a stacked daily chart. It says
  explicitly that these are self-assessments, not retention.
- **Caminho de memória (`livro/[id]`)** is built by `buildMemoryPath` in `@bubo/domain`
  (pure, tested) from the book's reading sessions, its graded reviews and its cards' due dates.
  Steps are real events in chronological order (last 8), followed by the next review: "hoje"
  with a "Revisar agora" action when cards are due, otherwise the earliest future date.
- `GET /v1/shelf/:id` gains `reviews`: the book's last 20 `review_logs` rows, owner-scoped via
  both `review_logs.user_id` and `recall_cards.user_id`. The contract defaults it to `[]`, so a
  newer app still parses an older API. No migration.
- The grade split (Lembrei ≥ 4, Quase = 3, Esqueci ≤ 2) is `reviewOutcome` in `@bubo/domain` and
  matches the SQL in `getMemoryStats`.

## Not done (deliberately)

- Retention curve, per-book retention percentage and the Bubo Score: need a documented model
  (for example FSRS-style stability from review history) and its own ADR before any number is
  shown.
- Fixed "Fase 1…5" labels from Stitch: they would imply a programme the reader did not follow.
- 30-day / quarter ranges: the endpoint is bounded to seven days; wider windows need an
  aggregated query with a bounded range parameter.

## Consequences

Every figure on both screens can be traced to rows the reader created. Visual acceptance on a
device (light/dark, large fonts, reduced motion, TalkBack/VoiceOver) is still required.
