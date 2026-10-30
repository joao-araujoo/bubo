# ADR-042: Skoob-style Estante, search, Descobrir and book pages

Date: 2026-10-13. Status: accepted. Builds on ADR-031 (Discover), ADR-033 (responsive search and
shelf), ADR-035 (rating and grid) and ADR-036 (3D book).

## Context

The owner found the Estante, book search, Descobrir and the book pages slow and unappealing, and
asked for something closer to Skoob. Measured causes on the app side:

- book pages (`livro/[id]`) showed a spinner until `/v1/shelf/:id` answered, although the shelf
  list already had the book;
- search results were tall cards (~150 pt each, chips and a full-width button), three per screen,
  with an "Adicionar em" picker to set before searching;
- the 2-column grid requested the large Open Library rendition for every tile;
- a stalled cover kept an empty frame for 6 s before trying the next candidate;
- Descobrir started its recommendation request only when opened.

## Decision

**Speed**

- `useShelfEntry` uses the cached shelf entry as placeholder data: the book page renders at once
  and only the history areas (Leitura, Cards) show quiet placeholders until the detail arrives.
- Search keeps the previous results on screen while the next query loads
  (`placeholderData: previous`), debounce 300 ms, row skeletons instead of blank cards. This
  replaces ADR-033's "hide results while the text changes": a stale row can only be added through
  the sheet, which shows the book's cover and title before the second tap.
- The Estante grid has 3 columns (~100 pt tiles), which request the medium cover rendition (the
  same URL the lists and the blurred backdrop reuse, so it is cached once).
- A stalled cover candidate is abandoned after 4 s instead of 6 s.
- The Estante tab prefetches "Para você" 1.5 s after opening, so Descobrir opens with shelves.

**Estante tab**: header with 3D shelf and "+"; a search bar ("Buscar livros, autores ou ISBN")
that opens Descobrir focused; counter tiles that double as filters (Todos, Lendo, Quero ler,
Lidos, plus Pausados/Abandonados when used); a "Lendo agora" carousel with real progress; a
compact local filter and the sort pill (now also "Sua nota"); a 3-column cover grid with a status
mark when all shelves are shown, a progress bar on covers being read and the private rating.

**Search and Descobrir**: compact rows (cover, title, author, year · pages · language, "Na sua
estante") with a round "+" that opens a sheet with Quero ler / Lendo / Já li (the preferred status
first) and adds without leaving the list; Descobrir shows genre chips and cover-first carousels
with the "+" on the cover corner and the real reason ("12 leitores no Bubo", "Porque você leu…").
"Adicionar livro" keeps the search plus two quick actions (Ler ISBN, Cadastrar à mão).

**Book pages** (`catalogo/[id]` and `livro/[id]`) share `BookHero`: the book's own cover, blurred
and veiled with theme tokens (`backdropVeil`, `bgClear`), behind the 3D book, then title, author,
Skoob-style fact columns (páginas, ano, idioma or sua nota) and an expandable synopsis. Catalog
pages end with three one-tap buttons (Quero ler, Lendo, Já li). Shelf pages keep the status chips,
show progress as a card whose editor opens in a sheet (+10, +25, +50, última página), and split the
rest into tabs: Leitura (memory path, sessions), Sobre (facts, catalog synopsis loaded on demand,
club reviews) and Cards. "Remover da estante" moved to the "⋮" sheet.

## Consequences

- No API, contract or migration change; all data shown is real (no sample books, counts from the
  shelf, reasons from the API).
- New components: `features/catalog/{AddToShelfSheet,CoverCard}.tsx`,
  `features/book/BookHero.tsx` (`BookHero`, `BookFacts`, `Synopsis`); `CatalogBookRow` and
  `CatalogSearchResults` changed API (`entryId`, `onAdd` opens the sheet).
- Needs device acceptance (light/dark, small screens, TalkBack/VoiceOver) and a new build.
