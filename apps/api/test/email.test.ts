import { createMockFetch, jsonResponse } from '@bubo/testing';
import { describe, expect, it } from 'vitest';

import { createLogger } from '../src/lib/logger';
import { createEmailSender, passwordResetContent } from '../src/services/email';
import {
  accountDeletedContent,
  loginCodeContent,
  passwordResetCodeContent,
  readingReturnContent,
  verificationContent,
  passwordChangedContent,
  testEmailContent,
} from '../src/services/email-templates';
import { emailArt } from '../src/services/email-artwork.generated';
import { createLogCollector } from './helpers';

const readingReturn = {
  to: 'ana@example.test',
  name: 'Ana',
  bookTitle: 'Duna <b>',
  currentPage: 142,
  totalPages: 680,
  daysAway: 10,
  bookUrl: 'bubo:///livro/entry-1',
  unsubscribeUrl: 'https://api.bubo.example/v1/email/unsubscribe?token=abc.def',
};

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

  it('points pictures at EMAIL_ART_BASE_URL when local development sets it', async () => {
    const fetchMock = createMockFetch(() => jsonResponse({ id: 'email_1' }));
    const sender = createEmailSender({
      config: {
        APP_ENV: 'development',
        RESEND_API_KEY: 'key',
        EMAIL_FROM: 'Bubo <a@b.c>',
        BETTER_AUTH_URL: 'http://192.168.0.10:8787',
        EMAIL_ART_BASE_URL: 'https://bubo-api.example.workers.dev/',
      },
      logger: createLogger({}, createLogCollector().sink),
      fetch: fetchMock,
    });
    await sender.sendPasswordReset(message);
    const html = String(
      (JSON.parse(fetchMock.calls[0]?.body ?? '{}') as Record<string, unknown>).html,
    );
    expect(html).toContain(
      `<img src="https://bubo-api.example.workers.dev/v1/email/art/${emailArt.logo.file}"`,
    );
    expect(html).not.toContain('192.168.0.10');
  });

  it('uses stable hashed event keys and hosted artwork, without leaking reset links to logs', async () => {
    const fetchMock = createMockFetch(() => jsonResponse({ id: 'email_1' }));
    const logs = createLogCollector();
    const sender = createEmailSender({
      config: {
        APP_ENV: 'production',
        RESEND_API_KEY: 'key',
        EMAIL_FROM: 'Bubo <a@b.c>',
        BETTER_AUTH_URL: 'https://api.bubo.example',
      },
      logger: createLogger({}, logs.sink),
      fetch: fetchMock,
    });
    await sender.sendPasswordReset(message);
    await sender.sendPasswordReset(message);
    const key = fetchMock.calls[0]?.headers.get('idempotency-key');
    expect(key).toMatch(/^password-reset\/[a-f0-9]{64}$/);
    expect(fetchMock.calls[1]?.headers.get('idempotency-key')).toBe(key);
    // ADR-041: no attachments; small pictures hosted by the API, referenced by absolute URL.
    const body = JSON.parse(fetchMock.calls[0]?.body ?? '{}') as Record<string, unknown>;
    expect(body).not.toHaveProperty('attachments');
    expect(String(body.html)).not.toContain('cid:');
    expect(String(body.html)).toContain(
      `<img src="https://api.bubo.example/v1/email/art/${emailArt['hero-doubt'].file}"`,
    );
    expect(String(body.html)).toContain(
      `<img src="https://api.bubo.example/v1/email/art/${emailArt.logo.file}"`,
    );
    // A few KB per message (it used to carry ~560 KB of base64 attachments).
    expect(fetchMock.calls[0]?.body?.length ?? Infinity).toBeLessThan(16_000);
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
      accountDeletedContent(message),
      loginCodeContent({ ...message, code: '482913' }),
      passwordResetCodeContent({ ...message, code: '482913' }),
      readingReturnContent(readingReturn),
      testEmailContent(message),
    ]) {
      expect(content.html).toContain('lang="pt-BR"');
      expect(content.html).toContain('role="presentation"');
      expect(content.html).toContain('mso-hide:all');
      expect(content).not.toHaveProperty('attachments');
      expect(content.html).not.toContain('cid:');
      const images = [
        ...content.html.matchAll(/<img src="([^"]+)" width="(\d+)" height="(\d+)" alt="([^"]*)"/g),
      ];
      expect(images.map((image) => image[1])).toEqual([
        expect.stringMatching(
          /^http:\/\/localhost:8787\/v1\/email\/art\/hero-[a-z]+\.[0-9a-f]{10}\.png$/,
        ),
        `http://localhost:8787/v1/email/art/${emailArt.logo.file}`,
      ]);
      // Without images the layout keeps its size and the logo still reads "Bubo".
      expect(images[1]?.[4]).toBe('Bubo');
      expect(content.text).toContain('Olá, Ana!');
      expect(content.html.length).toBeLessThan(12_000);
      // The Duolingo lesson: one headline, one action at most, a short body.
      expect(content.html.match(/<h1/g)).toHaveLength(1);
      expect((content.html.match(/<a href/g) ?? []).length).toBeLessThanOrEqual(3);
    }
  });

  it('puts the code in the subject and the body, grouped for reading, never in a button', () => {
    const login = loginCodeContent({ ...message, code: '482913' });
    expect(login.subject).toBe('482913 é o seu código de entrada no Bubo');
    expect(login.html).toContain('482 913');
    expect(login.text).toContain('Seu código: 482 913');
    expect(login.html).not.toContain('<a href');
    expect(login.html).toContain('Vale por 10 minutos');
    expect(login.headers).toBeUndefined();
    const reset = passwordResetCodeContent({ ...message, code: '000123' });
    expect(reset.subject).toContain('000123');
    expect(reset.html).toContain('000 123');
    expect(reset.html).not.toContain('<a href');
  });

  it('builds the reading-return e-mail from real numbers with a working opt-out', () => {
    const content = readingReturnContent(readingReturn);
    expect(content.subject).toContain('guardou a página');
    expect(content.html).toContain('A página 142 ficou esperando.');
    expect(content.html).toContain('<strong>10 dias</strong>');
    expect(content.html).toContain('<strong>Duna &lt;b&gt;</strong>');
    expect(content.html).not.toContain('<b>');
    expect(content.html).toContain('Página <strong>142</strong> de 680 · 21% lido');
    expect(content.html).toContain('href="bubo:///livro/entry-1"');
    expect(content.html).toContain('Não quero mais e-mails como este');
    expect(content.text).toContain('Faz 10 dias que o Bubo não te vê por aqui');
    expect(content.text).toContain(readingReturn.unsubscribeUrl);
    expect(content.headers).toEqual({
      'List-Unsubscribe': `<${readingReturn.unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
    const unknownPages = readingReturnContent({
      ...readingReturn,
      totalPages: null,
      currentPage: 0,
    });
    expect(unknownPages.html).toContain('Seu livro ficou esperando.');
    expect(unknownPages.html).not.toContain('% lido');
    expect(() =>
      readingReturnContent({ ...readingReturn, unsubscribeUrl: 'javascript:x' }),
    ).toThrow();
  });

  it('sends List-Unsubscribe headers to the provider and keeps codes out of idempotency keys', async () => {
    const fetchMock = createMockFetch(() => jsonResponse({ id: 'email_9' }));
    const sender = createEmailSender({
      config: { APP_ENV: 'production', RESEND_API_KEY: 'key', EMAIL_FROM: 'Bubo <a@b.c>' },
      logger: createLogger({}, () => undefined),
      fetch: fetchMock,
    });
    await sender.sendReadingReturn({ ...readingReturn, eventId: 'user-1:2026-10-12' });
    const body = JSON.parse(fetchMock.calls[0]?.body ?? '{}') as {
      headers?: Record<string, string>;
      subject: string;
    };
    expect(body.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(fetchMock.calls[0]?.headers.get('idempotency-key')).toMatch(/^reading-return\//);
    await sender.sendLoginCode({ ...message, code: '482913' });
    await sender.sendLoginCode({ ...message, code: '482913' });
    const keys = fetchMock.calls.slice(1).map((call) => call.headers.get('idempotency-key'));
    expect(keys[0]).toMatch(/^login-code\/[a-f0-9]{64}$/);
    expect(keys[0]).not.toBe(keys[1]);
    expect(keys.join()).not.toContain('482913');
  });
});
