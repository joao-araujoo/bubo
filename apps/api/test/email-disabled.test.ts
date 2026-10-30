import { errorResponseSchema } from '@bubo/contracts';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { createHarness } from './harness';

// Production without Resend (owner decision, 2026-09-27): the API serves normally, but a password
// reset fails loudly with 503 instead of pretending an e-mail was sent.
let h: Awaited<ReturnType<typeof createHarness>>;
let counter = 0;

/** Production (https) uses the `__Secure-` cookie prefix, unlike the harness default. */
async function signUp() {
  counter += 1;
  const email = `sem-email${counter}@example.test`;
  const response = await h.call('/v1/auth/sign-up/email', {
    method: 'POST',
    ip: `10.9.0.${counter}`,
    json: { name: 'Leitora', email, password: 'senha-forte-123' },
  });
  expect(response.status).toBe(200);
  const cookie = response.headers
    .getSetCookie()
    .find((c) => c.startsWith('__Secure-better-auth.session_token='));
  expect(cookie).toBeDefined();
  return { email, cookie: cookie?.split(';')[0] ?? '' };
}
beforeAll(async () => {
  h = await createHarness(
    { emailSender: undefined },
    { APP_ENV: 'production', BETTER_AUTH_URL: 'https://api.bubo.example' },
  );
}, 60_000);
afterAll(async () => {
  await h.close();
});

it('is ready and serves authenticated routes without e-mail configured', async () => {
  expect((await h.call('/v1/ready')).status).toBe(200);
  const { cookie } = await signUp();
  expect((await h.call('/v1/me', { cookie })).status).toBe(200);
});

it('answers a password reset with 503 and never logs the reset link', async () => {
  const { email } = await signUp();
  const response = await h.call('/v1/auth/request-password-reset', {
    method: 'POST',
    json: { email, redirectTo: 'bubo://redefinir-senha' },
  });
  expect(response.status).toBe(503);
  expect(errorResponseSchema.parse(await response.json()).error.code).toBe('SERVICE_UNAVAILABLE');
  expect(h.logs.lines.join('\n')).not.toContain('reset-password/');
});

it('answers verification requests with 503 for every address when delivery is unconfigured', async () => {
  for (const email of ['existing@example.test', 'unknown@example.test']) {
    const response = await h.call('/v1/auth/send-verification-email', {
      method: 'POST',
      json: { email, callbackURL: 'bubo:///' },
    });
    expect(response.status).toBe(503);
  }
});

it('answers code requests with 503 and signs in without a code when delivery is unconfigured', async () => {
  const { email, cookie } = await signUp();
  for (const path of [
    '/v1/auth/email-otp/request-password-reset',
    '/v1/auth/two-factor/send-otp',
  ]) {
    const response = await h.call(path, { method: 'POST', json: { email } });
    expect(response.status).toBe(503);
  }
  const me = (await (await h.call('/v1/me', { cookie })).json()) as {
    loginCodeAvailable: boolean;
    user: { twoFactorEnabled: boolean };
  };
  expect(me.loginCodeAvailable).toBe(false);
  expect(me.user.twoFactorEnabled).toBe(false);
  const signIn = await h.call('/v1/auth/sign-in/email', {
    method: 'POST',
    json: { email, password: 'senha-forte-123' },
  });
  expect(signIn.status).toBe(200);
  expect(await signIn.json()).not.toHaveProperty('twoFactorRedirect');
});
