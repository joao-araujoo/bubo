# ADR-037 — Estante 3D: the shelf as a cozy bookcase (visualisation only)

- Status: Accepted
- Date: 2026-10-11

## Context

After the 3D book (ADR-036) the owner asked for a complete experience: a cozy 3D bookcase with
all their books, reached from Estante as an extra way of looking at the collection, where
tapping a book pulls it off the shelf and shows it. It must be a visualisation only; the
2-column grid Estante (ADR-035) stays the working screen. The owner also asked for the book
shadow to be softened.

## Decision

- New route `estante-3d`, opened from the Estante header ("Ver estante 3D", shelves icon). It
  reads the same `GET /v1/shelf` query as Estante; nothing is written from it.
- `Bookcase3D` (features/shelf) draws a wooden bookcase from the real entries: boards with a lit
  top face, a front face and a cast shadow, side panels, a warm lamp glow and Bubo sitting on
  the top board (the official `main` pose through the `profile` state; no dedicated "on a
  shelf" pose exists). Books stand as spines whose width comes from the real page count
  (`spineWidth` → `bookThickness`), with colour and a stable height per title (`coverPalettes`,
  `spineHeightRatio`) and the title printed along the spine. Books being read stand face out
  with their real cover. Rows are packed by the pure `packShelfRows` in `@bubo/domain`.
- Tapping a book lifts it out of its row and opens `ShelfSpotlight`: a dimmed room, the book in
  `Book3D`, its title, author, status chip, private rating and page count, with "Abrir livro"
  (normal `livro/[id]` screen) and "Devolver à estante". Reduced motion removes the spring.
- Every book is a button with a label and a selected state; narrow spines extend their touch
  area with `hitSlop` to the 48 pt minimum.
- Wood, wall, glow and spine shading colours live in `shelfPalette` (`src/theme/colors.ts`); the
  wall and glow follow the colour scheme, the wood does not.
- `Book3D` shadow: the two solid pills are replaced by five concentric, barely translucent
  ellipses that fade at the edge, lower and narrower than before.

## Consequences

- No API, contract, migration, dependency or remote change.
- `spineWidth`, `spineHeightRatio` and `packShelfRows` are unit-tested; the bookcase itself is
  validated visually (device acceptance pending, see [TESTAR-TELAS.md](../TESTAR-TELAS.md)
  step 22b).
- Spines are typographic (palette + title) because the API does not provide spine art; only
  face-out books show the real cover. Very large shelves scroll vertically; the bookcase width
  caps at 520 pt on tablets.
