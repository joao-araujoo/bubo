# ADR-031 — Discover recommendations, Portuguese shelves and catalog burst fix

- Status: Accepted
- Date: 2026-10-03

## Context

The owner reported three problems in Descobrir livros on the installed APK:

1. **Search stopped working.** Reproduced against live providers: keyless Google Books has a
   quota of zero (`429`, `quota_limit_value: "0"`), so every search depends on Open Library alone.
   The catalog transport paced Open Library at 1 request/s per isolate and failed any request that
   would wait more than 2 s. Discover loaded its topic (`subject:fantasy`) while the reader typed
   (`ha`, `har`, `harr`…), each search could add an alternative query, and the fourth paced call
   was rejected → `503 SERVICE_UNAVAILABLE` ("catálogo indisponível"). Measured locally:
   `[200, 200, 503, 503, …]` for a 2-second typing burst.
2. **Covers were slow and showed the fallback first.** Open Library covers take 0.6–2.5 s each.
   `BookCover` drew the typographic cover underneath and faded the image in, so every search
   flashed a "fake" cover first. Rows of 76 pt asked for the large (`-L`) image.
3. **Recommendations were unrelated.** "Para você" was only the first onboarding interest as an
   Open Library `subject:` query: foreign editions (Polish, French) and nothing related to the
   shelf.

## Decision

### Search reliability

- **Open Library rejects queries under 3 characters** (`422 Query too short`). The app searched
  from 2 letters, so the first debounce of every search failed and, with Google at zero quota,
  became `503`. Found in the production smoke test after the first deploy. Now
  `MIN_CATALOG_QUERY_LENGTH = 3` (`@bubo/domain`): the app waits for 3 letters on every search
  screen and the API answers shorter text with an empty 200 (all sources `skipped`) without
  calling any provider. The public
  contract still accepts 2 characters for older builds.
- The per-request deadline is **6 s** (was 4 s): Open Library is now the only working text source
  and was measured at up to 4.5 s.
- The paced queue accepts waits up to **5 s** (`MAX_QUEUE_WAIT_MS`). Mobile allows 20 s.
- Open Library spacing is 1 000 ms, or **350 ms (≈3 req/s)** when `CATALOG_CONTACT_EMAIL`
  identifies Bubo in the User-Agent, as Open Library documents for identified clients.
- Alternative (accent-folded) queries run only when the first answer has fewer than 8 books and
  no strong match: each one costs another paced call.
- **Keyless Google while backing off is `skipped`, not `error`.** The first 429 is reported
  honestly; later searches neither call Google nor label results "partial". A configured
  `GOOGLE_BOOKS_API_KEY` keeps the previous error semantics. A 503 now requires a source that
  actually errored (`skipped` + empty is a legitimate empty result).
- Regression test: four concurrent searches return `200` (they returned `[200, 200, 200, 503]`
  with the old 2 s bound).

- Upstream failures are logged as `catalog upstream failed` with source, status, path and
  duration only (query strings can carry readers' book titles).

### Covers

- While a candidate loads, `BookCover` shows a neutral `surfaceMuted` frame. The typographic
  cover appears only when the book has no usable image (no candidates, all failed or blank).
- `coverUrlForWidth` (`@bubo/domain`) requests Open Library `-M` and Google `w200-h300`
  renditions for covers up to 110 pt; larger covers keep `-L`/`w400-h600`.
- Discover and search prefetch the first candidate of visible books into expo-image's
  memory + disk cache as soon as data arrives; the first three cards of each shelf load with high
  priority. Discover is persisted offline (TanStack persist), so later visits open instantly.
- Not done: a Worker cover proxy. It would be an unauthenticated image route (or a session check
  per image) and conflicts with ADR-016's "no arbitrary-URL proxy"; R2 cover caching
  (`MEDIA_PUBLIC_URL`) remains the owner-configured path to faster first loads.

### Recommendations: shortest paths on a taste graph

`GET /v1/catalog/discover[?genre=]` (session, catalog rate limit). The pure algorithm lives in
`packages/domain/src/recommend.ts`:

- **Graph.** Nodes: the reader, seed books (shelf), features (authors, normalized subjects) and
  candidate books. Edges carry a strength in (0, 1]; cost = `-ln(strength)`, so **Dijkstra's
  shortest path is the strongest chain of evidence**. Reader → seed = engagement
  (finished 1, reading 0.9, paused 0.6, want to read 0.55, abandoned 0 = ignored); seed/candidate
  ↔ author 0.85; ↔ subject 0.6 × specificity (IDF over every book in play, floor 0.15).
  Candidates link back to their features with damping 0.5, so a book can be reached in two hops
  through another candidate ("Para quem gostou de X").
- **Score.** Affinity = max(best path, noisy-OR of all direct overlaps); score = 0.7 affinity +
  0.25 log-popularity + 0.05 rating. At most two books per first author. Unreachable books are not
  "for you". Deterministic ties.
- **Subjects** are normalized across languages ("Ficção científica", "Science-fiction
  américaine" → `science fiction`), with library bookkeeping removed (`Accessible book`, `nyt:…`,
  `Reading Level-…`, "Fiction", "Anglais (langue)"). Specific phrases ("Dune (Imaginary place)")
  stay and tie series together.
- **Reasons** are built only from the evidence that produced the book: "Mesma autoria de Duna",
  "Ficção científica, como Duna" (most specific shared labeled genre; broad shelves like
  classics/comics last), "Para quem gostou de Duna", "Porque você curte ficção científica"
  (onboarding interest).

The API (`apps/api/src/services/discover.ts`):

1. Loads the reader's shelf and interests (owner-scoped). Up to 8 seeds, finished/reading first.
2. One Open Library query resolves every seed (`isbn:` when known, else folded title + author
   surname) to its work: subjects and canonical authors. User text reaches Solr only after
   `foldText` (no quotes or operators).
3. Authors are queried by exact Open Library id (`author_key:OL26320A`) once a seed resolves;
   folded full names missed initials ("J.R.R. Tolkien"). Unresolved seeds fall back to the
   surname.
4. Candidates: works **with a Portuguese edition** (`language:por`, `lang=pt` picks the
   Portuguese title/cover) by the reader's top authors and top subjects, sorted by Open Library
   reading-log count (`sort=readinglog`, "mais lidos"). Everything already on the shelf (any
   edition, matched by work key, ISBN, catalog id or title/author key) is excluded everywhere.
5. Sections: **Para você** (12), **Porque você leu / está lendo / Parecidos com X** (≥ 3 each,
   up to three seeds), **Mais lidos no Bubo** (catalog books other readers are reading or
   finished, ≥ 2 distinct readers, never names, never the viewer's own books), **Mais lidos em
   português** (Open Library reading log). A genre returns one "Mais lidos em <gênero>" section:
   popularity order nudged by taste (half rank, half affinity), up to 3 books per author.
6. Shelves prefer covers: when at least six books have a cover, coverless ones are dropped.
7. The Open Library part is cached by a SHA-256 signature of the shelf, interests and genre
   (6 h; 10 min if a call failed) and re-validated with Zod on read. The community section and
   cover-cache metadata are read fresh. Open Library failure returns 200 with
   `sources.openlibrary: 'error'` and whatever sections remain; the app says so.

Cold cost: up to four paced Open Library calls (≈3–4 s unidentified, ≈1.5 s identified);
cached visits measured at ~11 ms server-side.

## Honesty and limits

- No invented data: every book, count and reason comes from the shelf, Open Library or Bubo
  shelves. "Mais lidos em português" is Open Library's reading log, not Brazilian sales.
- Open Library metadata quality varies (wrong author on a few works, English titles for some
  Portuguese editions). No editorial correction is attempted.
- Not collaborative filtering: Bubo has too few readers for "leitores que leram X também leram
  Y". The community section is a plain count. Ratings/reviews from clubs are not used yet.
- Live probe (2026-10-03, real Open Library, PGlite): shelf Duna + O Hobbit + Dom Casmurro →
  "Messias de Duna — Mesma autoria de Duna", "O Senhor dos Anéis — Mesma autoria de O Hobbit",
  "Memórias Póstumas de Brás Cubas — Mesma autoria de Dom Casmurro", "Fundação — Ficção
  científica, como Duna", all Portuguese editions.

## Consequences

- New contract `catalogDiscoverResponseSchema`, route registry entry, OpenAPI.
- Tests: `packages/domain/test/recommend.test.ts`, `apps/api/test/catalog-discover.test.ts`
  (sections, reasons, exclusion, Portuguese/readinglog parameters, cache, community threshold,
  genre, Open Library outage, mobile client, burst regression, keyless Google skip).
- Owner: set `CATALOG_CONTACT_EMAIL` (3× faster Open Library pacing) and optionally
  `GOOGLE_BOOKS_API_KEY`; device acceptance of Discover on the APK is pending.
