// Copies the canonical Bubo assets the film needs into build/assets, byte for byte.
// Mascot and brand PNGs are verified against assets-source/manifest.json (SHA-256), so the film
// can only ever show the official files. Fonts and icons come from the app and its dependencies.
// Usage: npm run sync
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const film = path.resolve(here, '..');
const repo = path.resolve(film, '../..');
const out = path.join(film, 'build/assets');
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const manifest = JSON.parse(
  fs.readFileSync(path.join(repo, 'assets-source/manifest.json'), 'utf8'),
);
fs.mkdirSync(path.join(out, 'mascot'), { recursive: true });
fs.mkdirSync(path.join(out, 'brand'), { recursive: true });
fs.mkdirSync(path.join(out, 'fonts'), { recursive: true });

let copied = 0;
for (const entry of manifest) {
  const source = path.join(repo, 'assets-source', entry.file);
  if (sha256(source) !== entry.sha256) throw new Error(`Hash mismatch for ${entry.file}`);
  const target = path.join(out, entry.file);
  fs.copyFileSync(source, target);
  if (sha256(target) !== entry.sha256) throw new Error(`Copy altered ${entry.file}`);
  copied += 1;
}

const fonts = [
  ['apps/mobile/assets/fonts/PlusJakartaSans_400Regular.ttf', 'PlusJakartaSans-400.ttf'],
  ['apps/mobile/assets/fonts/PlusJakartaSans_500Medium.ttf', 'PlusJakartaSans-500.ttf'],
  ['apps/mobile/assets/fonts/PlusJakartaSans_600SemiBold.ttf', 'PlusJakartaSans-600.ttf'],
  ['apps/mobile/assets/fonts/PlusJakartaSans_700Bold.ttf', 'PlusJakartaSans-700.ttf'],
  ['apps/mobile/assets/fonts/PlusJakartaSans_800ExtraBold.ttf', 'PlusJakartaSans-800.ttf'],
  [
    'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf',
    'MaterialIcons.ttf',
  ],
];
for (const [from, to] of fonts) {
  fs.copyFileSync(path.join(repo, from), path.join(out, 'fonts', to));
  copied += 1;
}

// Material Icons glyph map (name → code point), the same table @expo/vector-icons uses.
const glyphs = JSON.parse(
  fs.readFileSync(
    path.join(
      repo,
      'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialIcons.json',
    ),
    'utf8',
  ),
);
fs.writeFileSync(path.join(out, 'fonts/material-icons.json'), JSON.stringify(glyphs));

// Literata (SIL OFL) for the printed book page only; the product voice stays Plus Jakarta Sans.
const literata = path.join(film, 'node_modules/@fontsource/literata/files');
for (const [file, to] of [
  ['literata-latin-400-normal.woff2', 'Literata-400.woff2'],
  ['literata-latin-400-italic.woff2', 'Literata-400-italic.woff2'],
  ['literata-latin-600-normal.woff2', 'Literata-600.woff2'],
  ['literata-latin-700-normal.woff2', 'Literata-700.woff2'],
]) {
  fs.copyFileSync(path.join(literata, file), path.join(out, 'fonts', to));
  copied += 1;
}

console.log(`sync-assets: ${copied} files copied to build/assets (official PNGs hash-verified).`);
