# ADR-032 — Reading return, five-minute sessions and adaptive Hoje

- Status: Accepted; code implemented, device acceptance pending
- Date: 2026-10-04

## Context

The owner's future-ideas checklist starts with confidence when returning to a book. The durable
session already persists the clock, recall draft and stable submission UUID, but the checklist
still describes it as wholly unimplemented. Hoje presents recovery, reading, reviews and a mission
as independent calls to action, including an empty review card. A removed shelf entry can also
leave a saved session with no usable recovery or discard path.

The next safe slice is ideas 02, 03 and 06, building on 01. A calibrated retention curve, Bubo
Score, factual book verification and native Live Activities require separate evidence or setup.

## Decision

### Returning to a book

- Before starting, the timer offers the real current page and the latest recall or reflection
  available among the shelf detail's 20 recent sessions. It first shows up to three lines, with
  **Ver anotação completa** / **Recolher anotação**. Historical sessions without either field
  show an honest absence; a writing older than that response window is not searched in this slice.
  The existing authenticated shelf-detail response supplies these records.
- The optional action **Tentar lembrar** shows **O que você lembra do trecho anterior?**.
  The reader answers mentally; no new answer is collected, stored or sent to Gemini.
  **Começar agora** or **Pular e começar** starts the timer directly. Absence of a previous
  reflection never blocks reading.
- A still-loading history or retryable network failure can use the actual entry already in this
  account's shelf/detail cache, with honest loading/unavailable copy for the annotation. Reading
  starts without waiting for that optional history. Authentication failures and a confirmed
  missing entry always take precedence over cached data.
- An existing draft takes precedence. Its UUID, clock, page, recall and pending submission are
  preserved; the return step never replaces it with a new session.
- A confirmed missing shelf entry offers explicit discard of the corresponding local draft.
  Network errors retain the draft and offer retry; failure to fetch a book is never sufficient
  reason to delete a draft. Local discard neither records activity nor reverses an already
  accepted server session.

### Five minutes are enough

- The explicit five-minute action opens the normal reading flow with an optional 300-second
  goal in its durable draft. An existing draft keeps its original goal, including no goal.
- Reaching 300 focused seconds presents **Você leu por 5 minutos. Pode continuar ou ir para a
  recordação quando quiser.** The acknowledgement marker is persisted before feedback. The clock
  continues and the reader chooses whether to go to recall or keep reading. No automatic
  completion, extra XP, compulsory challenge or penalty is introduced.
- Goal and acknowledgement survive pause, process death and recovery. Legacy drafts remain
  valid. The normal minimum duration, four-hour cap, recall gate and idempotent API acceptance
  continue to apply. Storage failure is visible and retryable.
- This acknowledgement is in-app; it is not a scheduled background notification or a Live
  Activity. System background execution and device recovery still require device acceptance.

### One primary action on Hoje

The pure decision rule uses this order, with conflict tests:

1. Recover a saved reading session.
2. Finish loading required data, or retry a failed read. Unknown data does not imply an empty
   shelf or completed reviews.
3. Review cards actually offered today, respecting the server's daily review limit.
4. Return gently with five minutes when a reading book exists, `readToday` is false and the last
   accepted reading date is at least seven local calendar days before today.
5. Continue reading after an accepted session today.
6. Read the current book normally.
7. Choose a book from the shelf.

When reviews have priority, the current book remains available as secondary context. Recovery
points to the saved draft's book and does not offer a new reading. A true `readToday` prevails over
a conflicting stale `lastReadingDate`, so it cannot produce a return message. Empty review cards
are omitted. The weekly activity and focus mission remain derived from accepted activity.

### Dates and real data

- `GET /v1/me/stats` adds nullable `lastReadingDate`, derived only from this account's accepted
  `reading_sessions.local_date`, taking the latest date at or before the query's `today` with
  no 400-day history limit. No review, shelf edit, draft or app visit counts as reading.
- Hoje compares that recorded date with the device's current local calendar date, using calendar
  days rather than elapsed 24-hour blocks. Exactly seven days qualifies; fewer days do not.
- No recorded date means no evidence of an absence. A future date cannot trigger a return
  message. A timezone change does not rewrite the local date saved with a historical session.
- Older stats responses remain readable, but their absent recency field cannot support a claim
  about days away. The latest-reading date is an activity signal, not a retention measurement.
- No migration, new remote configuration, new tab, AI provider call or replacement mascot is
  needed. The optional Gemini question in the mandatory recall flow remains a separate consent.

## Validation and limits

`npm run verify` passed on 2026-10-04: 495 tests, format, lint, typecheck, canonical-assets checks
and repository audit. Tests cover decision conflicts, the seven-day boundary, absent/future
dates, account isolation, legacy drafts, five-minute persistence, concurrent notice/timer
transitions, failed-write retry and guarded discard without duplicate activity. The actual mobile
client also drives the local API's current stats, shelf history and daily-limited review queue.
The Android JavaScript bundle also exported successfully with Metro. This is a bundling check;
it does not compile or install a new APK and does not establish visual or native acceptance.

Physical-device acceptance remains pending: process termination/restart, clock changes, offline
retry, five-minute acknowledgement, large fonts, TalkBack/VoiceOver and the orphaned-book path.
Existing push/provider setup, native widgets and Swift compilation remain separate open items.
There was no current visual/device run, migration, deployment, remote change or git commit in
this continuation. It does not claim an APK build or store release.
