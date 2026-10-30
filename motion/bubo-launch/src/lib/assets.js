// Loads the official assets (synced and hash-verified by scripts/sync-assets.mjs) and fonts.
// Nothing renders until every image is decoded and every font face is ready.
import { FONT, SERIF } from './tokens.js';

const BASE = new URL('../../build/assets/', import.meta.url);

export const POSES = [
  'main',
  'neutral',
  'happy',
  'celebrating',
  'curious',
  'thinking',
  'surprised',
  'focused',
  'reading',
  'cheering',
  'confident',
  'taking-notes',
  'idea',
  'achievement',
  'review',
  'deep-reading',
];

export const assets = {
  mascot: {},
  brand: {},
  icons: {},
};

async function image(path) {
  const img = new Image();
  img.src = new URL(path, BASE).href;
  await img.decode();
  return img;
}

async function font(family, file, weight, style = 'normal') {
  const face = new FontFace(family, `url(${new URL(`fonts/${file}`, BASE).href})`, {
    weight: String(weight),
    style,
  });
  await face.load();
  document.fonts.add(face);
}

/** Crops an image to its alpha bounding box, returns {canvas, x0, y0} (no pixel is altered). */
function trim(img) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width;
  let y0 = c.height;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (d[(y * c.width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(img, -x0, -y0);
  return { canvas: out, x0, y0, w: out.width, h: out.height };
}

export async function loadAssets() {
  await Promise.all([
    ...[400, 500, 600, 700, 800].map((w) => font(FONT, `PlusJakartaSans-${w}.ttf`, w)),
    font(SERIF, 'Literata-400.woff2', 400),
    font(SERIF, 'Literata-400-italic.woff2', 400, 'italic'),
    font(SERIF, 'Literata-600.woff2', 600),
    font(SERIF, 'Literata-700.woff2', 700),
    font('MaterialIcons', 'MaterialIcons.ttf', 400),
  ]);
  const glyphs = await (await fetch(new URL('fonts/material-icons.json', BASE))).json();
  assets.icons = glyphs;
  await Promise.all(
    POSES.map(async (pose) => {
      assets.mascot[pose] = await image(`mascot/bubo-${pose}.png`);
    }),
  );
  assets.brand.symbol = await image('brand/bubo-symbol.png');
  const logo = await image('brand/bubo-logo-horizontal.png');
  assets.brand.logo = trim(logo);
  await document.fonts.ready;
  warmUp();
}

/**
 * Chrome builds GPU copies and mip levels of an image lazily, on its first scaled draw. Drawing
 * everything once at the scales the film uses makes the very first frame identical to any later
 * render of the same t (window.seek must not depend on history).
 */
function warmUp() {
  const c = document.createElement('canvas');
  c.width = 1400;
  c.height = 1400;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  const images = [...Object.values(assets.mascot), assets.brand.symbol, assets.brand.logo.canvas];
  for (let pass = 0; pass < 2; pass++)
    for (const img of images)
      for (const s of [120, 260, 330, 430, 600, 900, 1342]) {
        g.clearRect(0, 0, 1400, 1400);
        g.drawImage(img, 0, 0, s, s);
      }
  g.getImageData(0, 0, 1, 1);
}
