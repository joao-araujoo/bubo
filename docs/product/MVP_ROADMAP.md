# Bubo 4 — MVP implementation roadmap

Implementation proceeds by vertical slices. A slice is complete only when mobile UI, API contract, persistence, authorization, loading/error/empty states and tests work together.

## Slice 0 — Foundation
- Expo app boots on device.
- Worker API boots locally.
- Neon readiness check.
- R2 binding documented.
- Canonical design tokens available.

## Slice 1 — Auth + onboarding
- Account creation/login.
- Profile/onboarding preferences.
- Secure native session persistence.

## Slice 2 — Estante + book identity
- Search/import book metadata.
- Work/Edition resolution.
- Add to shelf and reading status.
- ISBN scanner.

## Slice 3 — Hoje + reading sessions
- Current reading card.
- Start/pause/finish session.
- Page/progress updates.
- Weekly activity.

## Slice 4 — Active Recall v1
- Free recall first.
- Structured follow-up questions.
- Confidence capture.
- Persist original answers and evaluation evidence.

## Slice 5 — Bubo Score v1 + spaced review
- Session performance separated from book mastery.
- Review queue and delayed retrieval.
- Retention estimates and uncertainty.
- Explainable score changes.

## Slice 6 — Profile + gamification
- XP ledger.
- Meaningful streak.
- Achievements and reader growth.

## Slice 7 — Community
- Follow graph, posts, reviews, comments, save/report/block.

## Slice 8 — Clubs + anti-spoiler
- Membership, current book, discussions and spoiler boundaries.

## Slice 9 — Notifications + settings
- Push tokens and preferences.
- Review reminders.
- Account/privacy/accessibility settings.

## MVP rule
Do not implement a Stitch screen just because it exists. A screen enters the product only when it supports a confirmed user flow or system state.
