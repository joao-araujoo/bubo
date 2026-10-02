import { errorResponseSchema, meResponseSchema, shelfResponseSchema } from '@bubo/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPgliteDatabase, PGLITE_DATABASE_URL } from '../dev/pglite';
import { createApp } from '../src/app';
import { type PasswordResetEmail } from '../src/services/email';
import { createBindings, createLogCollector } from './helpers';

const SECRET = 'test-secret-with-at-least-thirty-two-characters';
let database: Awaited<ReturnType<typeof createPgliteDatabase>>;
let app: ReturnType<typeof createApp>;
const sentEmails: PasswordResetEmail[] = [];
const logs = createLogCollector();
let ipCounter = 0;

beforeAll(async () => {
  database = await createPgliteDatabase();
  app = createApp({
    databaseProvider: database.provider,
    pingDatabase: database.ping,
    logSink: logs.sink,
    emailSender: () => ({
      canDeliver: false,
      sendVerification: async () => undefined,
      sendPasswordChanged: async () => undefined,
      sendTest: async () => undefined,
      async sendPasswordReset(message) {
        sentEmails.push(message);
      },
    }),
  });
}, 60_000);

afterAll(async () => {
  await database.close();
});

const env = () =>
  createBindings({
    DATABASE_URL: PGLITE_DATABASE_URL,
    BETTER_AUTH_SECRET: SECRET,
    BETTER_AUTH_URL: 'http://localhost:8787',
  });

/** Each test gets its own client IP so auth rate limits never leak between tests. */
function freshIp() {
  ipCounter += 1;
  return `10.0.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`;
}

/** Emulates the Expo client, which sends `expo-origin: bubo://` (null = no origin at all). */
async function call(
  path: string,
  init: RequestInit & { cookie?: string; ip?: string; appOrigin?: string | null } = {},
) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('content-type', 'application/json');
  if (init.cookie) headers.set('cookie', init.cookie);
  if (init.appOrigin !== null && !headers.has('expo-origin')) {
    headers.set('expo-origin', init.appOrigin ?? 'bubo://');
  }
  headers.set('x-forwarded-for', init.ip ?? '10.255.255.1');
  return app.request(`http://localhost:8787${path}`, { ...init, headers }, env());
}

function sessionCookie(response: Response): string {
  const cookies = response.headers.getSetCookie();
  const session = cookies.find((c) => c.startsWith('better-auth.session_token='));
  if (!session) throw new Error(`No session cookie in: ${cookies.join(' | ')}`);
  return session.split(';')[0] ?? '';
}

let emailCounter = 0;
async function signUp(ip = freshIp()) {
  emailCounter += 1;
  const email = `leitor${emailCounter}@example.test`;
  const response = await call('/v1/auth/sign-up/email', {
    method: 'POST',
    ip,
    body: JSON.stringify({ name: 'Ana Leitora', email, password: 'senha-forte-123' }),
  });
  expect(response.status).toBe(200);
  return { email, cookie: sessionCookie(response), ip };
}

const onboarding = {
  readingHabit: 'daily',
  goals: ['remember_more', 'understand_better', 'remember_more'],
  interests: ['philosophy', 'science_fiction'],
  firstBook: { title: 'O Estrangeiro', author: 'Albert Camus', totalPages: 128 },
};

describe('protected routes', () => {
  it('rejects /v1/me and /v1/shelf without a session (401 envelope)', async () => {
    for (const path of ['/v1/me', '/v1/shelf']) {
      const response = await call(path);
      expect(response.status).toBe(401);
      expect(errorResponseSchema.parse(await response.json()).error.code).toBe('UNAUTHORIZED');
    }
  });

  it('rejects a forged session cookie', async () => {
    const response = await call('/v1/me', { cookie: 'better-auth.session_token=forged.value' });
    expect(response.status).toBe(401);
  });

  it('returns 503 when the database is not configured', async () => {
    const response = await app.request(
      '/v1/me',
      {},
      createBindings({ BETTER_AUTH_SECRET: SECRET }),
    );
    expect(response.status).toBe(503);
    expect(errorResponseSchema.parse(await response.json()).error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('returns 503 when the auth secret is missing', async () => {
    const response = await app.request(
      '/v1/auth/get-session',
      {},
      createBindings({ DATABASE_URL: PGLITE_DATABASE_URL }),
    );
    expect(response.status).toBe(503);
  });
});

describe('sign-up, session and onboarding', () => {
  it('creates an account, signs in automatically and starts with onboarding pending', async () => {
    const { cookie, email } = await signUp();
    const response = await call('/v1/me', { cookie });
    expect(response.status).toBe(200);
    const me = meResponseSchema.parse(await response.json());
    expect(me.user.email).toBe(email);
    expect(me.onboardingCompleted).toBe(false);
    expect(me.profile).toEqual({
      readingHabit: null,
      goals: [],
      interests: [],
      onboardingCompletedAt: null,
    });
  });

  it('rejects duplicate e-mails and weak passwords', async () => {
    const { email, ip } = await signUp();
    const duplicate = await call('/v1/auth/sign-up/email', {
      method: 'POST',
      ip,
      body: JSON.stringify({ name: 'Outra', email, password: 'senha-forte-123' }),
    });
    expect(duplicate.status).toBeGreaterThanOrEqual(400);
    const weak = await call('/v1/auth/sign-up/email', {
      method: 'POST',
      ip,
      body: JSON.stringify({ name: 'Fraca', email: 'fraca@example.test', password: '123' }),
    });
    expect(weak.status).toBe(400);
  });

  it('validates onboarding answers (422 with field paths, no values echoed)', async () => {
    const { cookie } = await signUp();
    const response = await call('/v1/me/onboarding', {
      method: 'PUT',
      cookie,
      body: JSON.stringify({
        ...onboarding,
        goals: [],
        firstBook: { title: 'Segredo123', totalPages: -1 },
      }),
    });
    expect(response.status).toBe(422);
    const body = errorResponseSchema.parse(await response.json());
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.issues?.map((i) => i.path)).toEqual(
      expect.arrayContaining(['goals', 'firstBook.totalPages']),
    );
    expect(JSON.stringify(body)).not.toContain('Segredo123');
  });

  it('rejects malformed JSON', async () => {
    const { cookie } = await signUp();
    const response = await call('/v1/me/onboarding', { method: 'PUT', cookie, body: '{not json' });
    expect(response.status).toBe(400);
  });

  it('completes onboarding with a first book, idempotently', async () => {
    const { cookie } = await signUp();
    const first = await call('/v1/me/onboarding', {
      method: 'PUT',
      cookie,
      body: JSON.stringify(onboarding),
    });
    expect(first.status).toBe(200);
    const me = meResponseSchema.parse(await first.json());
    expect(me.onboardingCompleted).toBe(true);
    expect(me.profile.goals).toEqual(['remember_more', 'understand_better']);
    expect(me.profile.readingHabit).toBe('daily');

    const again = await call('/v1/me/onboarding', {
      method: 'PUT',
      cookie,
      body: JSON.stringify({
        ...onboarding,
        readingHabit: 'weekly',
        firstBook: { title: 'o estrangeiro' },
      }),
    });
    const meAgain = meResponseSchema.parse(await again.json());
    expect(meAgain.profile.readingHabit).toBe('weekly');
    expect(meAgain.profile.onboardingCompletedAt).toBe(me.profile.onboardingCompletedAt);

    const shelf = shelfResponseSchema.parse(await (await call('/v1/shelf', { cookie })).json());
    expect(shelf.entries).toHaveLength(1);
    expect(shelf.entries[0]).toMatchObject({
      status: 'reading',
      currentPage: 0,
      book: { title: 'O Estrangeiro', author: 'Albert Camus', totalPages: 128 },
    });
  });

  it('allows skipping the first book', async () => {
    const { cookie } = await signUp();
    const response = await call('/v1/me/onboarding', {
      method: 'PUT',
      cookie,
      body: JSON.stringify({ ...onboarding, firstBook: null }),
    });
    expect(meResponseSchema.parse(await response.json()).onboardingCompleted).toBe(true);
    const shelf = shelfResponseSchema.parse(await (await call('/v1/shelf', { cookie })).json());
    expect(shelf.entries).toEqual([]);
  });

  it("isolates readers' data", async () => {
    const a = await signUp();
    const b = await signUp();
    await call('/v1/me/onboarding', {
      method: 'PUT',
      cookie: a.cookie,
      body: JSON.stringify(onboarding),
    });
    const shelfB = shelfResponseSchema.parse(
      await (await call('/v1/shelf', { cookie: b.cookie })).json(),
    );
    expect(shelfB.entries).toEqual([]);
  });
});

describe('sign-in, sign-out and password reset', () => {
  it('signs in with the right password only', async () => {
    const { email, ip } = await signUp();
    const wrong = await call('/v1/auth/sign-in/email', {
      method: 'POST',
      ip,
      body: JSON.stringify({ email, password: 'senha-errada-000' }),
    });
    expect(wrong.status).toBe(401);
    const right = await call('/v1/auth/sign-in/email', {
      method: 'POST',
      ip,
      body: JSON.stringify({ email, password: 'senha-forte-123' }),
    });
    expect(right.status).toBe(200);
    expect((await call('/v1/me', { cookie: sessionCookie(right) })).status).toBe(200);
  });

  it('blocks cookie-authenticated auth calls without a trusted origin (CSRF)', async () => {
    const { cookie } = await signUp();
    const noOrigin = await call('/v1/auth/sign-out', {
      method: 'POST',
      cookie,
      body: '{}',
      appOrigin: null,
    });
    expect(noOrigin.status).toBe(403);
    const evil = await call('/v1/auth/sign-out', {
      method: 'POST',
      cookie,
      body: '{}',
      headers: { origin: 'https://evil.example' },
      appOrigin: null,
    });
    expect(evil.status).toBe(403);
    expect((await call('/v1/me', { cookie })).status).toBe(200);
  });

  it('revokes the session on sign-out', async () => {
    const { cookie } = await signUp();
    const out = await call('/v1/auth/sign-out', { method: 'POST', cookie, body: '{}' });
    expect(out.status).toBe(200);
    expect((await call('/v1/me', { cookie })).status).toBe(401);
  });

  it('resets the password through the e-mailed link and revokes old sessions', async () => {
    const { email, cookie, ip } = await signUp();
    const request = await call('/v1/auth/request-password-reset', {
      method: 'POST',
      ip,
      body: JSON.stringify({ email, redirectTo: 'bubo://redefinir-senha' }),
    });
    expect(request.status).toBe(200);
    const message = sentEmails.find((m) => m.to === email);
    expect(message).toBeDefined();
    const token = new URL(message?.url ?? 'http://x').pathname.split('/').pop() ?? '';
    expect(token.length).toBeGreaterThan(10);

    const reset = await call('/v1/auth/reset-password', {
      method: 'POST',
      ip,
      body: JSON.stringify({ token, newPassword: 'nova-senha-456' }),
    });
    expect(reset.status).toBe(200);
    expect((await call('/v1/me', { cookie })).status).toBe(401);

    const signIn = await call('/v1/auth/sign-in/email', {
      method: 'POST',
      ip,
      body: JSON.stringify({ email, password: 'nova-senha-456' }),
    });
    expect(signIn.status).toBe(200);
  });

  it('does not reveal whether an e-mail is registered', async () => {
    const response = await call('/v1/auth/request-password-reset', {
      method: 'POST',
      ip: freshIp(),
      body: JSON.stringify({ email: 'ninguem@example.test', redirectTo: 'bubo://redefinir-senha' }),
    });
    expect(response.status).toBe(200);
    expect(sentEmails.some((m) => m.to === 'ninguem@example.test')).toBe(false);
  });

  it('never sends a reset token to an untrusted origin', async () => {
    const { email, ip } = await signUp();
    for (const redirectTo of [
      'https://evil.example/steal',
      '//evil.example',
      'javascript:alert(1)',
    ]) {
      const response = await call('/v1/auth/request-password-reset', {
        method: 'POST',
        ip,
        body: JSON.stringify({ email, redirectTo }),
      });
      expect(response.status).toBe(403);
      expect(errorResponseSchema.parse(await response.json()).error.code).toBe('FORBIDDEN');
    }
    expect(sentEmails.some((m) => m.to === email)).toBe(false);

    // Following a genuine link with a tampered callbackURL is blocked as well.
    const genuine = await call('/v1/auth/request-password-reset', {
      method: 'POST',
      ip,
      body: JSON.stringify({ email, redirectTo: 'bubo://redefinir-senha' }),
    });
    expect(genuine.status).toBe(200);
    const link = new URL(sentEmails.find((m) => m.to === email)?.url ?? 'http://x');
    expect(link.searchParams.get('callbackURL')).toBe('bubo://redefinir-senha');
    const ok = await call(`${link.pathname}${link.search}`, { ip });
    expect(ok.headers.get('location')).toMatch(/^bubo:\/\/redefinir-senha\?token=/);
    link.searchParams.set('callbackURL', 'https://evil.example/steal');
    const tampered = await call(`${link.pathname}${link.search}`, { ip });
    expect(tampered.status).toBe(403);
  });

  it('rate-limits repeated sign-in attempts per IP', async () => {
    const { email, ip } = await signUp();
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const response = await call('/v1/auth/sign-in/email', {
        method: 'POST',
        ip,
        body: JSON.stringify({ email, password: 'senha-errada-000' }),
      });
      statuses.push(response.status);
    }
    expect(statuses).toContain(429);
  });

  it('accepts the app deep-link origins sent by the Expo client and rejects others', async () => {
    const attempt = (origin: string) => {
      emailCounter += 1;
      return call('/v1/auth/sign-up/email', {
        method: 'POST',
        ip: freshIp(),
        headers: { 'expo-origin': origin },
        body: JSON.stringify({
          name: 'Origem',
          email: `origem${emailCounter}@example.test`,
          password: 'senha-forte-123',
        }),
      });
    };
    expect((await attempt('bubo://')).status).toBe(200);
    expect((await attempt('exp://192.168.0.10:8081')).status).toBe(200);
    expect((await attempt('https://evil.example')).status).toBe(403);
  });

  it('never logs passwords or session tokens', () => {
    const all = logs.lines.join('\n');
    expect(all).not.toContain('senha-forte-123');
    expect(all).not.toContain('better-auth.session_token=');
  });
});
