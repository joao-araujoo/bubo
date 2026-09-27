# ADR-016 — Server-side book catalog with cached provider results

- Status: Accepted
- Date: 2026-09-26

## Context

Readers need to find a book by title, author or ISBN without typing every field. External catalog
records are incomplete, inconsistent and sometimes unavailable. Provider credentials must stay on
the API.

## Decision

- The API queries Open Library and Google Books. The mobile app calls only Bubo's authenticated
  `/v1/catalog` routes and never holds a provider key.
- Search results merge matching works and favor a Portuguese edition when the provider returns
  one. Title relevance, language and edition count determine order.
- ISBN lookup accepts valid ISBN-10/13 input, normalizes to ISBN-13 and checks the returned edition.
- The API validates upstream data, limits text lengths and accepts cover URLs only from the
  allowlisted HTTPS hosts. External covers remain external URLs for now.
- Search and detail results have separate cache lifetimes. A partial provider failure can still
  return results with a `partial` flag; both providers unavailable produce a service error.
- A book is added to the reader's shelf through the existing authenticated shelf flow. Manual
  entry remains available when catalog lookup fails.

## Consequences

- Discover, add-book, onboarding and ISBN scanning share one catalog contract and client cache.
- The UI does not invent popularity, ratings or recommendations; personalized topic order comes
  from the reader's saved interests.
- Storing cover images in R2 remains future work. Provider image availability is not guaranteed.
