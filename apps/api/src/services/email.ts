import { type ServerEnv } from '@bubo/config';

import { AppError } from '../lib/errors';
import { type Logger } from '../lib/logger';

export type PasswordResetEmail = { to: string; name: string; url: string };

/** Outbound transactional e-mail. */
export type EmailSender = {
  sendPasswordReset(message: PasswordResetEmail): Promise<void>;
};

const RESEND_URL = 'https://api.resend.com/emails';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Plain, accessible pt-BR message (text + minimal HTML). */
export function passwordResetContent({ name, url }: PasswordResetEmail) {
  const firstName = name.trim().split(/\s+/)[0] ?? '';
  const greeting = firstName ? `Olá, ${firstName}!` : 'Olá!';
  const text = [
    greeting,
    '',
    'Recebemos um pedido para redefinir a senha da sua conta no Bubo.',
    `Para criar uma nova senha, abra este link (válido por 1 hora): ${url}`,
    '',
    'Se não foi você, ignore este e-mail — sua senha continua a mesma.',
    '',
    'Bubo — Read deeply.',
  ].join('\n');
  const html = `<!doctype html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;color:#21152F;line-height:1.5">
<p>${escapeHtml(greeting)}</p>
<p>Recebemos um pedido para redefinir a senha da sua conta no Bubo.</p>
<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;background:#7C3AED;color:#FFFFFF;border-radius:999px;text-decoration:none;font-weight:bold">Criar nova senha</a></p>
<p style="color:#6B6480">O link vale por 1 hora e só pode ser usado uma vez. Se não foi você, ignore este e-mail — sua senha continua a mesma.</p>
<p>Bubo — Read deeply.</p>
</body></html>`;
  return { subject: 'Redefina sua senha do Bubo', text, html };
}

export type EmailSenderOptions = {
  config: Pick<ServerEnv, 'APP_ENV' | 'RESEND_API_KEY' | 'EMAIL_FROM'>;
  logger: Logger;
  fetch?: typeof fetch;
};

/**
 * - RESEND_API_KEY + EMAIL_FROM set → sends through Resend.
 * - development without a provider → logs the link locally (never leaves the machine).
 * - otherwise → fails explicitly (never silently drops a reset e-mail).
 */
export function createEmailSender({
  config,
  logger,
  fetch: fetchImpl,
}: EmailSenderOptions): EmailSender {
  const send = fetchImpl ?? ((input, init) => fetch(input, init));
  return {
    async sendPasswordReset(message) {
      if (config.RESEND_API_KEY && config.EMAIL_FROM) {
        const content = passwordResetContent(message);
        let response: Response;
        try {
          response = await send(RESEND_URL, {
            method: 'POST',
            headers: {
              authorization: `Bearer ${config.RESEND_API_KEY}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({ from: config.EMAIL_FROM, to: [message.to], ...content }),
            signal: AbortSignal.timeout(10_000),
          });
        } catch {
          logger.error('password reset e-mail failed', { provider: 'resend', reason: 'network' });
          throw new AppError('UPSTREAM_ERROR', 'Could not send the e-mail.');
        }
        if (!response.ok) {
          logger.error('password reset e-mail failed', {
            provider: 'resend',
            status: response.status,
          });
          throw new AppError('UPSTREAM_ERROR', 'Could not send the e-mail.');
        }
        return;
      }
      if (config.APP_ENV === 'development') {
        logger.info('password reset link (development only)', {
          to: message.to,
          resetUrl: message.url,
        });
        return;
      }
      throw new AppError('SERVICE_UNAVAILABLE', 'E-mail delivery is not configured.');
    },
  };
}
