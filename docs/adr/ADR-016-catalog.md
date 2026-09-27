# ADR-016 — Catalog edition identity and bounded cover storage

- Status: Accepted
- Date: 2026-09-26; updated 2026-09-27

## Context

The initial implementation collapsed works by title and author surname, mixed original dates and
median page counts into editions, and seeded ISBN caches from search. This lost edition choices
and could present unverified metadata. Keyless Google quota is also unreliable.

## Sources actually implemented

| Source       | Use                                                       | Requirements / limitations                                                                                                                                                                                    |
| ------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open Library | Text search with best edition, work/edition details, ISBN | No key. Optional `CATALOG_CONTACT_EMAIL` identifies Bubo. Low-volume, human-facing use; no scraping/bulk harvesting. Search currently supplies one selected edition per work.                                 |
| Google Books | Title/author, volume details, ISBN                        | Server-only `GOOGLE_BOOKS_API_KEY`. Public API documentation requires identification. Existing keyless mode is best-effort and may have zero quota. No language filter excludes foreign editions.             |
| BrasilAPI    | Brazilian ISBN (`97865…`, `97885…`)                       | No key. `providers=cbl,mercado-editorial` avoids duplicate Google/Open Library fan-out. This is aggregator access, not direct CBL integration. Authors may include contributors. No title search implemented. |

References: [Open Library guidelines](https://openlibrary.org/developers/api),
[search/editions](https://openlibrary.org/dev/docs/api/search),
[Google Books usage](https://developers.google.com/books/docs/v1/using),
[BrasilAPI ISBN contract](https://github.com/BrasilAPI/BrasilAPI/blob/main/pages/docs/doc/isbn.json).
No retailer scraping or undocumented direct CBL access. Coverage is not guaranteed.

## Search and edition selection

- Normalize Unicode compatibility characters, whitespace, ISBN prefixes and dash variants.
  Validate both checksums; canonicalize to ISBN-13. After a successful empty ISBN-13 query, try
  its ISBN-10 equivalent. The 979 range has no equivalent.
- Exact ISBN lookup requires the identifier in the returned record. Fuzzy Google hits, different
  ISBNs, formats and regions are not silently substituted. A miss leaves manual/title search
  available. No ISBN, publisher, year or language is invented.
- Search both text sources concurrently. After a successful response without complete title/author
  token coverage, try bounded accent-folded title/author alternatives. Map `title:`/`author:` syntax to each
  source. Subject browsing does not use alternatives.
- Rank full token coverage above weak matches, then exact/prefix title, language and metadata.
  Simple English/Spanish/French word hints choose language preference; ambiguous titles use the
  Portuguese app locale. This is a heuristic, not translation or reliable language detection.
  Other-language editions remain visible, with their reported language.
- Preserve Open Library edition ids (`ol:OL…M`). Work-only records (`ol:OL…W`) show “Edição não
  identificada”. Never borrow a work cover, original publication date, publisher list or median
  page count for an edition. Query approximations are labeled “Correspondência aproximada”.
- Dedupe equal provider ids or canonical ISBNs. Without ISBN, require matching full title/authors
  and known equal publisher, year, language and format. Missing fields do not prove equivalence.
  Distinct editions remain choices. BrasilAPI publication region does not imply language.
- Shelf/onboarding resolve ids on the server. Catalog duplicates are checked by book identity or
  ISBN rather than title alone. Auth and owner-scoped reader queries remain unchanged.

## Failure isolation, caching and limits

- Each upstream request has a 4 s deadline, including body parsing, and shared in-flight work.
  Maximum three Google / two Open Library text queries. ISBN: two Google queries, two Open Library editions, up to
  three author details and one BrasilAPI request. Successful author responses cache too.
- Per-isolate pacing: 1 s between Open Library/BrasilAPI calls, 200 ms for Google. A queue wait
  above 2 s fails partially. HTTP 429/403 backoff respects `Retry-After` within 60–3600 s
  (600 s default). No numeric BrasilAPI quota is assumed.
- Open Library documents 1 request/s unidentified, 3/s with contact identification; Bubo keeps
  1/s. These controls are **per isolate**, not a distributed quota guarantee. Scaling requires
  aggregate coordination/provider agreement. Existing catalog reader limit is 60/min/isolate.
- Versioned `v4` cache: complete text searches 24 h; useful partial searches 10 min; successful empty searches 60 s;
  details/complete successful ISBN 7 days; complete ISBN misses 5 min; partial ISBN hits 60 s.
  Successful raw responses cache for 1 h (empty search responses: 5 min). Memory LRU + Workers edge; edge promotion preserves
  remaining expiry rather than resetting the original TTL.
- Search seeds only Google volume details, never Open Library/ISBN detail cache. Partial ISBN misses raise retryable 503, never definitive
  404/negative cache. Useful results survive other sources failing. Per-source statuses remain
  honest; BrasilAPI is `skipped` for text/non-Brazilian ISBN queries.

## Cover cache through MediaStorage

- Requires existing `MEDIA` and owner-configured HTTPS `MEDIA_PUBLIC_URL` (public bucket base).
  Missing configuration disables ingestion. No app secret, upload endpoint or arbitrary-URL proxy.
  Local Node uses in-memory storage and does not demonstrate public R2 delivery.
- Ingest one eligible candidate when opening a catalog/ISBN detail or resolving a shelf/onboarding
  addition. Search only reads known cached-cover metadata; no page-wide ingestion. Two concurrent
  operations and 20 attempts/minute/isolate; failure backoff 10 min.
- Exact HTTPS host allowlist, provider paths, no credentials/custom ports/backslashes. Revalidate
  every redirect, maximum two hops. Hosts: `covers.openlibrary.org`, `books.google.com`,
  `books.googleusercontent.com`. BrasilAPI URLs outside the list are discarded; ISBN cover fallback
  remains. No internal/arbitrary redirect targets are fetched.
- Total response deadline 2.5 s; streamed cap 2 MiB regardless of Content-Length. Validate binary
  JPEG/PNG/basic WebP structure/dimensions instead of trusting MIME. Reject HTML/SVG/truncation,
  dimensions below 20 or above 6000 pixels, and over 16 million pixels. Structural validation is
  not full decoding; extended/animated WebP is conservatively rejected. Client fallback remains.
- SHA-256 URL identity → `covers/catalog-v1/<hash>`. Read storage before downloading and coalesce
  in-flight requests per isolate. Cold isolates reuse stored objects, although simultaneous cold
  isolates can duplicate a download. Original bytes are stored; ready metadata caches 24 h.
- Persist the server-produced cached URL in catalog shelf rows, upgrading external covers on a
  later successful addition. Failure preserves external URLs/typographic cover. Public delivery
  and object lifecycle require owner configuration; no remote configuration was performed.

Uses the existing abstraction over the [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).
No remote upload, migration or deployment was run.

## Mobile search regression and database verification (2026-09-27)

The real mobile HTTP client omitted `API_ROUTES.catalogSearch`: it requested `/v1?q=...`,
received a route 404, and presented that as a missing book. An authenticated client-to-Hono
regression test reproduced the failure before the fix. It now requests `/v1/catalog/search`.
Search-route 404 is an invalid API response, not a missing edition. Network, session and provider
failures stay distinct from a successfully empty result. Empty results with any failed source
raise 503 and are not negative-cached; malformed upstream responses are failures too.
The mobile search key is versioned, normalizes Unicode/ISBN, requires a signed-in reader,
expires partial/empty data after 60 s and no longer carries a previous query's empty result
into a new search through placeholder data.

Authenticated Hono API probes with temporary PGlite auth and live public providers returned 200
for `Dom Casmurro`, `Machado de Assis` (also explicit `author:`), ISBN-10 `857657313X` (Duna) and ISBN-13
`9788545702870` (Akira). Google failed during these probes; useful results survived.
This proves the API path with live providers, not the phone's LAN connectivity or camera flow.
The configured mobile API base initially had no reachable server. After `npm run dev:api`
started the local Worker with existing Neon configuration, that same base returned 200 for
`/v1/health` and `/v1/ready`, and 401 for unauthenticated catalog search. No device session was
used or copied; authenticated live-provider checks above used the isolated API harness.

`DATABASE_URL` was already present in the designated, gitignored API `.dev.vars`. Read-only
Neon inspection confirmed Bubo's migration ledger and tables; migrations 0001–0007 were already
applied, with no pending migration. The official `db:migrate -- --check` path reported no changes.
An identifiable isolated `books` record was committed, read through a fresh query and removed
by its exact id/title; absence after removal was verified. It was never on a user's shelf.
No credentials or remote configuration were changed. `GOOGLE_BOOKS_API_KEY` and
`MEDIA_PUBLIC_URL` were absent; keyed Google and public R2 delivery remain unvalidated.

Neon stores accounts/sessions, reader profiles, saved books/shelves, reading sessions, recall
cards and review logs. External APIs still supply discovery metadata; Neon does not expand the
catalog. The migrator now reads process `DATABASE_URL` first, then only `apps/api/.dev.vars`,
and derives a direct Neon connection in memory for migrations. `--check` only reads the ledger;
running without it applies pending migrations through the existing transactional migrator.

## Evidence and pending acceptance

Read-only probes on 2026-09-27: Open Library returned Portuguese editions for “Dom Casmurro”;
BrasilAPI returned CBL metadata for `9788545702870` (“Akira”); keyless Google returned quota 429.
These are individual observations, not comprehensive coverage validation.

Fixture/in-memory tests cover query alternatives, ISBN equivalence/strict matching, deduplication,
edition metadata, language ranking, approximations, expiry/backoff/timeouts, authenticated shelf
and onboarding, and bounded image ingestion. They do not validate live Google with a key or R2.

Device acceptance pending: Discover/add-book/first-book/details/scanner, real camera handoff,
foreign-edition labels, large fonts/small screens, VoiceOver/TalkBack and failed images/network
retries. No visual acceptance or production E2E is claimed.
