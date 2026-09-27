// Copies the official Bubo files into assets-source/ (byte-identical, clean names) and derives
// app-ready copies for the mobile app (downscale / trim transparent padding / pad onto canvas only).
// Usage: npm run assets:build
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ASSETS, DERIVED, MOBILE_ASSETS_DIR, RAW_DIR, SOURCE_DIR } from './asset-manifest.mjs';
import {
  canvas,
  composite,
  crop,
  fit,
  opaqueBounds,
  readPng,
  resize,
  writePng,
} from './lib/png.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const abs = (...parts) => path.join(root, ...parts);
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copySources() {
  const manifest = [];
  for (const asset of ASSETS) {
    const target = abs(SOURCE_DIR, asset.kind, asset.file);
    const rawFile = abs(RAW_DIR, asset.raw);
    ensureDir(path.dirname(target));
    if (fs.existsSync(rawFile)) {
      fs.copyFileSync(rawFile, target);
    } else if (!fs.existsSync(target)) {
      throw new Error(`Missing official asset: neither "${rawFile}" nor "${target}" exists.`);
    }
    const { width, height } = readPng(target);
    manifest.push({
      id: asset.id,
      kind: asset.kind,
      file: `${asset.kind}/${asset.file}`,
      originalName: asset.raw,
      labelPt: asset.labelPt,
      description: asset.description,
      needsConfirmation: asset.needsConfirmation === true,
      width,
      height,
      sha256: sha256(target),
    });
  }
  fs.writeFileSync(abs(SOURCE_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function trimmed(file) {
  const image = readPng(file);
  return crop(image, opaqueBounds(image));
}

function scaleToWidth(image, width) {
  const height = Math.round((image.height * width) / image.width);
  return resize(image, width, height);
}

function centered(size, background, art) {
  const base = canvas(size, size, background);
  return composite(
    base,
    art,
    Math.round((size - art.width) / 2),
    Math.round((size - art.height) / 2),
  );
}

function deriveMobile() {
  const out = (...p) => abs(MOBILE_ASSETS_DIR, ...p);
  ensureDir(out('brand'));
  ensureDir(out('mascot'));
  ensureDir(out('icons'));

  for (const asset of ASSETS) {
    const source = abs(SOURCE_DIR, asset.kind, asset.file);
    if (asset.kind === 'mascot') {
      // Keep the full square frame so every pose shares the same visual scale.
      writePng(out('mascot', asset.file), fit(readPng(source), DERIVED.mascotMaxSide));
    }
  }

  const logo = trimmed(abs(SOURCE_DIR, 'brand', 'bubo-logo-horizontal.png'));
  writePng(out('brand', 'bubo-logo-horizontal.png'), fit(logo, DERIVED.logoMaxWidth));

  const symbol = trimmed(abs(SOURCE_DIR, 'brand', 'bubo-symbol.png'));
  writePng(out('brand', 'bubo-symbol.png'), fit(symbol, DERIVED.symbolMaxSide));

  const { appIcon, adaptiveIcon, splashIcon } = DERIVED;
  writePng(
    out('icons', 'app-icon.png'),
    centered(appIcon.size, appIcon.background, scaleToWidth(symbol, appIcon.symbolWidth)),
  );
  writePng(
    out('icons', 'adaptive-icon-foreground.png'),
    centered(adaptiveIcon.size, [0, 0, 0, 0], scaleToWidth(symbol, adaptiveIcon.symbolWidth)),
  );
  writePng(out('icons', 'splash-icon.png'), fit(symbol, splashIcon.maxSide));
}

const manifest = copySources();
deriveMobile();
console.log(
  `assets:build — ${manifest.length} official assets synced, mobile derivatives written.`,
);
