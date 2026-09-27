# ADR-009 — Official brand assets are canonical

- Status: Accepted
- Date: 2026-09-26

## Context

The brief says the official Bubo assets are canonical: never redesign, regenerate or use
placeholders, never use emoji or Stitch mascots in their place, and use the closest official pose
when a state has no dedicated asset. The raw files have opaque names
(`ChatGPT Image Sep 24, 2026, …png`).

## Decision

- `scripts/asset-manifest.mjs` maps each of the 26 official files to a clean name and to the pose
  label from the official brand board. The two open pairs are flagged `needsConfirmation`:
  Focado vs Lendo and Feliz vs Animando.
- `npm run assets:build`:
  1. Copies the originals byte-for-byte into `assets-source/`.
  2. Writes `manifest.json` with SHA-256 hashes.
  3. Derives app-ready copies into `apps/mobile/assets` using only downscaling (area-average,
     premultiplied alpha), transparent-padding trimming and centring. No pixel is redrawn or
     recoloured.
- App icons are composed from the official symbol. There is no dedicated official icon file.
- `npm run assets:check` (part of `verify`) fails when:
  - a source differs from its hash or from the official original
  - a derived file is missing
  - the mobile registry misses an id or points to a missing file
- The mobile app picks mascots through `buboMascots` / `mascotForState`
  (`src/assets/registry.ts`) and `<BuboMascot state="…" />`.

## Consequences

- Asset integrity is machine-checked. New official art goes through the manifest.
- The brand board shows variants that have no standalone files, so they are listed as missing in
  `docs/brand-assets.md`: mono logo, vertical logo, minimal icon, dark app icon, and the Android
  monochrome (themed) icon.

## Alternatives considered

- **Using the raw files directly:** 1254 px PNGs of about 1 MB each bloat the bundle, and the
  names are unusable.
- **Converting to WebP or SVG tracing:** SVG tracing would be a redraw, so it's forbidden. WebP is
  possible later, but PNG keeps the originals' exact alpha.
