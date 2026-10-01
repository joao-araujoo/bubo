# ADR-021 — Comunidade part 3: book reviews, friends, club reading cycles and global moderation

- Status: Accepted
- Date: 2026-09-30

## Context

Task 08 slice 2 closes Comunidade with the remaining Stitch screens: "Avaliar & Resenhar", "Detalhes
da resenha", "Feed de atividades dos amigos" and "Histórico de ciclos de leitura". The owner also
needs a Bubo-wide moderation view for app-store review. ADR-019 and ADR-020 still apply:
anti-spoiler is enforced by the API, every kind of user content has report, block and author
delete, and no number is invented (AGENTS rule 6).

## Decision

- **Reviews reuse club topics (`0010_club_book_reviews`).** A review is a `reading_club_posts`
  row of kind `discussion` with `review_rating` (1–5), up to three distinct `review_tags`
  (`reflective`, `pacing`, `changedView`, `ending`, `worldbuilding`, `characters`) and a body of
  at least 30 characters (DB checks + Zod). They inherit membership, spoiler pages, replies,
  reactions, reports, blocks, author delete and owner/global moderation for free. A locked review
  sends no title, body, quote, rating or tags. `GET /v1/clubs/:id/posts?reviews=1` filters reviews
  before the limit. Reviews live in clubs because clubs read one catalog edition, so a spoiler page
  means the same for every reader; there is no public "Feed do Bubo" review yet (Stitch "Onde
  compartilhar" shows only the club). Drafts ("Rascunho") and "+XP" are not shown (no data).
- **Friends (`0012_reader_friendships`).** One row per unordered pair (`friendPairId`), mutual
  consent: a request is accepted only by the recipient; reciprocal requests never auto-accept.
  Requests are allowed only between members of a shared club, when the recipient allows requests
  (default on), with at most 200 relationships each. Blocking removes the friendship and stops new
  requests (same ordered row locks as `blockUser`). Turning requests off declines pending ones.
- **Sharing is opt-in and forward-only.** `share_activity` defaults to off. Turning it on sets
  `sharing_since`; friends see only sessions that started after both the friendship and
  `sharing_since`, and only for catalog books: book title, focus minutes, pages and the end page —
  never reflections, recall cards or manual books. `readingNow` shows each sharing friend's
  catalog book in progress (`status = reading`, latest update) with the real page and page count.
  Turning sharing off hides everything immediately; turning it on again starts a new window.
- **Club reading cycles (`0011_club_reading_cycles`).** The owner opens a cycle with a goal of
  pages per participant and 7/14/30/60/90 days; at most one open cycle per club (partial unique
  index). Participants are the members at the start (snapshot in
  `reading_club_cycle_members`), so late joiners neither inflate nor dilute the result. Progress is
  the sum of `end_page − start_page` of each participant's sessions on the club book inside the
  window. Expired cycles are closed when the next one starts; the owner can close early. Group
  progress, days left, weeks and the history summary are pure helpers in `@bubo/domain/cycles.ts`.
  The Stitch "Score médio" and "+pts" are replaced by "na meta" counts (no score model yet).
- **Global moderation.** `GET|POST /v1/me/moderation` is limited to user ids listed in the
  `MODERATOR_USER_IDS` Worker variable (exact ids, no e-mail or client flag). The queue holds only
  reported, not-removed content with counts and reasons; texts are returned only with an explicit
  `?reveal=1`. A decision requires an open report, sets the item visible or removed and resolves
  its reports. `GET /v1/me` exposes `isModerator` so the app shows the entry in Você. Logs carry ids
  and the action, never content.
- **Notifications** (club activity, invites inbox) stay in Task 09: they need push delivery and a
  read/unread model. Invites are codes, not per-user invitations, so there is nothing to put in an
  inbox yet.

## Consequences

- Book reviews work in every client that already reads topics; older clients render them as
  discussions (the rating and tags default to null/empty).
- Friend activity is visible only after deliberate consent from the sharer; the defaults leak
  nothing. Deleting an account cascades every friendship, preference and cycle membership.
- The mobile query cache key moved to `bubo.query-cache.v4` because posts gained `reviewTags`.
- The friends feed and moderation queue are never persisted to disk on the device.
