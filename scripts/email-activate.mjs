// Activates the Bubo sender end to end, once the DNS records of docs/emails-dns.md exist:
//   1. asks Resend to verify the sending domain and waits for "verified";
//   2. stores RESEND_API_KEY and EMAIL_FROM as production Worker secrets (values go to wrangler
//      through stdin, never through the command line or the console);
//   3. copies the same two lines into apps/api/.dev.vars so `npm run dev:api` sends real e-mails.
// Nothing is deployed: run `npm run deploy:api` afterwards. `--check` only reports the status.
// Flags: --check | --skip-verify | --skip-secrets | --skip-dev-vars
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const flags = new Set(process.argv.slice(2));
const devVarsPath = path.join(root, 'apps/api/.dev.vars');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function loadValues() {
  const values = {};
  const rawLines = {};
  for (const file of ['.env', 'apps/api/.dev.vars']) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) continue;
    const text = fs.readFileSync(full, 'utf8');
    Object.assign(values, parseEnv(text));
    for (const line of text.split(/\r?\n/)) {
      const match = /^(RESEND_API_KEY|EMAIL_FROM)=(.*)$/.exec(line);
      if (match && match[2].trim() !== '') rawLines[match[1]] ??= line;
    }
  }
  Object.assign(values, process.env);
  return { values, rawLines };
}

async function resend(key, route, init = {}) {
  const response = await fetch(`https://api.resend.com/${route}`, {
    ...init,
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Resend respondeu HTTP ${response.status} em ${route}.`);
  return response.json();
}

function describeRecords(domain) {
  const records = Array.isArray(domain.records) ? domain.records : [];
  return records.map((record) => `  - ${record.record} ${record.name}: ${record.status ?? '?'}`);
}

async function verifyDomain(key, senderDomain) {
  const list = await resend(key, 'domains');
  const domain = (list.data ?? []).find((item) => item.name === senderDomain);
  if (!domain) throw new Error(`O domínio ${senderDomain} não existe na conta do Resend.`);
  let current = await resend(key, `domains/${domain.id}`);
  console.log(`Domínio ${senderDomain}: ${current.status}`);
  if (current.status === 'verified' || flags.has('--check')) return current;
  if (flags.has('--skip-verify')) return current;
  // Resend re-reads the zone with its own resolvers; a stale "failed" can take a few minutes to
  // flip after the records exist, so the request is repeated once a minute for up to 5 minutes.
  console.log('Pedindo verificação ao Resend e aguardando até 5 minutos…');
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (attempt % 6 === 0) await resend(key, `domains/${domain.id}/verify`, { method: 'POST' });
    await sleep(10_000);
    current = await resend(key, `domains/${domain.id}`);
    console.log(`  ${attempt + 1}/30: ${current.status}`);
    if (current.status === 'verified') return current;
  }
  return current;
}

function putSecret(name, value) {
  // The wrangler entry point is run with the current Node directly: no shell, no `.cmd` shim,
  // and the secret value travels only through stdin.
  const wrangler = path.join(root, 'node_modules/wrangler/bin/wrangler.js');
  const result = spawnSync(
    process.execPath,
    [wrangler, 'secret', 'put', name, '--env', 'production'],
    {
      cwd: path.join(root, 'apps/api'),
      input: `${value}\n`,
      stdio: ['pipe', 'inherit', 'inherit'],
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `wrangler não gravou ${name}. Faça login antes: cd apps/api && npx wrangler login`,
    );
  }
}

function writeDevVars(rawLines) {
  const existing = fs.existsSync(devVarsPath) ? fs.readFileSync(devVarsPath, 'utf8') : '';
  let next = existing;
  for (const name of ['RESEND_API_KEY', 'EMAIL_FROM']) {
    const line = rawLines[name];
    if (!line) throw new Error(`${name} não encontrado no .env.`);
    const pattern = new RegExp(`^${name}=.*$`, 'm');
    next = pattern.test(next)
      ? next.replace(pattern, line)
      : `${next.replace(/\s*$/, '')}\n${line}\n`;
  }
  if (next !== existing) fs.writeFileSync(devVarsPath, next);
}

async function main() {
  const { values, rawLines } = loadValues();
  const key = values.RESEND_API_KEY;
  const sender = values.EMAIL_FROM;
  if (!key || !sender) throw new Error('Configure RESEND_API_KEY e EMAIL_FROM no .env.');
  const senderDomain = /@([^>\s]+)>?$/.exec(sender)?.[1]?.toLowerCase();
  if (!senderDomain) throw new Error('EMAIL_FROM precisa ter o formato "Bubo <nome@dominio>".');

  const domain = await verifyDomain(key, senderDomain);
  if (domain.status !== 'verified') {
    console.log('Registros DNS vistos pelo Resend:');
    for (const line of describeRecords(domain)) console.log(line);
    if (flags.has('--check')) return;
    throw new Error(
      `O domínio ainda não está verificado (${domain.status}). Confira os quatro registros em docs/emails-dns.md e rode de novo.`,
    );
  }
  if (flags.has('--check')) {
    console.log('Pronto para ativar: rode `npm run email:activate` (sem --check).');
    return;
  }
  if (!flags.has('--skip-secrets')) {
    console.log('Gravando RESEND_API_KEY e EMAIL_FROM no Worker de produção…');
    putSecret('RESEND_API_KEY', key);
    putSecret('EMAIL_FROM', sender);
    console.log('Secrets gravados.');
  }
  if (!flags.has('--skip-dev-vars')) {
    writeDevVars(rawLines);
    console.log('apps/api/.dev.vars atualizado para o desenvolvimento local.');
  }
  console.log('Agora publique a API: npm run deploy:api');
}

main().catch((error) => {
  // Only our own messages: never provider bodies, headers or env values.
  console.error(error instanceof Error ? error.message : 'Falha ao ativar o remetente.');
  process.exitCode = 1;
});
