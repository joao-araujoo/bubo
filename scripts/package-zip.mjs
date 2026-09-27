// Creates a ZIP of the repo at the root (default name below), dependency-free and cross-platform.
// Excludes dependencies, caches, build output, local secrets and the raw design drops
// (the official assets are already in assets-source/, byte-identical).
// Usage: npm run package:zip [-- <output.zip>]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

import { crc32 } from './lib/png.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(root, process.argv[2] ?? 'Bubo-Task-02-Auth-Onboarding.zip');
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  '.expo',
  '.wrangler',
  'dist',
  'build',
  'web-build',
  'coverage',
  '.cache',
  '.tmp-inspect',
  // Local PGlite data: contains real accounts created during development.
  '.local',
  'Bubo - Assets',
  'stitch_bubo_read_deeply',
]);
const EXCLUDED_PATHS = new Set(['apps/mobile/android', 'apps/mobile/ios']);

function isExcludedFile(rel) {
  const base = path.posix.basename(rel);
  if (base.endsWith('.zip') || base.endsWith('.log') || base.endsWith('.tsbuildinfo')) return true;
  if (base === '.env' || (base.startsWith('.env.') && base !== '.env.example')) return true;
  if (base.startsWith('.dev.vars') && base !== '.dev.vars.example') return true;
  return base === '.DS_Store' || base === 'Thumbs.db' || base === 'expo-env.d.ts';
}

function collect(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full).split(path.sep).join('/');
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name) || EXCLUDED_PATHS.has(rel)) continue;
      collect(full, out);
    } else if (!isExcludedFile(rel)) {
      out.push(rel);
    }
  }
  return out;
}

function dosDateTime(date) {
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

const files = collect(root).sort();
const localParts = [];
const centralParts = [];
let offset = 0;

for (const rel of files) {
  const data = fs.readFileSync(path.join(root, rel));
  const deflated = zlib.deflateRawSync(data, { level: 9 });
  const useDeflate = deflated.length < data.length;
  const body = useDeflate ? deflated : data;
  const name = Buffer.from(`bubo/${rel}`, 'utf8');
  const crc = crc32(data);
  const { time, day } = dosDateTime(fs.statSync(path.join(root, rel)).mtime);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(useDeflate ? 8 : 0, 8);
  local.writeUInt16LE(time, 10);
  local.writeUInt16LE(day, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  localParts.push(local, name, body);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(useDeflate ? 8 : 0, 10);
  central.writeUInt16LE(time, 12);
  central.writeUInt16LE(day, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(body.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(offset, 42);
  centralParts.push(central, name);

  offset += local.length + name.length + body.length;
}

const centralSize = centralParts.reduce((sum, b) => sum + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

fs.writeFileSync(output, Buffer.concat([...localParts, ...centralParts, end]));
const sizeMb = (fs.statSync(output).size / 1024 / 1024).toFixed(1);
console.log(`package:zip — ${files.length} files → ${path.relative(root, output)} (${sizeMb} MB)`);
