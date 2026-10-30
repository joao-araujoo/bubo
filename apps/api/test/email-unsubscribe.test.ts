import { errorResponseSchema, readerPreferencesSchema } from '@bubo/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createUnsubscribeToken,
  unsubscribeUrl,
  verifyUnsubscribeToken,
} from '../src/services/email-consent';
import { createHarness, TEST_SECRET } from './harness';

let h: Awaited<ReturnType<typeof createHarness>>;
beforeAll(async () => {
  h = await createHarness();
}, 60_000);
afterAll(async () => {
  await h.close();
});

async function reader() {
  const { cookie } = await h.signUp();
  const me = (await (await h.call('/v1/me', { cookie })).json()) as { user: { id: string } };
  return { cookie, userId: me.user.id };
}

describe('unsubscribe tokens', () => {
  it('round-trips and rejects tampering, other secrets and garbage', async () => {
    const token = await createUnsubscribeToken(TEST_SECRET, 'user-1');
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(await verifyUnsubscribeToken(TEST_SECRET, token)).toBe('user-1');
    expect(await verifyUnsubscribeToken(`${TEST_SECRET}x`, token)).toBeNull();
    const [id, signature] = token.split('.');
    const other = await createUnsubscribeToken(TEST_SECRET, 'user-2');
    expect(
      await verifyUnsubscribeToken(TEST_SECRET, `${other.split('.')[0]}.${signature}`),
    ).toBeNull();
    expect(await verifyUnsubscribeToken(TEST_SECRET, `${id}.${signature}x`)).toBeNull();
    for (const bad of ['', 'abc', 'a.b.c', '..', `${id}.`, '%%%.%%%']) {
      expect(await verifyUnsubscribeToken(TEST_SECRET, bad)).toBeNull();
    }
    expect(unsubscribeUrl('https://api.bubo.example', token)).toBe(
      `https://api.bubo.example/v1/email/unsubscribe?token=${token}`,
    );
  });
});

describe('GET/POST /v1/email/unsubscribe', () => {
  it('turns the optional e-mail off from the page and from the one-click header', async () => {
    const { cookie, userId } = await reader();
    const before = readerPreferencesSchema.parse(
      await (await h.call('/v1/me/preferences', { cookie })).json(),
    );
    expect(before.emailReadingReminders).toBe(true);

    const token = await createUnsubscribeToken(TEST_SECRET, userId);
    const page = await h.call(`/v1/email/unsubscribe?token=${encodeURIComponent(token)}`, {
      appOrigin: null,
    });
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(await page.text()).toContain('Sem mais lembretes por e-mail');
    const after = readerPreferencesSchema.parse(
      await (await h.call('/v1/me/preferences', { cookie })).json(),
    );
    expect(after).toEqual({ ...before, emailReadingReminders: false });

    const oneClick = await h.call(`/v1/email/unsubscribe?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      appOrigin: null,
      body: 'List-Unsubscribe=One-Click',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(oneClick.status).toBe(200);
    expect(await oneClick.json()).toEqual({ unsubscribed: true });
    expect(h.logs.lines.join('\n')).not.toContain(token);
  });

  it('rejects invalid links and tolerates accounts that no longer exist', async () => {
    for (const query of ['', '?token=', '?token=abc', '?token=a.b']) {
      const response = await h.call(`/v1/email/unsubscribe${query}`, { appOrigin: null });
      expect(response.status).toBe(400);
      expect(errorResponseSchema.parse(await response.json()).error.code).toBe('BAD_REQUEST');
    }
    const gone = await createUnsubscribeToken(TEST_SECRET, 'deleted-user');
    const response = await h.call(`/v1/email/unsubscribe?token=${encodeURIComponent(gone)}`, {
      appOrigin: null,
    });
    expect(response.status).toBe(200);
  });

  it('keeps older apps working: preferences saved without the new field default to on', async () => {
    const { cookie } = await reader();
    const legacy = {
      reviewIntensity: 'balanced',
      dailyReviewLimit: 20,
      dailyFocusMinutes: 20,
      annualBookGoal: null,
      reviewReminder: false,
      reminderHour: 19,
      timeZone: 'America/Sao_Paulo',
      notifyCommunity: true,
      notifyFriends: true,
    };
    const saved = await h.call('/v1/me/preferences', { method: 'PUT', cookie, json: legacy });
    expect(saved.status).toBe(200);
    expect(readerPreferencesSchema.parse(await saved.json()).emailReadingReminders).toBe(true);
    const off = await h.call('/v1/me/preferences', {
      method: 'PUT',
      cookie,
      json: { ...legacy, emailReadingReminders: false },
    });
    expect(readerPreferencesSchema.parse(await off.json()).emailReadingReminders).toBe(false);
  });
});
