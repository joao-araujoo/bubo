# ADR-018 — Achievements and cognitive levels computed on read

- Status: Accepted
- Date: 2026-09-27

## Context

Stitch `bubo_mural_de_conquistas_mobile` / `…_n_veis_cognitivos_mobile` show a level ("Nível 14 ·
Guardião da Memória"), XP to the next level and badge cards (unlocked, locked with progress).
Some Stitch badges depend on data Bubo does not have (retention %, clubs, night-time reviews,
spoiler veils). AGENTS.md forbids showing numbers that do not come from real activity.

## Decision

- `GET /v1/me/achievements?today=` (session, owner-scoped) recomputes everything on each read
  from `reading_sessions`, `review_logs` and `shelf_entries`. **No table, no migration, nothing
  granted manually.** Removing data can remove a badge; the wall always matches the data.
- The catalogue (`ACHIEVEMENTS` in `@bubo/domain`, stable ids) has 13 badges in three groups:
  - Leitura & foco: 1 and 10 sessions, 600 focused minutes, 1.000 pages, 1 and 5 books finished.
  - Memória & recall: first review, 10 × "Lembrei", 50 reviews, 5 written reflections.
  - Constância: longest streak of 3, 14 and 100 days (session or review days; 400-day window,
    same as `/me/stats`).
- Levels (`COGNITIVE_LEVELS` / `levelForXp` in `@bubo/scoring`) map total XP (ADR-014) to
  8 titled levels (0, 100, 300, 600, 1000, 1600, 2400, 3500 XP). A level summarises effort; it
  is not a memory score.
- Mobile `conquistas` (Você → "Mural de conquistas"): level card with progress to the next level,
  three tiles (conquistas, current and longest streak), badges grouped by category.

## Not done (deliberately)

- Unlock dates ("Desbloqueada ontem"), XP rewards per badge and bronze/silver/gold tiers: need a
  persisted unlock ledger and a product decision on whether badges grant XP.
- Retention, club, night-review and anti-spoiler badges: their source data does not exist yet.
- Sharing the wall with friends: needs Comunidade (Tasks 07–08).

## Consequences

Changing a target or adding a badge is a code change in one pure, tested module. Heavy readers
cost a handful of aggregate queries per wall visit; if that grows, cache per user/day.
