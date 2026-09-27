import { createMockFetch, jsonResponse } from '@bubo/testing';
import { describe, expect, it } from 'vitest';

import { createLogger } from '../src/lib/logger';
import { createEmailSender, passwordResetContent } from '../src/services/email';
import { createLogCollector } from './helpers';

const message = {
  to: 'ana@example.test',
  name: 'Ana <script>',
  url: 'https://api.bubo.example/v1/auth/reset-password/tok?callbackURL=bubo%3A%2F%2Fredefinir-senha',
};

describe('email sender', () => {
  it('sends through Resend when configured (key in a header, never logged)', async () => {
    const fetchMock = createMockFetch(() => jsonResponse({ id: 'email_1' }));
    const logs = createLogCollector();
    const sender = createEmailSender({
      config: {
        APP_ENV: 'production',
        RESEND_API_KEY: 're_secret_key',
        EMAIL_FROM: 'Bubo <nao-responda@bubo.example>',
      },
      logger: createLogger({}, logs.sink),
      fetch: fetchMock,
    });
    await sender.sendPasswordReset(message);
    const call = fetchMock.calls[0];
    expect(call?.url).toBe('https://api.resend.com/emails');
    expect(call?.headers.get('authorization')).toBe('Bearer re_secret_key');
    const body = JSON.parse(call?.body ?? '{}') as {
      to: string[];
      from: string;
      subject: string;
      html: string;
    };
    expect(body).toMatchObject({
      to: ['ana@example.test'],
      from: 'Bubo <nao-responda@bubo.example>',
    });
    expect(body.html).not.toContain('<script>');
    expect(logs.lines.join('\n')).not.toContain('re_secret_key');
  });

  it('fails loudly when the provider rejects the e-mail', async () => {
    const sender = createEmailSender({
      config: { APP_ENV: 'production', RESEND_API_KEY: 'k', EMAIL_FROM: 'a@b.c' },
      logger: createLogger({}, () => undefined),
      fetch: createMockFetch(() => new Response('{}', { status: 422 })),
    });
    await expect(sender.sendPasswordReset(message)).rejects.toMatchObject({
      code: 'UPSTREAM_ERROR',
    });
  });

  it('logs the link only in development and refuses elsewhere without a provider', async () => {
    const logs = createLogCollector();
    const dev = createEmailSender({
      config: { APP_ENV: 'development', RESEND_API_KEY: undefined, EMAIL_FROM: undefined },
      logger: createLogger({}, logs.sink),
    });
    await dev.sendPasswordReset(message);
    expect(logs.lines.join('\n')).toContain('password reset link (development only)');

    const preview = createEmailSender({
      config: { APP_ENV: 'preview', RESEND_API_KEY: undefined, EMAIL_FROM: undefined },
      logger: createLogger({}, () => undefined),
    });
    await expect(preview.sendPasswordReset(message)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  it('writes a pt-BR message with a greeting and the link', () => {
    const content = passwordResetContent({ ...message, name: 'Ana Leitora' });
    expect(content.subject).toBe('Redefina sua senha do Bubo');
    expect(content.text).toContain('Olá, Ana!');
    expect(content.text).toContain(message.url);
  });
});
