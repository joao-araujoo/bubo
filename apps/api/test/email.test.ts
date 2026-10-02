import { createMockFetch, jsonResponse } from '@bubo/testing';
import { describe, expect, it } from 'vitest';

import { createLogger } from '../src/lib/logger';
import { createEmailSender, passwordResetContent } from '../src/services/email';
import {
  verificationContent,
  passwordChangedContent,
  testEmailContent,
} from '../src/services/email-templates';
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
    expect(logs.lines.join('\n')).toContain('email not sent (development only)');
    expect(logs.lines.join('\n')).not.toContain(message.url);

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

  it('uses stable hashed event keys and inline official artwork, without leaking reset links to logs', async () => {
    const fetchMock = createMockFetch(() => jsonResponse({ id: 'email_1' }));
    const logs = createLogCollector();
    const sender = createEmailSender({
      config: { APP_ENV: 'production', RESEND_API_KEY: 'key', EMAIL_FROM: 'Bubo <a@b.c>' },
      logger: createLogger({}, logs.sink),
      fetch: fetchMock,
    });
    await sender.sendPasswordReset(message);
    await sender.sendPasswordReset(message);
    const key = fetchMock.calls[0]?.headers.get('idempotency-key');
    expect(key).toMatch(/^password-reset\/[a-f0-9]{64}$/);
    expect(fetchMock.calls[1]?.headers.get('idempotency-key')).toBe(key);
    const content = passwordResetContent(message);
    for (const attachment of content.attachments) {
      expect(content.html).toContain(`cid:${attachment.content_id}`);
      expect(Buffer.from(attachment.content, 'base64').subarray(1, 4).toString()).toBe('PNG');
    }
    const logged = logs.lines.join('\n');
    expect(logged).not.toContain(message.url);
    expect(logged).not.toContain(message.to);
    expect(logged).toContain('email_1');
  });

  it('rejects network errors, quota rejection and malformed acceptance instead of claiming delivery', async () => {
    for (const upstream of [
      async () => {
        throw new Error('private upstream details');
      },
      async () => new Response('{}', { status: 429 }),
      async () => jsonResponse({}),
    ]) {
      const logs = createLogCollector();
      const sender = createEmailSender({
        config: { APP_ENV: 'production', RESEND_API_KEY: 'private-key', EMAIL_FROM: 'a@b.c' },
        logger: createLogger({}, logs.sink),
        fetch: createMockFetch(upstream),
      });
      await expect(sender.sendPasswordReset(message)).rejects.toMatchObject({
        code: 'UPSTREAM_ERROR',
      });
      expect(logs.lines.join('\n')).not.toContain('private');
    }
  });

  it('escapes untrusted names and href values and rejects executable actions', () => {
    const content = passwordResetContent({
      ...message,
      name: '<script>alert(1)</script>',
      url: 'https://example.test/reset?a=1&b="quoted"',
    });
    expect(content.html).toContain('&lt;script&gt;');
    expect(content.html).not.toContain('<script>');
    expect(content.html).toContain('&amp;b=&quot;quoted&quot;');
    expect(() => passwordResetContent({ ...message, url: 'javascript:alert(1)' })).toThrow();
  });

  it('provides text, preheaders, accessible layouts and one clear action for each transaction', () => {
    for (const content of [
      passwordResetContent(message),
      verificationContent(message),
      passwordChangedContent(message),
      testEmailContent(message),
    ]) {
      expect(content.html).toContain('lang="pt-BR"');
      expect(content.html).toContain('role="presentation"');
      expect(content.html).toContain('mso-hide:all');
      expect(content.attachments).toHaveLength(2);
      expect(content.text).toContain('Olá, Ana!');
      expect(content.html.length).toBeLessThan(12_000);
    }
  });
});
