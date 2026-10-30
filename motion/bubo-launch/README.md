# Bubo — "Feche o livro." (launch film)

A 16.5 s, 1080 × 1920, 60 fps product film for Bubo, built raw: HTML Canvas 2D for composition
and type, a small WebGL2 paper engine for pages and covers, a Node synthesiser for the score and
Chromium + ffmpeg for the render. No motion framework, no samples, no stock.

Start with [docs/concept.md](docs/concept.md), then [docs/shotlist.md](docs/shotlist.md),
[docs/style-guide.md](docs/style-guide.md) and [docs/review-log.md](docs/review-log.md).

## Isolation

This folder is its own npm project. It does not touch the Bubo workspaces or the app. It only
reads canonical files from the repo:

- official mascot and brand PNGs from `assets-source/` (copied byte for byte and checked
  against `assets-source/manifest.json` SHA-256 by `npm run sync`);
- Plus Jakarta Sans from `apps/mobile/assets/fonts/`;
- the Material Icons font and glyph map from the root `node_modules/@expo/vector-icons`
  (run `npm install` at the repo root first).

Local dependencies (exact versions): `puppeteer-core` (drives the Chrome already installed on
the machine; never downloads a browser), `ffmpeg-static` (ffmpeg 6.1 with libx264), and
`@fontsource/literata` (SIL OFL serif for the printed page).

## Reproduce

```sh
cd motion/bubo-launch
npm install
npm run sync      # canonical assets → build/assets (hash-verified)
npm run check     # determinism: seek(t) in scrambled order gives identical pixels
npm run render    # score → -14 LUFS master → frames → out/*
```

Set `CHROME_PATH` if Chrome is not in a standard location.

Outputs in `out/` (git-ignored):

| file                            | what                                                                   |
| ------------------------------- | ---------------------------------------------------------------------- |
| `bubo-launch-9x16.mp4`          | master: H.264 High, yuv420p BT.709, CRF 16, 60 fps, AAC 256k, −14 LUFS |
| `bubo-launch-phone-preview.mp4` | 432 × 768 @ 30 fps, the size the film gets in a phone feed             |
| `bubo-launch-poster.png`        | end card, sharp (`seek`, no motion blur)                               |
| `bubo-launch-contact-sheet.png` | every 0.5 s with timestamps                                            |

Development helpers: `npm run serve` (scrub at `/src/index.html?t=8.25`, space plays),
`npm run frames -- --times 0,1.5` (single frames), `npm run sheet -- --every 0.25`,
`node scripts/strip.mjs <start> <seconds> [step]` (consecutive frames from the master).

## Render contract

`src/main.js` exposes:

- `window.seek(t)` — draws the exact state at `t` seconds. The film is a pure function of time:
  closed-form springs and easing, hash noise with fixed seeds, no `Math.random`, no timers, no
  state carried between frames. Every frame starts from a cleared canvas.
- `window.renderFrame(t)` — the same frame with temporal motion blur: the film decides shutter
  and sub-frame count per moment (`shutterAt` in `src/film/film.js`): 32 sub-frames on the crash,
  6–8 on page turns and jumps, none while there is type to read.
- `window.ready` — fonts, images and textures loaded.

## Layout

```
src/lib/      math (springs, noise), camera, Canvas helpers, WebGL paper, mascot, Bubo UI kit
src/film/     timeline (shared with audio), book, opening, recall, review, finale, director
scripts/      sync, serve, audio synthesis, frames/sheets, render, determinism, strips
```

## Honesty

Every product claim on screen is the product's own: copy from the app's screens, the review
card prompt the API generates, the real SM-2 schedule (days 1, 2, 8, 23, 61 for "Lembrei"),
real XP rules (+30 XP for one remembered card in a completed review). Dom Casmurro (1899) is in
the public domain. The story is illustrative; no user data, no invented metric.
