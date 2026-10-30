# ADR-036 — The book as a 3D object in the book detail

- Status: Accepted
- Date: 2026-10-11

## Context

The owner asked for the book detail to open on a beautiful, well-made 3D book: a cover with
depth and a physical feel, without breaking the screen. The existing `BookCover` is a flat frame
shared by shelves, search and Stories, and it must stay flat there (grids, virtualized lists,
exports). The repository forbids raw colours outside `src/theme`, requires reduced-motion
support and keeps every number honest.

## Decision

- A new design-system component, `Book3D`, draws the book as an object: the cover hinged on its
  right edge and tilted toward the reader, a real fore-edge face (paper stripes) at a right
  angle, a hinge groove on the spine side, a diagonal gloss and a soft two-layer shadow under
  the book. It wraps `BookCover`, so image candidates, the typographic fallback, caching and the
  "no fake cover flash" rule (ADR-031/033) are unchanged.
- The drawn thickness comes from the real page count through `bookThickness` in
  `@bubo/domain` (0.18–1 of a 30 pt maximum, median when the total is unknown). It is a visual
  derivation, never a stored number.
- Motion uses only the React Native `Animated` API with the native driver, single-level
  transforms (`perspective` first) and hinge offsets, so Android and iOS compose it the same way.
  On mount the book swings in from a steeper angle and settles; while pressed it turns to face
  the reader with a light haptic. Layout never moves and the press is purely decorative: the
  wrapper is not focusable and the inner `BookCover` keeps its accessibility label. With the OS
  "reduce motion" setting on, the book stays still at its resting angle.
- Paper, hinge, gloss and shadow colours live in `bookPalette` (`src/theme/colors.ts`). Paper
  tones are the same in light and dark; only the shadow colour and opacity follow the scheme.
- `livro/[id]` uses `Book3D` for the hero cover (156 pt). The DEV showcase shows two samples
  (short and long book) with the typographic fallback. Shelves, search and Stories keep the flat
  `BookCover`.

## Consequences

- No API, contract, migration or remote change; no new dependency (`expo-linear-gradient` was
  already used).
- `bookThickness` is unit-tested in `packages/domain`; the component itself is validated
  visually (device acceptance pending, see [TESTAR-TELAS.md](../TESTAR-TELAS.md) step 22).
- Books without a known page count look medium-thick by design rather than inventing a total.
