import { type ServerEnv } from '@bubo/config';
import { AppError } from '../lib/errors';
import { type Logger } from '../lib/logger';
import {
  type EmailCode,
  type EmailContent,
  type EmailLink,
  hostedEmailArt,
  type EmailReader,
  type ReadingReturnEmail,
  accountDeletedContent,
  loginCodeContent,
  passwordResetCodeContent,
  passwordResetContent,
  verificationContent,
  passwordChangedContent,
  readingReturnContent,
  testEmailContent,
} from './email-templates';

export { passwordResetContent } from './email-templates';
export type PasswordResetEmail = EmailLink;
export type EmailReceipt = { id: string; provider: 'resend' };
export type PasswordChangedEmail = EmailReader & { eventId: string };
export type AccountDeletedEmail = EmailReader & { eventId: string };
export type ReadingReturnMessage = ReadingReturnEmail & { eventId: string };
export type EmailSender = {
  readonly canDeliver: boolean;
  sendPasswordReset(message: PasswordResetEmail): Promise<void>;
  sendVerification(message: EmailLink): Promise<void>;
  sendPasswordChanged(message: PasswordChangedEmail): Promise<void>;
  /** Sign-in second step (ADR-038). The code is never logged. */
  sendLoginCode(message: EmailCode): Promise<void>;
  /** Password reset typed in the app (ADR-038). The code is never logged. */
  sendPasswordResetCode(message: EmailCode): Promise<void>;
  sendAccountDeleted(message: AccountDeletedEmail): Promise<void>;
  /** Optional, consent-based (ADR-038); the receipt is kept so the cooldown is enforceable. */
  sendReadingReturn(message: ReadingReturnMessage): Promise<EmailReceipt | undefined>;
  sendTest(message: EmailReader & { eventId: string }): Promise<EmailReceipt | undefined>;
};
export type EmailSenderOptions = {
  /**
   * `BETTER_AUTH_URL` is the API's public URL: e-mail pictures are served from it (ADR-041),
   * unless `EMAIL_ART_BASE_URL` points them elsewhere (local development).
   */
  config: Pick<ServerEnv, 'APP_ENV' | 'RESEND_API_KEY' | 'EMAIL_FROM'> &
    Partial<Pick<ServerEnv, 'BETTER_AUTH_URL' | 'EMAIL_ART_BASE_URL'>>;
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
  // Same fallback as Better Auth's base URL; production requires an https BETTER_AUTH_URL.
  const art = hostedEmailArt(
    config.EMAIL_ART_BASE_URL ?? config.BETTER_AUTH_URL ?? 'http://localhost:8787',
  );
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
    const { headers, ...message } = content;
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
          ...message,
          ...(headers ? { headers } : {}),
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
      await deliver('password-reset', message.to, passwordResetContent(message, art), message.url);
    },
    async sendVerification(message) {
      await deliver('verify-email', message.to, verificationContent(message, art), message.url);
    },
    async sendPasswordChanged(message) {
      await deliver(
        'password-changed',
        message.to,
        passwordChangedContent(message, art),
        message.eventId,
      );
    },
    async sendLoginCode(message) {
      // Codes are never retried, so each send is its own event; the key never carries the code.
      await deliver('login-code', message.to, loginCodeContent(message, art), crypto.randomUUID());
    },
    async sendPasswordResetCode(message) {
      await deliver(
        'password-reset-code',
        message.to,
        passwordResetCodeContent(message, art),
        crypto.randomUUID(),
      );
    },
    async sendAccountDeleted(message) {
      await deliver(
        'account-deleted',
        message.to,
        accountDeletedContent(message, art),
        message.eventId,
      );
    },
    async sendReadingReturn(message) {
      return deliver(
        'reading-return',
        message.to,
        readingReturnContent(message, art),
        message.eventId,
      );
    },
    async sendTest(message) {
      return deliver('delivery-test', message.to, testEmailContent(message, art), message.eventId);
    },
  };
}
