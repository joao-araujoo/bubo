# ADR-015 — Active recall from the reader's own notes, scheduled with SM-2

- Status: Accepted
- Date: 2026-09-26

## Context

Revisar is Bubo's core promise: remember what you read. We need cards the reader actually cares
about, a proven scheduling algorithm, and no invented content. AI-generated questions are
optional and must stay server-side (ADR-006).

## Decision

**Where cards come from**

- A session **reflection** automatically becomes a card due the next local day:
  - prompt: "O que ficou com você de “<livro>” (págs. X–Y)?"
  - answer: the reflection itself
- Readers can also write their own cards on the book screen (prompt plus an optional answer).

**How a review works**

1. The reader tries to remember "sem espiar". An optional typed attempt stays on the device and is
   never sent.
2. They reveal their own note.
3. They grade themselves: Não lembrei (1), Com esforço (3), Lembrei bem (4) or Fácil (5).

**Scheduling:** `scheduleNextReview` (SM-2, `@bubo/scoring`) computes the interval. The ease factor
is stored ×100 as an integer. Due dates are local calendar days.

**Rules**

- `POST /v1/recall/cards/:id/review` is idempotent on a client UUID.
- Reviewing before the due date returns `409`, because it would distort the schedule.
- The `localDate` must be within ±1 day of the server date.
- **XP per review:** 2 for trying, plus 3 more when the grade is ≥ 3.
- Review days count toward the streak and the cognitive week, together with reading days.
- The review queue is frozen when a review session starts, so grading never reshuffles it. Counts
  refresh when the reader leaves.

## Consequences

- Every card and every number is traceable to something the reader did.
- A card can only be reviewed once per due cycle. There's no cramming.
- Gemini-suggested questions can later populate cards with `source='ai'`. That needs a migration
  that widens the CHECK, plus auth and rate limits.

## Alternatives considered

- **FSRS:** better retention modelling, but it needs more parameters and data. SM-2 is a sound
  start and the scheduler sits behind one function.
- **Auto-generated questions only:** risks fake-feeling content and costs money on every read.
