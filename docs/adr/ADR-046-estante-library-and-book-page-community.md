# ADR-046: Redesign 2.0 Estante and book page — library home, opening, reader marks, community numbers

Date: 2026-10-29. Status: accepted (part 4 of the Redesign 2.0). Builds on ADR-031 (anonymous
"Mais lidos no Bubo"), ADR-035 (private rating), ADR-036/037 (3D book and bookcase), ADR-042
(Skoob-style shelf and book pages) and ADR-043 (Nunito, tab bar).

## Context

The owner approved the prototype's Estante (after the Bookify reference, in Nunito), the "Doctor
Strange" opening corridor with the official symbol in the middle (no rings, no top logo) and the
book page with Skoob's information: readers' rating and its distribution, how many read / are
reading / want to read / gave up, "Relendo", Favorito/Tenho/Desejado, a Resenhas tab, "quem leu
também leu" and a finish forecast. The app had none of the community numbers and none of the
marks; reviews only exist inside clubs.

## Decision

**Reader marks (migration `0018_shelf_marks`).** `shelf_entries` gains `favorite`, `owned`,
`wishlist` and `rereading` booleans (default false, additive). `PATCH /v1/shelf/:id` accepts them;
entries expose them with `addedAt`. "Relendo" is a mark on top of the `reading`/`paused` status,
not a new status, so Hoje, widgets, sessions, Replay and every status rule keep working: any other
status, or a session that finishes the book, turns it off (`keepsRereading`). Choosing "Relendo"
on the book page asks first and restarts at page 0.

**Community numbers (`GET /v1/shelf/:id/community`).** Read-only and scoped to the requester's own
entry. Only counts leave the database, never names, and each block has a privacy floor:

- readers by status (`finished`, `reading`, `want_to_read`, `abandoned`) from 2 distinct readers;
- ratings from the private 1–5 shelf ratings, only as average and distribution from 5 ratings
  (`ratingSummary`): the individual rating stays private;
- "quem leu também leu": catalog books finished by other readers who finished this one, from 3
  such readers and 2 in common (`alsoReadPercent`), never books already on the requester's shelf.

Manual books have none of these (one reader by definition). The Termos/Privacidade texts now say
so (updated 29/10/2026).

**Estante tab** (`features/shelf/Library`): "Boa noite," + first name with the official symbol
waving, a search pill with 3D and add, the shelves as circles with real covers and counts (Lendo,
Quero ler, Lidos, Favoritos, Tenho, Abandonei; Desejados and Pausados when used), "Continuar
lendo", collections ("Lidos em {ano}" from `finishedAt`, Quero ler with "curtinhos" up to 150
pages, Favoritos) and "Adicionados recentemente" (`addedAt`). The previous grid with filters,
local search and ordering moved to `prateleira` (`?filtro=…&ano=…`), now with the marks as
filters. The app background stays the theme's, so the Estante matches the other tabs.

**Opening** (`ShelfOpening`): a corridor of the reader's own books as typographic spines on two
perspective planes sliding to a horizon, an amber and violet glow behind the official symbol,
"Sua estante" with real book and page counts, and "Abrir minha estante". At most once a local
day, only with books, never under reduced motion's animations.

**Book page** (`features/book/BookExtras`): the readers' rating under the title, "Leitores no
Bubo", the status row in the prototype's order with "Relendo", the three marks, the finish
forecast in the progress card (`finishForecast`: pages of the last 14 days of sessions over the
days since the first of them, needs two sessions), "Sua nota" with "Nota dos leitores", tabs
Leitura / Sobre / Resenhas (the club reviews, as before) / Cards, and "Quem leu também leu".

## Consequences

- Migration `0018` and the API must be applied/deployed before a build with these screens is used
  against production; until then the new fields read as false and the community blocks stay
  hidden. Not done in this change.
- The persisted query cache moved to `bubo.query-cache.v9`.
- Device acceptance and a new APK are pending.
- Next parts: Descobrir and the recommendation algorithm, Comunidade, Replay, living mascot.
