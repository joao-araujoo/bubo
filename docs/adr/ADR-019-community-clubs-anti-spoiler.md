# ADR-019 — Reading clubs with server-enforced anti-spoiler and basic UGC moderation

- Status: Accepted
- Date: 2026-09-27

## Context

Task 07 opens Comunidade. Stitch shows clubs around one book, debates "per chapter", locked
cards ("Contém spoiler da página 320 — Quero espiar mesmo assim"), creation forms, guidelines and
moderators. Stores require user-generated content to ship with reporting, blocking and a way to
act on reports (Apple 1.2, Google UGC policy). Nothing may invent numbers (AGENTS.md).

## Decision

- **Data (0008_community):** `clubs` (one shared **catalog** book, restrict delete), `club_members`
  (owner/member), `club_posts` and `club_replies` (each with `spoiler_page` and a moderation
  `status`), `content_reports` (one per reader and item), `user_blocks`.
- **Why catalog books only:** members must shelve the very same edition so page numbers mean the
  same thing for everybody. Manual books belong to one reader and can be deleted with the entry.
- **Anti-spoiler is enforced by the API.** The reader's page is their own `shelf_entries.current_page`
  for the club's book. Content with `spoiler_page` beyond it is sent as `locked: true` with
  `title`/`body` = null. `?reveal=1` is the explicit "espiar" and is the only way to get it. A reply
  is never "less spoiler" than its topic (`replySpoilerPage`). Authors always see their own text.
- **Joining** requires `acceptGuidelines: true` and adds the book to the reader's shelf as "Quero
  ler" if missing (progress must come from real reading). The owner cannot leave; they delete.
- **Moderation (club level):**
  - Reporting hides the item for the reporter immediately.
  - `REPORTS_TO_HIDE = 3` distinct reports set `hidden`: only the author and the owner still see
    it, flagged.
  - The owner sees per-item open report counts and removes (`removed`, never shown again) or
    restores. Both resolve the item's reports.
  - Authors delete their own content for good (and its reports).
  - Blocking hides a reader's topics and replies for the blocker in every club (one direction).
- **Limits:** 5 owned clubs per reader; 30 writes/min per reader and isolate; 100 topics and
  200 replies per request (no pagination yet).
- Pure rules live in `@bubo/domain` (`community.ts`); shapes in `@bubo/contracts`
  (`community.ts`); every route is under `/v1`, session-protected and in `API_ROUTE_DEFINITIONS`.

## Not done (Task 08 or later)

- Private clubs and invites (deep links), members list and stats, polls, reviews, friends' feed,
  club reading cycles, notifications.
- Platform-level moderation: there is no admin panel. Reports are in `content_reports`; the owner
  of the Bubo project must be able to act on abuse across clubs (support contact, SQL runbook or an
  admin tool) before a store release. See `CONFIGURAR.md`.
- Automatic text filtering (profanity/links) and appeal flows.
- Blocking does not hide the blocker's content from the blocked reader.

## Consequences

Locked content never reaches a device that did not ask for it. Moving a reader's shelf progress
unlocks debates immediately (the app refetches clubs after progress changes). Removing the club
book from the shelf sets the reader's page back to 0 for that club.
