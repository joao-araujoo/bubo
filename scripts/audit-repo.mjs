// Repository policy audit (runs in `npm run verify`). Fails on:
// - other package managers' lockfiles or commands (npm only)
// - OpenAI SDK/usage in code, Gemini secrets referenced by the mobile app
// - ts-ignore / ts-nocheck / explicit any / TODO-FIXME markers in source
// - raw hex colours in mobile UI code outside the theme
// - obvious secrets committed to files
// - navigation not having exactly the 5 official tabs
// Usage: npm run audit:repo
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF = path.join('scripts', 'audit-repo.mjs');
const IGNORED_DIRS = new Set([
  'node_modules',
  '.expo',
  '.wrangler',
  'dist',
  'coverage',
  'android',
  'ios',
  '.tmp-inspect',
  '.local',
  'Bubo - Assets',
  'stitch_bubo_read_deeply',
  'assets-source',
  '.git',
]);
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.jsx']);
const TEXT_EXT = new Set([
  ...CODE_EXT,
  '.json',
  '.toml',
  '.md',
  '.sql',
  '.yml',
  '.yaml',
  '.example',
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(root).map((f) => path.relative(root, f));
const errors = [];
const report = (file, message) => errors.push(`${file.replaceAll('\\', '/')}: ${message}`);
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const posix = (file) => file.replaceAll('\\', '/');

// 1. npm only
for (const lock of [
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'yarn.lock',
  'bun.lockb',
  'bun.lock',
  '.yarnrc.yml',
]) {
  if (files.some((f) => path.basename(f) === lock))
    report(lock, 'non-npm package manager file found');
}
for (const file of files.filter((f) => path.basename(f) === 'package.json')) {
  const pkg = JSON.parse(read(file));
  for (const [name, script] of Object.entries(pkg.scripts ?? {})) {
    if (/\b(pnpm|yarn|bunx?)\b/.test(script))
      report(file, `script "${name}" uses a non-npm package manager`);
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
  for (const dep of Object.keys(deps)) {
    if (/^(openai|@openai\/|@ai-sdk\/openai)/.test(dep))
      report(file, `forbidden dependency "${dep}" (no OpenAI)`);
  }
}

// 2. Source hygiene
for (const file of files) {
  const ext = path.extname(file);
  if (
    !TEXT_EXT.has(ext) ||
    posix(file) === posix(SELF) ||
    path.basename(file) === 'package-lock.json'
  )
    continue;
  const text = read(file);
  const isCode = CODE_EXT.has(ext);
  const isMobileSrc = posix(file).startsWith('apps/mobile/src/');

  if (isCode) {
    if (/@ts-(ignore|nocheck)/.test(text)) report(file, 'uses @ts-ignore/@ts-nocheck');
    if (/(:\s*any\b|\bas\s+any\b|<any>)/.test(text)) report(file, 'uses explicit `any`');
    if (/\b(TODO|FIXME|XXX|HACK)\b/.test(text)) report(file, 'contains TODO/FIXME/XXX/HACK marker');
    if (/from\s+['"]openai['"]|api\.openai\.com/i.test(text)) report(file, 'references OpenAI');
  }
  if (isMobileSrc) {
    if (/GEMINI_API_KEY|EXPO_PUBLIC_GEMINI|generativelanguage\.googleapis/.test(text)) {
      report(file, 'Gemini must stay server-side (found Gemini secret/endpoint in the mobile app)');
    }
    if (
      !posix(file).startsWith('apps/mobile/src/theme/') &&
      /['"`]#[0-9a-fA-F]{3,8}\b/.test(text)
    ) {
      report(file, 'raw hex colour outside src/theme (use theme tokens)');
    }
  }
  // Committed templates (*.example) must never carry values for secret variables.
  if (path.basename(file).endsWith('.example') || path.basename(file) === '.env.example') {
    for (const line of text.split(/\r?\n/)) {
      const match =
        /^\s*(DATABASE_URL|NEON_DATABASE_URL|BETTER_AUTH_SECRET|GEMINI_API_KEY|RESEND_API_KEY|GOOGLE_BOOKS_API_KEY)\s*=\s*(\S+)/.exec(
          line,
        );
      if (match) report(file, `template has a value for secret ${match[1]} — keep it empty`);
    }
  }
  // Obvious secrets (Google API keys, OpenAI-style keys, credentialed connection strings).
  if (/AIza[0-9A-Za-z_-]{35}/.test(text)) report(file, 'looks like a committed Google API key');
  if (/\bsk-[A-Za-z0-9]{20,}/.test(text)) report(file, 'looks like a committed secret key');
  if (/postgres(ql)?:\/\/[^\s:@/]+:[^\s@/]{6,}@(?!host|HOST|<)/.test(text)) {
    report(file, 'looks like a credentialed database URL');
  }
}

// 3. Secret files that must never be packaged/committed
for (const file of files) {
  const base = path.basename(file);
  if (
    (base === '.env' ||
      /^\.env\.(?!example$)/.test(base) ||
      /^\.dev\.vars(?!\.example$)/.test(base)) &&
    !file.includes('node_modules')
  ) {
    console.warn(
      `audit:repo warning — local secret file present (gitignored, excluded from ZIP): ${posix(file)}`,
    );
  }
}

// 4. Exactly five official tabs
const tabsDir = path.join(root, 'apps/mobile/src/app/(tabs)');
const expectedTabs = ['comunidade.tsx', 'estante.tsx', 'index.tsx', 'revisar.tsx', 'voce.tsx'];
if (fs.existsSync(tabsDir)) {
  const screens = fs
    .readdirSync(tabsDir)
    .filter((f) => /\.tsx$/.test(f) && !f.startsWith('_'))
    .sort();
  if (JSON.stringify(screens) !== JSON.stringify(expectedTabs)) {
    report(
      'apps/mobile/src/app/(tabs)',
      `expected tabs ${expectedTabs.join(', ')} but found ${screens.join(', ')}`,
    );
  }
} else {
  report('apps/mobile/src/app/(tabs)', 'tab directory missing');
}

if (errors.length > 0) {
  console.error(`audit:repo failed (${errors.length}):\n - ${errors.join('\n - ')}`);
  process.exit(1);
}
console.log(`audit:repo — ${files.length} files scanned, no policy violations.`);
