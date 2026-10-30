import { API_ROUTES, type EmailUnsubscribeResponse } from '@bubo/contracts';
import { type Context, Hono } from 'hono';

import { type AppEnv } from '../env';
import { AppError } from '../lib/errors';
import { createRateLimiter } from '../lib/rate-limit';
import { emailArt, emailPalette as p } from '../services/email-artwork.generated';
import { unsubscribeReadingReminders, verifyUnsubscribeToken } from '../services/email-consent';

/** Small confirmation page for readers who tap the link in an e-mail client (same look as the e-mails). */
function confirmationPage(): string {
  const hero = emailArt['hero-neutral'];
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Bubo</title></head>
<body style="margin:0;padding:40px 20px;background:${p.white};color:${p.ink};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.6">
<main style="max-width:480px;margin:0 auto;text-align:center">
<img src="art/${hero.file}" width="${hero.width}" height="${hero.height}" alt="" style="display:block;margin:0 auto;max-width:100%;height:auto">
<p style="margin:28px 0 12px;color:${p.purple};font-size:12px;font-weight:700;letter-spacing:2.5px">E-MAILS DO BUBO</p>
<h1 style="margin:0 0 16px;font-size:28px;line-height:1.25;font-weight:800">Pronto. Sem mais lembretes por e-mail.</h1>
<p style="margin:0 0 12px;font-size:16px;color:${p.inkMuted}">Você não vai mais receber os lembretes de leitura do Bubo. Os e-mails da conta, como códigos de entrada e avisos de segurança, continuam chegando.</p>
<p style="margin:24px 0 0;padding-top:20px;border-top:1px solid ${p.line};font-size:14px;color:${p.inkMuted}">Mudou de ideia? Abra o Bubo → Você → Configurações → E-mails do Bubo.</p>
</main>
</body></html>`;
}

/** Decoded e-mail pictures by file name (decoded once per isolate). */
const artFiles = new Map<string, string>(Object.values(emailArt).map((art) => [art.file, art.png]));
const artBytes = new Map<string, Uint8Array<ArrayBuffer>>();
function emailPicture(file: string): Uint8Array<ArrayBuffer> | null {
  const cached = artBytes.get(file);
  if (cached) return cached;
  const base64 = artFiles.get(file);
  if (!base64) return null;
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  artBytes.set(file, bytes);
  return bytes;
}

/**
 * Public one-click opt-out for optional e-mails (ADR-038). The token is an HMAC over the reader
 * id; anything else answers 400. GET shows a page (e-mail clients), POST is RFC 8058 one-click.
 */
export function emailRoutes(deps: { now: () => Date }) {
  const routes = new Hono<AppEnv>();
  const limiter = createRateLimiter({
    limit: 20,
    windowMs: 60_000,
    now: () => deps.now().getTime(),
    message: 'Too many requests. Try again in a moment.',
  });

  async function optOut(c: Context<AppEnv>) {
    const config = c.get('config');
    if (!config.ok || !config.env.BETTER_AUTH_SECRET) {
      throw new AppError('SERVICE_UNAVAILABLE', 'Service configuration is invalid.');
    }
    limiter.hit(c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown');
    const userId = await verifyUnsubscribeToken(
      config.env.BETTER_AUTH_SECRET,
      c.req.query('token') ?? '',
    );
    if (!userId) throw new AppError('BAD_REQUEST', 'This unsubscribe link is not valid.');
    const applied = await unsubscribeReadingReminders(c.get('db'), userId);
    // Ids only; a deleted account has nothing left to opt out of and sees the same page.
    c.get('logger').info('email opt-out', { userId, kind: 'reading_return', applied });
  }

  routes.get(API_ROUTES.emailUnsubscribe, async (c) => {
    await optOut(c);
    return c.html(confirmationPage());
  });

  routes.post(API_ROUTES.emailUnsubscribe, async (c) => {
    await optOut(c);
    const body: EmailUnsubscribeResponse = { unsubscribed: true };
    return c.json(body);
  });

  // Pictures inside e-mails (ADR-041): content-hashed names, so they never change once served.
  routes.get(API_ROUTES.emailArt, (c) => {
    const bytes = emailPicture(c.req.param('file'));
    if (!bytes) throw new AppError('NOT_FOUND', 'Unknown e-mail picture.');
    return c.body(bytes, 200, {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=31536000, immutable',
    });
  });

  return routes;
}
