# ADR-035 — Private book rating, rating popup and grid Estante

- Status: Accepted
- Date: 2026-10-04

## Context

The owner asked to rate a book after reading it, with a polished popup whenever a book is
finished or declared read, and to show that rating on the book Story. ADR-034 had kept the Story
rating ephemeral. The owner also asked for a simpler Estante, a 2-column grid like the provided
reference, with status actions moved inside the book, a leaner book detail and a clearer sort
control.

## Decision

- Add `shelf_entries.rating` (`0016_shelf_entry_rating.sql`, nullable `smallint`, CHECK 1–5).
  It is the reader's private opinion of the book on their shelf. It is not a club review
  (`0010`), is never published to Comunidade and never feeds XP, streaks, Replay or
  recommendations.
- `ShelfEntry.rating` is returned everywhere a shelf entry is (defaults to `null` for older APIs
  and cached data). `PATCH /v1/shelf/:id` accepts `rating` (1–5 integer, or `null` to clear).
  Status and page edits never change it.
- The mobile app opens one root rating popup (`RatingPromptHost`) when an accepted mutation
  produces a finished, unrated entry: "Já li" in the status picker, adding a book as Já li
  (search, catalog, ISBN, manual) or a session that reaches the last page. It asks once per book
  per app run and can be dismissed with "Agora não". The book detail keeps tappable stars for
  finished/rated books.
- The book Story uses the saved rating, with a "Mostrar nota na arte" switch. The Story status
  label is the plain status ("JÁ LI", "LENDO AGORA", …).
- Estante is a 2-column grid: cover, title, author and either the rating or reading progress.
  Status changes live in the book detail. Sorting is a pill (current order + icon) that opens a
  bottom sheet. Search placeholders are short enough to fit next to the ISBN button.

## Consequences

- The migration is additive, so the deployed API keeps working before it is redeployed; the
  updated app needs the updated API to save ratings (older APIs answer 422 for `rating`).
- Ratings are private shelf data and are deleted with the shelf entry or the account.
