// Verifies the integrity of the official Bubo assets and the mobile asset registry.
// - assets-source/ files match manifest.json hashes (and the raw drop, when present)
// - every derived mobile file exists
// - the mobile registry references every mascot/brand id and only existing files
// Usage: npm run assets:check
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ASSETS, MOBILE_ASSETS_DIR, RAW_DIR, SOURCE_DIR } from './asset-manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const abs = (...parts) => path.join(root, ...parts);
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const REGISTRY = abs('apps/mobile/src/assets/registry.ts');

const errors = [];
const fail = (message) => errors.push(message);

const manifestPath = abs(SOURCE_DIR, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  fail(`${SOURCE_DIR}/manifest.json missing — run "npm run assets:build".`);
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const asset of ASSETS) {
    const entry = manifest.find((m) => m.id === asset.id);
    const file = abs(SOURCE_DIR, asset.kind, asset.file);
    if (!entry) fail(`manifest.json has no entry for "${asset.id}".`);
    if (!fs.existsSync(file)) {
      fail(`Missing canonical source ${SOURCE_DIR}/${asset.kind}/${asset.file}.`);
      continue;
    }
    const hash = sha256(file);
    if (entry && entry.sha256 !== hash)
      fail(`Hash mismatch for ${asset.file} (source was altered).`);
    const rawFile = abs(RAW_DIR, asset.raw);
    if (fs.existsSync(rawFile) && sha256(rawFile) !== hash) {
      fail(`${asset.file} differs from the official file "${asset.raw}".`);
    }
  }
}

const derived = [
  'brand/bubo-logo-horizontal.png',
  'brand/bubo-symbol.png',
  'icons/app-icon.png',
  'icons/adaptive-icon-foreground.png',
  'icons/splash-icon.png',
  ...ASSETS.filter((a) => a.kind === 'mascot').map((a) => `mascot/${a.file}`),
];
for (const rel of derived) {
  if (!fs.existsSync(abs(MOBILE_ASSETS_DIR, rel)))
    fail(`Missing derived ${MOBILE_ASSETS_DIR}/${rel}.`);
}

if (!fs.existsSync(REGISTRY)) {
  fail('apps/mobile/src/assets/registry.ts missing.');
} else {
  const source = fs.readFileSync(REGISTRY, 'utf8');
  const requires = [...source.matchAll(/require\('([^']+)'\)/g)].map((m) => m[1]);
  for (const rel of requires) {
    if (!fs.existsSync(path.resolve(path.dirname(REGISTRY), rel))) {
      fail(`registry.ts requires a missing file: ${rel}`);
    }
  }
  for (const asset of ASSETS) {
    const expected = asset.kind === 'mascot' ? `mascot/${asset.file}` : `brand/${asset.file}`;
    const idPattern = new RegExp(`\\b${asset.id}\\s*:`);
    if (!idPattern.test(source)) fail(`registry.ts does not declare "${asset.id}".`);
    if (!requires.some((r) => r.endsWith(expected))) {
      fail(`registry.ts does not require "${expected}".`);
    }
  }
}

if (errors.length > 0) {
  console.error(`assets:check failed (${errors.length}):\n - ${errors.join('\n - ')}`);
  process.exit(1);
}
console.log(
  `assets:check — ${ASSETS.length} official assets verified, ${derived.length} derived files present.`,
);
