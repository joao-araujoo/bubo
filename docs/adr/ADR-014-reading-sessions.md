# ADR-014 — Reading sessions are the single source of progress, XP and streaks

- Status: Accepted
- Date: 2026-09-26

## Context

Task 03 adds focused reading sessions. Hoje shows streak, XP, the cognitive week and today's
mission. All of it must come from real activity (no invented numbers). It also needs to be correct
across time zones and flaky mobile networks, and it must be hard to game.

## Decision

**The `reading_sessions` table (`0004`)** records, per session:

- the owning reader and shelf entry
- start and end timestamps
- focused seconds, from 60 up to the 4 h cap
- start and end page
- an optional reflection (≤ 2000 characters)
- the XP earned
- `local_date`: the reader's calendar day, sent by the app

**Derived values**

- **Streak** (`computeStreak`, `@bubo/domain`): consecutive local dates with a session. The streak
  stays alive until the current day ends.
- **Week:** the local dates from Monday to Sunday that have a session.
- **XP** (`xpForReadingSession`, `@bubo/scoring`): 1 XP per focused minute, capped at 60 per
  session. It's summed from the stored `xp_earned`, so a later rule change never rewrites history.
- **Progress** (`applySessionToShelf`): the current page never moves backwards. A want-to-read or
  paused book becomes "reading". Reaching the last page marks it "finished".
- **Mission of the day:** one focused session today (`readToday`). No reward is promised.

**Integrity**

- The client generates a UUID per session. `POST /v1/sessions` is idempotent on it, so a retry
  after a network failure never counts twice.
- Server-side plausibility checks. The server rejects:
  - an `endedAt` in the future (5 min skew allowed)
  - sessions older than 48 h
  - a `localDate` more than ±1 day from the end time's UTC date, which blocks back-dated streaks
  - focused time longer than the session itself
  - an end page below the current page or beyond the book
- The session insert and the shelf update happen in one transaction.

**Mobile timer**

- The timer uses wall-clock timestamps, not tick counts, so it stays exact while the app is in the
  background.
- The screen stays awake while the timer runs (`expo-keep-awake`).
- Leaving a started session asks for confirmation.

## Consequences

- Stats are consistent everywhere and fully tested: domain, contracts, and API on PGlite.
- A session in progress lives in memory. If the OS kills the app mid-session, the time is lost.
  Persisting the running timer is a follow-up.
- Streaks trust the device's calendar day within ±1 day. That's the accepted trade-off for
  traveling readers.

## Alternatives considered

- **Computing local dates on the server from a stored time zone:** it needs profile time-zone
  management and DST edge cases. Sending `localDate` with a plausibility window is simpler and
  honest.
- **Counting XP from minutes at read time:** a rule change would silently rewrite past XP.
