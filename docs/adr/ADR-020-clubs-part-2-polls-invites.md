# ADR-020 — Clubs part 2: private clubs, invites, polls, reactions, members and the club feed

- Status: Accepted
- Date: 2026-09-28

## Context

Task 08 continues Comunidade from ADR-019. The owner's Stitch screens add private clubs with an
invite QR/link, a members & stats view, polls with live results and "argumentos em destaque",
typed debate topics with a quote, reaction pills ("Fez pensar", "Novo ponto", "Bom contraponto")
and a club feed. The same rules apply: anti-spoiler is enforced by the API, every new kind of
user-generated content ships with report, block and author delete, and no number is invented.

## Decision

- **Data (`0009_club_polls_invites`, additive only):**
  - `reading_club_posts` gains `kind` (discussion, philosophical, worldbuilding, character,
    question; existing rows = discussion), `chapter` and `quote`.
  - `reading_clubs` gains `visibility` (public/private; existing = public) and a unique
    `invite_code` (8 chars from an unambiguous alphabet, no 0/O/1/I/L).
  - New `reading_club_polls`, `reading_club_poll_options` (2–4), `reading_club_poll_votes`,
    `reading_club_poll_arguments` (one per reader and poll) and `reading_club_reactions`.
  - Reports now cover `poll` and `argument`. Names keep the `reading_club_` prefix because the
    shared Neon database has unrelated legacy `club_polls`/`club_poll_votes` tables.
- **Private clubs** never appear in discover and answer 404 to outsiders (their existence is not
  leaked). They are reached only through `GET /v1/clubs/invite/:code` (preview) and
  `POST /v1/clubs/join` (which also requires `acceptGuidelines: true`).
- **Invites:** every member gets the club's code (assigned lazily for Task 07 clubs). Only the
  owner can replace it (`POST /v1/clubs/:id/invite-code`); the old code stops working at once. The
  app shares `Linking.createURL('convite/CODE')` — `bubo://convite/CODE` in builds, `exp://…` in
  Expo Go — as a real QR (`qrcode-generator`, pure JS) plus the typed code. HTTPS universal links
  need a domain the project does not have yet (owner decision).
- **Polls:** 2–4 distinct options, single or multiple choice, open 3 or 7 days, with a
  `spoiler_page` like topics (locked polls send no question or labels). Voting replaces the
  reader's vote while open (409 after closing). **Results are hidden until the reader votes**, the
  poll closes or they are its author (`canSeePollResults`), so nobody follows the crowd.
  Percentages use largest remainder so they always add up to 100 (`pollPercentages`). The screen
  refetches every 15 s while open ("ao vivo" is polling; Durable Objects only if it proves needed).
- **Arguments:** one per reader and poll, written after voting, editable; they follow the poll's
  lock and show what the author voted for. The "Síntese do Bubo" is computed from the real votes
  in the app — no AI text.
- **Reactions:** three kinds, toggled idempotently on topics and arguments; counts come from the
  table. Only members react, never to their own content (422; the app shows counts only there).
- **Members:** `GET /v1/clubs/:id/members` (members only) lists each member's page on the club
  book from their own shelf, level from real XP, the page distribution in four equal ranges
  (`pageBuckets`) and club totals (pages read, discussions, poll votes). Stitch "Bubo Score" and
  "Retenção SRS" are not shown: there is no documented model yet (Task 06).
- **Feed:** `GET /v1/community/feed` returns the 30 newest topics and polls across the reader's
  clubs, each locked by that club's own page, plus how many are from the last 24 h.
- **Limits:** 50 polls, 100 arguments, 200 members and 30 feed items per request (no pagination
  yet); writes share the 30/min limit from ADR-019.
- **Moderation** reuses ADR-019 unchanged for polls and arguments (report → hidden for reporter,
  3 reports → hidden for all, owner remove/restore, author delete, block).

Also in this slice (Task 06 follow-up, no migration): `GET /v1/me/memory` accepts `days`
(7/30/90/365) and `tz` (device UTC offset in minutes) and adds per-book tallies, attempts by local
time of day, card totals and focus minutes. They are counts of the reader's own grades, never
retention estimates. `GET /v1/shelf/:id` adds `reviewTotals`; badges get a fixed medal tier.

## Not done (next Task 08 slices)

- Reviews (resenhas) with a spoiler flag, friends/follows and the friends' feed, club reading
  cycles ("Histórico de ciclos"), club notifications and invites inbox (needs push, Task 09),
  Bubo-wide admin moderation tooling.
- Invite suggestions from friends ("Amigos do seu círculo") — no social graph yet.
- The `estatisticas` screen still shows the 7-day view; the new breakdowns are API-only so far.
- A signed-out reader who opens an invite link lands on sign-in and must open the link again.

## Consequences

Existing clubs and topics keep working unchanged. Private clubs are only as private as their code:
owners rotate it if it leaks. Result hiding means a reader's first view of a poll never shows the
current split.
