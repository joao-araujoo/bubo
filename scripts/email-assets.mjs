// E-mail art (ADR-041): small, hosted, content-hashed PNGs derived from the OFFICIAL artwork.
// Each hero is an untouched official pose (trimmed + downscaled) centred on soft concentric
// circles drawn from theme tokens; the logo is the official horizontal logo, downscaled. Both are
// reduced to a ≤ 256-colour palette so an e-mail carries ~30 KB of images instead of ~450 KB of
// attachments. The API serves them at /v1/email/art/<file> (immutable cache).
//
// `--check` regenerates the pixels and compares them (palette + scanlines, not deflate bytes,
// which differ between zlib builds) with the embedded files; it never writes.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';

import {
  canvas,
  composite,
  crop,
  decodeIndexedPng,
  encodeIndexedPng,
  fit,
  indexedScanlines,
  opaqueBounds,
  quantize,
  readPng,
} from './lib/png.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'apps/api/src/services/email-artwork.generated.ts');
const asset = (...parts) => path.join(root, 'apps/mobile/assets', ...parts);

/** Display size in CSS px; files are drawn at 2× for sharp phones. */
const HERO = 220;
const LOGO_WIDTH = 120;
const POSES = {
  welcome: 'mascot/bubo-welcome.png',
  doubt: 'mascot/bubo-doubt.png',
  confident: 'mascot/bubo-confident.png',
  // ADR-038: "sentimos sua falta" (curious) and account deleted (neutral).
  curious: 'mascot/bubo-curious.png',
  neutral: 'mascot/bubo-neutral.png',
};
/** Ring radius (share of the canvas) and the alpha of each purpleLight tint, outermost first. */
const RINGS = [
  [0.5, 26],
  [0.4, 44],
  [0.3, 66],
];
const MASCOT_SHARE = 0.62;

const colours = fs.readFileSync(path.join(root, 'apps/mobile/src/theme/colors.ts'), 'utf8');
const token = (name) => {
  const value = new RegExp(`\\b${name}: '(#[A-Fa-f0-9]{6})'`).exec(colours)?.[1];
  if (!value) throw new Error(`Token de email ausente: ${name}`);
  return value;
};
const PALETTE_TOKENS = [
  'purple',
  'purpleDeep',
  'purpleSoft',
  'lavender',
  'white',
  'ink',
  'inkMuted',
  'line',
];
const tokens = Object.fromEntries(PALETTE_TOKENS.map((name) => [name, token(name)]));
const rgba = (hex, alpha) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
  alpha,
];

/** Anti-aliased filled circle centred on a square canvas. */
function disc(size, radius, colour) {
  const image = canvas(size, size, [0, 0, 0, 0]);
  const centre = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cover = Math.max(0, Math.min(1, radius - Math.hypot(x - centre, y - centre) + 0.5));
      if (cover === 0) continue;
      const o = (y * size + x) * 4;
      image.data[o] = colour[0];
      image.data[o + 1] = colour[1];
      image.data[o + 2] = colour[2];
      image.data[o + 3] = Math.round(colour[3] * cover);
    }
  }
  return image;
}

function hero(file) {
  const size = HERO * 2;
  const image = canvas(size, size, [0, 0, 0, 0]);
  const tint = token('purpleLight');
  for (const [share, alpha] of RINGS) {
    composite(image, disc(size, size * share - (share === 0.5 ? 1 : 0), rgba(tint, alpha)), 0, 0);
  }
  const source = readPng(asset(file));
  const pose = fit(crop(source, opaqueBounds(source)), Math.round(size * MASCOT_SHARE));
  composite(image, pose, Math.round((size - pose.width) / 2), Math.round((size - pose.height) / 2));
  return image;
}

function logo() {
  const source = readPng(asset('brand/bubo-logo-horizontal.png'));
  const trimmed = crop(source, opaqueBounds(source));
  return fit(trimmed, LOGO_WIDTH * 2);
}

/** name → { image, display } for every e-mail picture. */
const pictures = [
  ['logo', logo()],
  ...Object.entries(POSES).map(([pose, file]) => [`hero-${pose}`, hero(file)]),
];

/** Existing embedded PNGs by name, so identical pixels keep identical bytes (no churn). */
function embedded() {
  const found = new Map();
  if (!fs.existsSync(output)) return found;
  const text = fs.readFileSync(output, 'utf8');
  const pattern =
    /file: '([\w-]+)\.[0-9a-f]+\.png',\s*width: \d+,\s*height: \d+,\s*png: '([A-Za-z0-9+/=]+)'/g;
  for (const match of text.matchAll(pattern)) {
    if (match[1] && match[2]) found.set(match[1], Buffer.from(match[2], 'base64'));
  }
  return found;
}

function samePixels(bytes, expected) {
  try {
    const actual = decodeIndexedPng(bytes);
    return (
      actual.width === expected.width &&
      actual.height === expected.height &&
      JSON.stringify(actual.palette) === JSON.stringify(expected.palette) &&
      actual.scanlines.equals(indexedScanlines(expected))
    );
  } catch {
    return false;
  }
}

const previous = embedded();
const art = {};
let reused = 0;
let totalBytes = 0;
for (const [name, image] of pictures) {
  const { palette, indices } = quantize(image, 256);
  const expected = { width: image.width, height: image.height, palette, indices };
  const old = previous.get(name);
  const bytes = old && samePixels(old, expected) ? old : encodeIndexedPng(expected);
  if (bytes === old) reused += 1;
  totalBytes += bytes.length;
  const hash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 10);
  art[name] = {
    file: `${name}.${hash}.png`,
    width: Math.round(image.width / 2),
    height: Math.round(image.height / 2),
    png: bytes.toString('base64'),
  };
}

const source = await prettier.format(
  '// Generated by scripts/email-assets.mjs from the official artwork (ADR-041); do not edit.\n' +
    '// Files are drawn at 2×; width/height are the display size in CSS pixels.\n' +
    `export const emailPalette = ${JSON.stringify(tokens)} as const;\n` +
    `export const emailArt = ${JSON.stringify(art)} as const;\n` +
    'export type EmailArtName = keyof typeof emailArt;\n',
  { ...(await prettier.resolveConfig(output)), parser: 'typescript' },
);

if (process.argv.includes('--check')) {
  if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== source) {
    throw new Error('Arte dos e-mails desatualizada. Rode npm run email:assets.');
  }
  console.log(
    `email:assets — ${pictures.length} imagens oficiais (${Math.round(totalBytes / 1024)} KB) e ${PALETTE_TOKENS.length} tokens verificados.`,
  );
} else {
  fs.writeFileSync(output, source);
  console.log(
    `email:assets — ${pictures.length} imagens (${Math.round(totalBytes / 1024)} KB; ${reused} sem mudança) e tokens prontos.`,
  );
}
