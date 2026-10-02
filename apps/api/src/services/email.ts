import { type ServerEnv } from '@bubo/config';
import { AppError } from '../lib/errors';
import { type Logger } from '../lib/logger';
import {
  type EmailContent,
  type EmailLink,
  type EmailReader,
  passwordResetContent,
  verificationContent,
  passwordChangedContent,
  testEmailContent,
} from './email-templates';

export { passwordResetContent } from './email-templates';
export type PasswordResetEmail = EmailLink;
export type EmailReceipt = { id: string; provider: 'resend' };
export type PasswordChangedEmail = EmailReader & { eventId: string };
export type EmailSender = {
  readonly canDeliver: boolean;
  sendPasswordReset(message: PasswordResetEmail): Promise<void>;
  sendVerification(message: EmailLink): Promise<void>;
  sendPasswordChanged(message: PasswordChangedEmail): Promise<void>;
  sendTest(message: EmailReader & { eventId: string }): Promise<EmailReceipt | undefined>;
};
export type EmailSenderOptions = {
  config: Pick<ServerEnv, 'APP_ENV' | 'RESEND_API_KEY' | 'EMAIL_FROM'>;
  logger: Logger;
  fetch?: typeof fetch;
};

export function createEmailSender({
  config,
  logger,
  fetch: fetchImpl,
}: EmailSenderOptions): EmailSender {
  const send = fetchImpl ?? ((input, init) => fetch(input, init));
  const canDeliver = Boolean(config.RESEND_API_KEY && config.EMAIL_FROM);
  async function deliver(
    category: string,
    to: string,
    content: EmailContent,
    event: string,
  ): Promise<EmailReceipt | undefined> {
    if (!canDeliver) {
      if (config.APP_ENV === 'development') {
        logger.info('email not sent (development only)', {
          category,
          reason: 'provider_not_configured',
        });
        return undefined;
      }
      throw new AppError('SERVICE_UNAVAILABLE', 'E-mail delivery is not configured.');
    }
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(event));
    const eventHash = Array.from(new Uint8Array(hash), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    let response: Response;
    try {
      response = await send('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.RESEND_API_KEY}`,
          'content-type': 'application/json',
          'Idempotency-Key': `${category}/${eventHash}`,
        },
        body: JSON.stringify({
          from: config.EMAIL_FROM,
          to: [to],
          ...content,
          tags: [{ name: 'category', value: category }],
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      logger.error('email delivery failed', { provider: 'resend', category, reason: 'network' });
      throw new AppError('UPSTREAM_ERROR', 'Could not send the e-mail.');
    }
    if (!response.ok) {
      logger.error('email delivery failed', {
        provider: 'resend',
        category,
        status: response.status,
      });
      throw new AppError('UPSTREAM_ERROR', 'Could not send the e-mail.');
    }
    const payload: unknown = await response.json().catch(() => undefined);
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('id' in payload) ||
      typeof payload.id !== 'string' ||
      !payload.id
    ) {
      logger.error('email delivery failed', {
        provider: 'resend',
        category,
        reason: 'invalid_response',
      });
      throw new AppError('UPSTREAM_ERROR', 'Could not confirm e-mail acceptance.');
    }
    logger.info('email accepted by provider', {
      provider: 'resend',
      category,
      emailId: payload.id,
    });
    return { id: payload.id, provider: 'resend' };
  }
  return {
    canDeliver,
    async sendPasswordReset(message) {
      await deliver('password-reset', message.to, passwordResetContent(message), message.url);
    },
    async sendVerification(message) {
      await deliver('verify-email', message.to, verificationContent(message), message.url);
    },
    async sendPasswordChanged(message) {
      await deliver(
        'password-changed',
        message.to,
        passwordChangedContent(message),
        message.eventId,
      );
    },
    async sendTest(message) {
      return deliver('delivery-test', message.to, testEmailContent(message), message.eventId);
    },
  };
}
