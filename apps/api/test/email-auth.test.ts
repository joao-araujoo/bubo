import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type EmailLink } from '../src/services/email-templates';
import { type PasswordChangedEmail } from '../src/services/email';
import { createHarness } from './harness';

let h: Awaited<ReturnType<typeof createHarness>>;
const verifications: EmailLink[] = [];
const resets: EmailLink[] = [];
const changes: PasswordChangedEmail[] = [];
let rejectVerification = false;
let rejectChange = false;
let counter = 0;
beforeAll(async () => {
  h = await createHarness({
    emailSender: () => ({
      canDeliver: true,
      async sendVerification(message) {
        if (rejectVerification) throw new Error('provider down');
        verifications.push(message);
      },
      async sendPasswordReset(message) {
        resets.push(message);
      },
      async sendPasswordChanged(message) {
        if (rejectChange) throw new Error('provider down');
        changes.push(message);
      },
      sendTest: async () => undefined,
    }),
  });
}, 60_000);
afterAll(async () => {
  await h.close();
});

async function reader() {
  counter += 1;
  const email = `email-flow${counter}@example.test`;
  const response = await h.call('/v1/auth/sign-up/email', {
    method: 'POST',
    ip: `10.4.0.${counter}`,
    json: { name: 'Ana', email, password: 'senha-forte-123' },
  });
  expect(response.status).toBe(200);
  const cookie =
    response.headers
      .getSetCookie()
      .find((value) => value.startsWith('better-auth.session_token='))
      ?.split(';')[0] ?? '';
  expect(cookie).not.toBe('');
  return { email, cookie, ip: `10.4.0.${counter}` };
}

describe('transactional email lifecycle', () => {
  it('sends one combined welcome/verification without blocking sign-in, and verifies a real signed link', async () => {
    const user = await reader();
    const sent = verifications.filter((message) => message.to === user.email);
    expect(sent).toHaveLength(1);
    expect((await h.call('/v1/me', { cookie: user.cookie })).status).toBe(200);
    const link = new URL(sent[0]?.url ?? 'http://invalid');
    expect(link.searchParams.get('callbackURL')).toBe('bubo:///');
    const tampered = new URL(link);
    tampered.searchParams.set('callbackURL', 'https://evil.example');
    expect((await h.call(`${tampered.pathname}${tampered.search}`, { ip: user.ip })).status).toBe(
      403,
    );
    const verified = await h.call(`${link.pathname}${link.search}`, { ip: user.ip });
    expect(verified.status).toBe(302);
    expect(verified.headers.get('location')).toBe('bubo:///');
    const session = await h.call('/v1/auth/get-session', { cookie: user.cookie });
    expect(await session.json()).toMatchObject({ user: { emailVerified: true } });
  });

  it('keeps a created account usable if the optional signup email fails', async () => {
    rejectVerification = true;
    try {
      const user = await reader();
      expect((await h.call('/v1/me', { cookie: user.cookie })).status).toBe(200);
    } finally {
      rejectVerification = false;
    }
  });

  it('limits manual verification resends and preserves callback protection', async () => {
    const user = await reader();
    const blocked = await h.call('/v1/auth/send-verification-email', {
      method: 'POST',
      ip: user.ip,
      json: { email: user.email, callbackURL: 'https://evil.example' },
    });
    expect(blocked.status).toBe(403);
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      statuses.push(
        (
          await h.call('/v1/auth/send-verification-email', {
            method: 'POST',
            ip: user.ip,
            json: { email: user.email, callbackURL: 'bubo:///' },
          })
        ).status,
      );
    }
    expect(statuses).toEqual([200, 200, 200, 429]);
  });

  it.each([false, true])(
    'changes the password and revokes old sessions even when security email fails=%s',
    async (fails) => {
      const user = await reader();
      const requested = await h.call('/v1/auth/request-password-reset', {
        method: 'POST',
        ip: user.ip,
        json: { email: user.email, redirectTo: 'bubo:///redefinir-senha' },
      });
      expect(requested.status).toBe(200);
      const message = resets.find((value) => value.to === user.email);
      const token = new URL(message?.url ?? 'http://invalid').pathname.split('/').pop();
      rejectChange = fails;
      try {
        const reset = await h.call('/v1/auth/reset-password', {
          method: 'POST',
          ip: user.ip,
          json: { token, newPassword: 'nova-senha-segura-456' },
        });
        expect(reset.status).toBe(200);
      } finally {
        rejectChange = false;
      }
      expect(changes.filter((message) => message.to === user.email)).toHaveLength(fails ? 0 : 1);
      expect((await h.call('/v1/me', { cookie: user.cookie })).status).toBe(401);
      const login = await h.call('/v1/auth/sign-in/email', {
        method: 'POST',
        ip: user.ip,
        json: { email: user.email, password: 'nova-senha-segura-456' },
      });
      expect(login.status).toBe(200);
      const replay = await h.call('/v1/auth/reset-password', {
        method: 'POST',
        ip: user.ip,
        json: { token, newPassword: 'outra-senha-segura-789' },
      });
      expect(replay.status).toBe(400);
    },
  );
});
