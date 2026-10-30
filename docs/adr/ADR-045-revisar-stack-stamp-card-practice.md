# ADR-045: Redesign 2.0 Revisar — card stack, daily stamp card, month challenge, practice decks

Date: 2026-10-29. Status: accepted (part 3 of the Redesign 2.0). Builds on ADR-014 (derived
activity), ADR-022 (daily review limit), ADR-029 (streak protection), ADR-043 (daily card stamps)
and ADR-044 (reading flow).

## Context

The owner asked for part 3 of the approved prototype: Revisar with the stamped "cartela do dia".
The board also shows the stack of today's cards, a month challenge and two practice tiles
("Cards que escaparam", "Relâmpago de 60s"). The board's "+20 XP bônus" seal, a fixed "+15 XP"
promise and a profile badge do not exist in the API, so they were not drawn.

## Decision

**Revisar tab** (`(tabs)/revisar`, `features/recall/ReviewTab`), with the same review states as
before (loading, error, daily limit reached, all reviewed, no cards):

- **Stack of today's cards:** the first real due card (book chip in its typographic cover
  colour, the prompt) on a fanned stack with Bubo `review`, and one primary button "Revisar N
  cards · ~M min" with "até +X XP". X is the ceiling of the API's per-card rule (2 XP per
  attempt, +3 when remembered; `reviewXpRange` in `@bubo/scoring`): the grade is the reader's,
  so only a ceiling is honest.
- **Cartela do dia:** the stamps of `dailyStamps` (ADR-043) as round ink stamps that press in, a
  gold seal counting them ("2/3", "fechada!") and "renova em Nh" (`hoursUntilNextDay`). An open
  stamp opens its activity (the current book's session, or the review). No bonus XP is shown,
  because the API awards none.
- **Desafio do mês:** active days (reading or review) of this month against 20
  (`monthlyChallenge`), a day grid from the tested `buildWidgetMonth` (protected days in blue,
  today ringed) and honest copy for done, reachable and no-longer-reachable months. No badge is
  promised.
- **Treinos:** two practice decks, with the note that they do not change the review schedule
  or award XP.

**Practice decks API.** `GET /v1/recall/practice?today=` (session, contract
`practiceCardsResponseSchema`, tests) is read-only: `slipped` holds cards whose latest graded
attempt in the last 30 days was a lapse (grade < 3; `slippedCardIds`), newest first, up to 20;
`lightning` holds cards reviewed at least once, least recently reviewed first, up to 40. Cards
due today are left out of both, so practice never replaces a scheduled retrieval. No grade,
schedule, XP or log is written.

**Practice screen** (`treino`, `?modo=escaparam|relampago`): one card at a time, flip, and
"Lembrei agora / Ainda não" counted on the device only. The 60-second round deals the deck in a
stable daily order (`stableBucket`, no randomness during render), counts down and reports how
many came back. Nothing is stored or sent.

The review summary (`revisao`) shows the daily stamp card with the review stamp pressed.
`DashedRule` (design system) draws the dashed rules of the stamp card and the receipt;
`useAmbientLoop` moved to `lib/motion`.

## Consequences

- One additive API route; no migration. It must be deployed before a build with this screen is
  used against production; until then the practice tiles say "Indisponível agora".
- Device acceptance and a new APK are pending.
- Next parts: Estante/Livro, Descobrir and the recommendation algorithm, Comunidade, Replay,
  living mascot.
