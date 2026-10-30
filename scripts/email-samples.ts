// Sends one example of every Bubo e-mail template to an explicit recipient (ADR-038).
// Read-only until `--send-to` is given; nothing is sent without it. Credentials come from
// `.env` / `apps/api/.dev.vars` / the process environment and are never printed.
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { z } from 'zod';
import { createEmailSender } from '../apps/api/src/services/email';
import { createLogger } from '../apps/api/src/lib/logger';
import { emailArtBase } from './lib/email-art-base';

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
  const arg = (name: string) => {
    const index = process.argv.indexOf(name);
    return index < 0 ? undefined : process.argv[index + 1];
  };
  const recipient = arg('--send-to');
  if (!recipient) {
    console.log(
      'Nenhum envio. Use: npm run email:samples -- --send-to voce@example.com [--test-sender] [--name Nome]',
    );
    return;
  }
  if (!z.email().safeParse(recipient).success) throw new Error('Destinatário inválido.');
  const testing = process.argv.includes('--test-sender');
  const email = createEmailSender({
    config: {
      APP_ENV: 'preview',
      RESEND_API_KEY: key,
      EMAIL_FROM: testing ? 'Bubo <onboarding@resend.dev>' : sender,
      // Pictures are downloaded by the recipient's mail client (ADR-041).
      BETTER_AUTH_URL: emailArtBase(values, arg('--art-base')),
    },
    logger: createLogger({ service: 'bubo-email-samples' }),
  });
  const reader = { to: recipient, name: arg('--name') ?? '' };
  const stamp = new Date().toISOString();
  // Example links point at the documentation host; real e-mails carry signed API links.
  const samples: [string, () => Promise<unknown>][] = [
    [
      'boas-vindas',
      () => email.sendVerification({ ...reader, url: `https://example.test/confirmar?e=${stamp}` }),
    ],
    ['codigo-de-entrada', () => email.sendLoginCode({ ...reader, code: '482913' })],
    ['codigo-nova-senha', () => email.sendPasswordResetCode({ ...reader, code: '735208' })],
    [
      'recuperar-senha-link',
      () =>
        email.sendPasswordReset({ ...reader, url: `https://example.test/nova-senha?e=${stamp}` }),
    ],
    ['senha-alterada', () => email.sendPasswordChanged({ ...reader, eventId: `sample-${stamp}` })],
    [
      'sentimos-sua-falta',
      () =>
        email.sendReadingReturn({
          ...reader,
          bookTitle: 'Exemplo de livro',
          currentPage: 142,
          totalPages: 320,
          daysAway: 9,
          bookUrl: 'bubo:///livro/exemplo',
          unsubscribeUrl: 'https://example.test/v1/email/unsubscribe?token=exemplo.exemplo',
          eventId: `sample-return-${stamp}`,
        }),
    ],
    [
      'conta-excluida',
      () => email.sendAccountDeleted({ ...reader, eventId: `sample-deleted-${stamp}` }),
    ],
  ];
  const report: Record<string, string> = {};
  for (const [name, send] of samples) {
    try {
      const receipt = await send();
      report[name] =
        receipt && typeof receipt === 'object' && 'id' in receipt && typeof receipt.id === 'string'
          ? `aceito (${receipt.id})`
          : 'aceito';
    } catch (error) {
      report[name] = error instanceof Error ? `falhou: ${error.message}` : 'falhou';
    }
  }
  const lastId = Object.values(report)
    .map((value) => /\(([^)]+)\)/.exec(value)?.[1])
    .find((value) => value && z.uuid().safeParse(value).success);
  if (lastId) {
    const response = await fetch(`https://api.resend.com/emails/${lastId}`, {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (response.ok)
      report.ultimoEvento = emailStatus.parse(await response.json()).last_event ?? 'desconhecido';
  }
  console.log(
    JSON.stringify(
      { sender: testing ? 'teste (resend.dev)' : sender, recipient, ...report },
      null,
      2,
    ),
  );
}
main().catch((error: unknown) => {
  // Only our fixed messages; never provider bodies, headers or env values.
  console.error(error instanceof Error ? error.message : 'Falha ao enviar os exemplos.');
  process.exitCode = 1;
});
