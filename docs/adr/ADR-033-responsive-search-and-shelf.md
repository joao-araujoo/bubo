# ADR-033 — Responsive book search and a usable reading shelf

- Status: Accepted
- Date: 2026-10-04

## Context

The reader reported slow searches and covers, difficulty adding books and no convenient way to
register books already read. The catalog awaited every provider and cover ingestion, and mobile
mutations awaited unrelated recommendation refreshes after the API had already accepted the book.

## Decision

- Catalog search keeps concurrent providers, edition identity and honest partial-source status.
  When real books arrive, other providers and bounded alternatives get a 1.2-second merge window.
  Remaining work warms the complete cache through the runtime's background scheduler. An early
  partial response is cached for only 60 seconds. An empty fast provider never creates a premature
  “not found”. Standalone callers without a scheduler still await completion.
- Reading known cover metadata and reusing/ingesting one cover have a 100-millisecond foreground
  allowance. Remaining work continues in the background. Search never downloads a whole page of
  covers; ingestion retains ADR-016's allowlist, byte limits and deadline.
- Search results and the personal shelf use virtualized lists. The search input remains mounted
  when Discover changes between recommendations and results. Typing hides older-query results
  until the debounce settles. Recommendation requests are disabled while searching.
- Prefetching warms only the first visible search covers, with two background downloads at a time
  and duplicate suppression. Covers retain memory/disk caching and appropriately sized renditions.
  Each stalled candidate has six seconds before the next real candidate is tried; stale image
  events cannot skip the current candidate. Neutral loading frames precede a typographic fallback.
- “Adicionar em” offers **Quero ler**, **Lendo** and **Já li**. The selected status follows the
  reader through details, ISBN and manual entry. Adding keeps the search open, changes the action
  to “Abrir estante”, and provides “Ver minha estante”.
- POST `/v1/shelf` accepts `finished` atomically for both catalog and manual entries. Known total
  pages become the current page; unknown counts remain unknown. `startedAt` stays null because we
  do not know when historical reading began. `finishedAt` is the instant of the reader's current
  declaration, not evidence of a historical completion date. Future Replay must not interpret
  this declaration as reading activity during that month/year.
- The shelf offers all five statuses, counts, accent-insensitive local title/author search,
  Recentes/Título/Autor ordering, pull-to-refresh and status actions directly on each row. The
  book's status controls are also at the top of its detail page.
- API-accepted saves update this account's loaded shelf, detail and catalog/ISBN caches before
  background invalidation. No optimistic write, unloaded history, XP or session is fabricated.
  Authentication failures and confirmed missing books prevail over cached content; recoverable
  failures retain known data with an explicit retry.

## Validation and delivery

API fixtures cover a slow provider, empty fast provider, complete/partial cache behavior, delayed
cover metadata and background enrichment. Shelf tests cover direct completed-book insertion with
and without page counts, duplicate protection and unchanged activity stats. Mobile cache tests
cover accepted entries, historical data preservation, account isolation and ISBN matching.

Validation on 2026-10-04: `npm run verify` passed with 512 tests, format/lint/typecheck/assets/audit
green, and the Android JS bundle exported successfully. Android/iOS visual acceptance, keyboard,
large-font layouts, assistive technology and real provider/image delivery remain a device check.
No database migration or new dependency is required. This change does not publish the API or
replace an installed APK.

## Planned sharing features

At the acceptance of this ADR, the existing [future-ideas checklist](../ideias-futuras.md) included
**21 Bubo Replay mensal**, **22 Cards para compartilhar nos Stories**, and **23 Bubo Replay anual**
as unchecked backlog items. This catalog/shelf change did not implement them. The subsequent
[ADR-034](ADR-034-replay-and-book-stories.md) adds their local recorded-reading/Stories slice,
with native delivery and device acceptance tracked separately.
