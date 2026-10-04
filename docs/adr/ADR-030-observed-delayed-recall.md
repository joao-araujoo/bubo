# ADR-030 — Observed recall across actual review delays

- Status: Accepted
- Date: 2026-10-03

## Context

Task 06 still needs a calibrated retention model. Immediate writing and the SM-2 scheduling
interval are not measurements of memory stability (ADR-017/027). Readers already record delayed
self-assessments, which can be grouped by elapsed time without inventing a prediction.

## Decision

- Extend `GET /v1/me/memory` with `delayedRecall`, version `observed-v1`, and three fixed windows:
  1–6 days, 7–29 days and 30+ days. Each carries `total` and `remembered` (grade ≥ 4).
- Measure actual seconds from the preceding review of the same card. Its first review starts at
  the card's creation timestamp. Each review exposes the answer in the app, so every preceding
  review starts a new interval, including Quase/Esqueci. A card created from reading does not
  prove learning, and later unrecorded exposures are unknown.
- Require at least 24 elapsed hours. Negative gaps and reviews less than a day apart do not
  enter these windows. Exact boundaries are 24 hours, 7 × 24 hours and 30 × 24 hours; local date
  and timezone changes do not alter the interval.
- Calculate `lag(reviewed_at)` over the owner's complete card history before filtering the
  selected 7/30/90/365-day period by review local date. Scope logs, cards and shelf to the owner.
  Postgres returns at most three aggregate rows; no full history enters Worker memory.
- Show **Lembrei após um intervalo** inside Minha memória only when observations exist. Every
  percentage displays its numerator and denominator. Empty windows say **Sem revisões**, never
  zero percent. The caption identifies self-assessments; there is no predicted curve or Score.
- Keep older API compatibility with empty contract defaults. Advance the persisted mobile cache
  to v8 so existing hydrated responses cannot omit the new field.
- Serialize review writes on an owner-scoped card row and recheck the client UUID after the lock.
  A retry confirms the accepted attempt; another UUID must observe the new due date. XP and
  delayed observations are recorded once per accepted attempt.
- Simplify routine screen copy and remove Home's explanatory footer. Keep instructions needed
  for actions, accessibility, spoiler boundaries, provider consent and errors.

## Limits and next step

This is a descriptive model of recorded attempts, not a retention probability or proof of book
comprehension. Cards repeat within windows; samples are self-selected and scheduled, not random;
unrecorded practice is unknown. Deleted cards/books remove their review history via existing
cascades. A new or empty account has no inferred result. Do not compare readers or books by these
percentages, rank a best learning hour, or derive Bubo Score from them.

Task 06's prediction/Score remains open. Before publishing it, obtain consented longitudinal
observations, define the target outcome and holdout protocol, handle repeated cards/readers and
cold starts, and report calibration and uncertainty. Keep the writing checklist, observed
self-assessments, personal-note fidelity and factual book verification separate. See
[core-validation.md](../core-validation.md).

## Validation

Domain and contract tests cover delay boundaries, invalid gaps, ordered windows, counts and older
responses. API tests cover previous reviews outside the period, actual timestamps instead of
scheduled intervals/local dates, grades, account isolation, retries and deletion. Review tests
cover simultaneous requests and a deterministic stale UUID lookup before lock acquisition;
PGlite serializes transactions, so those tests do not measure contention on remote Postgres.
Physical Android/iPhone acceptance and Swift compilation remain separate requirements.
