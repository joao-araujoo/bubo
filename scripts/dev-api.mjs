// `npm run dev:api` — picks the right local API runtime:
// - apps/api/.dev.vars has DATABASE_URL → Cloudflare Worker locally (wrangler dev, Miniflare) + Neon
// - otherwise                          → same app on Node with PGlite (no cloud resources at all)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const devVars = path.join(root, 'apps/api/.dev.vars');

function hasDatabaseUrl() {
  if (!fs.existsSync(devVars)) return false;
  return fs
    .readFileSync(devVars, 'utf8')
    .split(/\r?\n/)
    .some((line) => /^\s*DATABASE_URL\s*=\s*\S+/.test(line));
}

const script = hasDatabaseUrl() ? 'dev:worker' : 'dev:local';
console.log(
  script === 'dev:worker'
    ? 'dev:api → wrangler dev (DATABASE_URL found in apps/api/.dev.vars)'
    : 'dev:api → local Node server with PGlite (no DATABASE_URL in apps/api/.dev.vars)',
);

// `script` is one of two constants above (no user input), so a shell command string is safe and
// works for npm.cmd on Windows.
const child = spawn(`npm run ${script} --workspace @bubo/api`, {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});
child.on('exit', (code) => process.exit(code ?? 0));
