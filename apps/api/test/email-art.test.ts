import { API_ROUTE_DEFINITIONS, API_ROUTES, errorResponseSchema } from '@bubo/contracts';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app';
import { emailArt } from '../src/services/email-artwork.generated';
import { hostedEmailArt, loginCodeContent } from '../src/services/email-templates';
import { createBindings } from './helpers';

/**
 * ADR-041: e-mail pictures are small hosted files with content-hashed names, served by the API
 * without a session or a database, and cacheable forever by mail-client image proxies.
 */
function setup() {
  const databaseProvider = vi.fn(() => {
    throw new Error('the e-mail art route must not open the database');
  });
  return { app: createApp({ databaseProvider }), databaseProvider };
}

describe('GET /v1/email/art/:file', () => {
  it('serves every picture as an immutable PNG without touching the database', async () => {
    const { app, databaseProvider } = setup();
    for (const art of Object.values(emailArt)) {
      const response = await app.request(`/v1/email/art/${art.file}`, {}, createBindings());
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/png');
      expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
      // Mail clients and webmails embed them from other origins.
      expect(response.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
      const bytes = new Uint8Array(await response.arrayBuffer());
      expect(Buffer.from(bytes.subarray(1, 4)).toString()).toBe('PNG');
      expect(Buffer.from(bytes).toString('base64')).toBe(art.png);
    }
    expect(databaseProvider).not.toHaveBeenCalled();
  });

  it('answers 404 for unknown or stale names and keeps other routes same-origin', async () => {
    const { app } = setup();
    for (const file of ['nope.png', 'logo.png', 'logo.0000000000.png', '..%2Fsecret']) {
      const response = await app.request(`/v1/email/art/${file}`, {}, createBindings());
      expect(response.status).toBe(404);
      expect(errorResponseSchema.parse(await response.json()).error.code).toBe('NOT_FOUND');
    }
    const health = await app.request('/v1/health', {}, createBindings());
    expect(health.headers.get('cross-origin-resource-policy')).toBe('same-origin');
  });

  it('names files by content hash and keeps each e-mail light', () => {
    for (const [name, art] of Object.entries(emailArt)) {
      expect(art.file).toMatch(new RegExp(`^${name}\\.[0-9a-f]{10}\\.png$`));
    }
    const heaviestHero = Math.max(
      ...Object.entries(emailArt)
        .filter(([name]) => name.startsWith('hero-'))
        .map(([, art]) => Buffer.from(art.png, 'base64').length),
    );
    const logo = Buffer.from(emailArt.logo.png, 'base64').length;
    expect(heaviestHero + logo).toBeLessThan(60_000);
  });

  it('is a public, documented route', () => {
    const route = API_ROUTE_DEFINITIONS.find((item) => item.path === API_ROUTES.emailArt);
    expect(route).toMatchObject({ method: 'get', auth: false });
    expect(route?.responses[200]?.contentType).toBe('image/png');
  });

  it('points e-mails at absolute https URLs of this route', () => {
    const art = hostedEmailArt('https://api.bubo.example/');
    const content = loginCodeContent({ to: 'a@b.c', name: 'Ana', code: '482913' }, art);
    const sources = [...content.html.matchAll(/<img src="([^"]+)"/g)].map((match) => match[1]);
    expect(sources).toEqual([
      `https://api.bubo.example/v1/email/art/${emailArt['hero-confident'].file}`,
      `https://api.bubo.example/v1/email/art/${emailArt.logo.file}`,
    ]);
  });
});
