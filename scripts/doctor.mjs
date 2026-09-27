// Local environment diagnostics. Never prints secret values — only whether they are set.
// Usage: npm run doctor
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;

const ok = (msg) => console.log(`  OK    ${msg}`);
const warn = (msg) => console.log(`  WARN  ${msg}`);
const fail = (msg) => {
  failures++;
  console.log(`  FAIL  ${msg}`);
};

function versionAtLeast(actual, minimum) {
  const a = actual.replace(/^v/, '').split('.').map(Number);
  const m = minimum.split('.').map(Number);
  for (let i = 0; i < m.length; i++) {
    if ((a[i] ?? 0) > m[i]) return true;
    if ((a[i] ?? 0) < m[i]) return false;
  }
  return true;
}

function installedVersion(name) {
  const file = path.join(root, 'node_modules', name, 'package.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).version : null;
}

function parseEnvFile(file) {
  if (!fs.existsSync(file)) return null;
  const entries = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match) entries[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return entries;
}

console.log('Bubo doctor\n\nToolchain');
const node = process.version;
if (versionAtLeast(node, '20.19.0')) ok(`Node ${node}`);
else fail(`Node ${node} — requires >= 20.19.0`);

try {
  const npm = execSync('npm -v', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  if (versionAtLeast(npm, '10.0.0')) ok(`npm ${npm}`);
  else fail(`npm ${npm} — requires >= 10`);
} catch {
  fail('npm not found on PATH');
}

for (const lock of ['pnpm-lock.yaml', 'yarn.lock', 'bun.lockb', 'bun.lock']) {
  if (fs.existsSync(path.join(root, lock))) fail(`${lock} found — this repo uses npm only`);
}
if (fs.existsSync(path.join(root, 'package-lock.json'))) ok('package-lock.json present');
else warn('package-lock.json missing — run "npm install"');

console.log('\nDependencies');
if (!fs.existsSync(path.join(root, 'node_modules'))) {
  fail('node_modules missing — run "npm install" at the repo root');
} else {
  const expected = {
    expo: '57.',
    'react-native': '0.86.',
    react: '19.',
    hono: '4.',
    wrangler: '4.',
  };
  for (const [name, prefix] of Object.entries(expected)) {
    const version = installedVersion(name);
    if (!version) fail(`${name} not installed`);
    else if (!version.startsWith(prefix)) warn(`${name} ${version} (expected ${prefix}x)`);
    else ok(`${name} ${version}`);
  }
}

console.log('\nEnvironment (values are never printed)');
const apiVars = parseEnvFile(path.join(root, 'apps/api/.dev.vars'));
if (!apiVars)
  warn('apps/api/.dev.vars missing — copy apps/api/.dev.vars.example (API runs with defaults)');
else {
  for (const key of [
    'APP_ENV',
    'DATABASE_URL',
    'BETTER_AUTH_SECRET',
    'BETTER_AUTH_URL',
    'GEMINI_API_KEY',
    'RESEND_API_KEY',
    'EMAIL_FROM',
    'GOOGLE_BOOKS_API_KEY',
  ]) {
    if (apiVars[key]) ok(`api ${key} is set`);
    else warn(`api ${key} is empty`);
  }
}
const mobileVars = parseEnvFile(path.join(root, 'apps/mobile/.env'));
if (!mobileVars) warn('apps/mobile/.env missing — copy apps/mobile/.env.example');
else if (mobileVars.EXPO_PUBLIC_API_URL) ok('mobile EXPO_PUBLIC_API_URL is set');
else warn('mobile EXPO_PUBLIC_API_URL is empty');
if (mobileVars && Object.keys(mobileVars).some((k) => /GEMINI|SECRET|DATABASE/.test(k))) {
  fail(
    'apps/mobile/.env contains server secrets — remove them (EXPO_PUBLIC_* ships in the bundle)',
  );
}

console.log('\nAssets');
if (fs.existsSync(path.join(root, 'assets-source/manifest.json')))
  ok('assets-source/manifest.json present');
else fail('assets-source/manifest.json missing — run "npm run assets:build"');

console.log(
  failures === 0 ? '\nAll required checks passed.' : `\n${failures} required check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
