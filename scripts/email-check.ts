// Read-only by default; real sending requires an explicit recipient argument.
import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { z } from 'zod';
import { createEmailSender } from '../apps/api/src/services/email';
import { createLogger } from '../apps/api/src/lib/logger';

const domainList = z.object({ data: z.array(z.object({ name: z.string(), status: z.string() })) });
const emailStatus = z.object({ id: z.string(), last_event: z.string().nullable().optional() });
async function main() {
  const values: Record<string, string | undefined> = {};
  for (const file of ['.env', 'apps/api/.dev.vars']) {
    if (fs.existsSync(file)) Object.assign(values, parseEnv(fs.readFileSync(file, 'utf8')));
  }
  Object.assign(values, process.env);
  const key = values.RESEND_API_KEY;
  const sender = values.EMAIL_FROM;
  if (!key || !sender)
    throw new Error('Configure RESEND_API_KEY e EMAIL_FROM no .env ou apps/api/.dev.vars.');
  const report: Record<string, unknown> = { checkedAt: new Date().toISOString() };
  async function inspect(route: string) {
    const response = await fetch(`https://api.resend.com/${route}`, {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok)
      throw new Error(`Resend: HTTP ${response.status} em consulta de diagnóstico.`);
    return response.json() as Promise<unknown>;
  }
  const domains = domainList.parse(await inspect('domains')).data;
  const senderDomain = sender.match(/@([^>\s]+)>?$/)?.[1]?.toLowerCase();
  const verified = domains.some(
    (domain) => domain.name === senderDomain && domain.status === 'verified',
  );
  report.senderDomain = senderDomain;
  report.senderVerified = verified;
  report.domains = domains;
  const arg = (name: string) => {
    const index = process.argv.indexOf(name);
    return index < 0 ? undefined : process.argv[index + 1];
  };
  let id = arg('--email-id');
  const recipient = arg('--send-to');
  if (recipient) {
    if (!z.email().safeParse(recipient).success) throw new Error('Destinatário inválido.');
    const testing = process.argv.includes('--test-sender');
    if (!testing && !verified)
      throw new Error(
        'Domínio do remetente não verificado. Use --test-sender apenas para seu próprio email.',
      );
    const receipt = await createEmailSender({
      config: {
        APP_ENV: 'preview',
        RESEND_API_KEY: key,
        EMAIL_FROM: testing ? 'Bubo <onboarding@resend.dev>' : sender,
      },
      logger: createLogger({ service: 'bubo-email-check' }),
    }).sendTest({ to: recipient, name: arg('--name') ?? '', eventId: crypto.randomUUID() });
    id = receipt?.id;
    report.testSender = testing;
    report.acceptedEmailId = id;
  }
  if (id) {
    if (!z.uuid().safeParse(id).success) throw new Error('ID de email inválido.');
    report.delivery = emailStatus.parse(await inspect(`emails/${id}`));
  }
  const output = path.resolve('build/emails');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(
    path.join(output, 'provider-check.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report, null, 2));
}
main().catch((error: unknown) => {
  // Only our fixed diagnostics/AppError messages; never dump provider bodies, headers or env.
  console.error(error instanceof Error ? error.message : 'Falha no diagnóstico Resend.');
  process.exitCode = 1;
});
