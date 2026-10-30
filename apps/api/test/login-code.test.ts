import { meResponseSchema } from '@bubo/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createEmailRecorder } from './email-recorder';
import { createHarness } from './harness';

/**
 * ADR-038: with an e-mail provider, sign-in on an untrusted device needs an e-mailed code, the
 * device can be remembered for 30 days, and passwords are reset with a code typed in the app.
 */
let h: Awaited<ReturnType<typeof createHarness>>;
const recorder = createEmailRecorder();
let counter = 0;
const PASSWORD = 'senha-forte-123';

beforeAll(async () => {
  h = await createHarness({ emailSender: () => recorder.sender });
}, 60_000);
afterAll(async () => {
  await h.close();
});

function cookieNamed(response: Response, name: string): string | null {
  const found = response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0] ?? '')
    .find((value) => value.startsWith(`${name}=`) && !value.endsWith('='));
  return found ?? null;
}
const sessionCookie = (response: Response) => cookieNamed(response, 'better-auth.session_token');

async function reader() {
  counter += 1;
  const email = `codigo${counter}@example.test`;
  const ip = `10.6.${Math.floor(counter / 250)}.${counter % 250}`;
  const response = await h.call('/v1/auth/sign-up/email', {
    method: 'POST',
    ip,
    json: { name: 'Ana Leitora', email, password: PASSWORD },
  });
  expect(response.status).toBe(200);
  const cookie = sessionCookie(response);
  expect(cookie).not.toBeNull();
  return { email, ip, cookie: cookie ?? '' };
}

async function signIn(email: string, ip: string, cookie?: string, password = PASSWORD) {
  return h.call('/v1/auth/sign-in/email', {
    method: 'POST',
    ip,
    ...(cookie ? { cookie } : {}),
    json: { email, password },
  });
}

/** Sign-in + code, as the app does it; returns the session and (optionally) the trust cookie. */
async function signInWithCode(email: string, ip: string, trustDevice = false, password = PASSWORD) {
  const challenge = await signIn(email, ip, undefined, password);
  expect(challenge.status).toBe(200);
  expect(await challenge.json()).toEqual({ twoFactorRedirect: true, twoFactorMethods: ['otp'] });
  expect(sessionCookie(challenge)).toBeNull();
  const twoFactor = cookieNamed(challenge, 'better-auth.two_factor');
  expect(twoFactor).not.toBeNull();
  const sent = await h.call('/v1/auth/two-factor/send-otp', {
    method: 'POST',
    ip,
    cookie: twoFactor ?? '',
    json: {},
  });
  expect(sent.status).toBe(200);
  const code = recorder.lastLoginCode(email);
  expect(code).toMatch(/^\d{6}$/);
  const verified = await h.call('/v1/auth/two-factor/verify-otp', {
    method: 'POST',
    ip,
    cookie: twoFactor ?? '',
    json: { code, trustDevice },
  });
  expect(verified.status).toBe(200);
  const session = sessionCookie(verified);
  expect(session).not.toBeNull();
  return { session: session ?? '', trust: cookieNamed(verified, 'better-auth.trust_device') };
}

describe('e-mailed login code', () => {
  it('is on for new accounts and announced by /v1/me', async () => {
    const { cookie } = await reader();
    const me = meResponseSchema.parse(await (await h.call('/v1/me', { cookie })).json());
    expect(me.user.twoFactorEnabled).toBe(true);
    expect(me.loginCodeAvailable).toBe(true);
  });

  it('withholds the session until the e-mailed code is typed, and rejects wrong codes', async () => {
    const { email, ip } = await reader();
    const challenge = await signIn(email, ip);
    const twoFactor = cookieNamed(challenge, 'better-auth.two_factor') ?? '';
    expect(
      (
        await h.call('/v1/auth/two-factor/send-otp', {
          method: 'POST',
          ip,
          cookie: twoFactor,
          json: {},
        })
      ).status,
    ).toBe(200);
    const code = recorder.lastLoginCode(email) ?? '';
    const wrong = code === '000000' ? '111111' : '000000';
    const rejected = await h.call('/v1/auth/two-factor/verify-otp', {
      method: 'POST',
      ip,
      cookie: twoFactor,
      json: { code: wrong },
    });
    expect(rejected.status).toBe(401);
    expect(sessionCookie(rejected)).toBeNull();
    // Without the challenge cookie nothing can be verified or sent.
    expect(
      (await h.call('/v1/auth/two-factor/verify-otp', { method: 'POST', ip, json: { code } }))
        .status,
    ).toBe(401);
    const accepted = await h.call('/v1/auth/two-factor/verify-otp', {
      method: 'POST',
      ip,
      cookie: twoFactor,
      json: { code },
    });
    expect(accepted.status).toBe(200);
    expect((await h.call('/v1/me', { cookie: sessionCookie(accepted) ?? '' })).status).toBe(200);
    // A code is single-use: the same challenge cannot be replayed.
    const replay = await h.call('/v1/auth/two-factor/verify-otp', {
      method: 'POST',
      ip,
      cookie: twoFactor,
      json: { code },
    });
    expect(replay.status).toBeGreaterThanOrEqual(400);
  });

  it('gives up after five wrong attempts on the same code', async () => {
    const { email, ip } = await reader();
    const challenge = await signIn(email, ip);
    const twoFactor = cookieNamed(challenge, 'better-auth.two_factor') ?? '';
    await h.call('/v1/auth/two-factor/send-otp', {
      method: 'POST',
      ip,
      cookie: twoFactor,
      json: {},
    });
    const code = recorder.lastLoginCode(email) ?? '';
    const wrong = code === '000000' ? '111111' : '000000';
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await h.call('/v1/auth/two-factor/verify-otp', {
        method: 'POST',
        ip,
        cookie: twoFactor,
        json: { code: wrong },
      });
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(400);
    // Even the right code no longer works: the reader must ask for a new one.
    const late = await h.call('/v1/auth/two-factor/verify-otp', {
      method: 'POST',
      ip,
      cookie: twoFactor,
      json: { code },
    });
    expect(late.status).toBeGreaterThanOrEqual(400);
  });

  it('remembers a trusted device for later sign-ins, but not other devices', async () => {
    const { email, ip } = await reader();
    const { trust } = await signInWithCode(email, ip, true);
    expect(trust).not.toBeNull();
    const direct = await signIn(email, ip, trust ?? '');
    expect(direct.status).toBe(200);
    expect(await direct.json()).not.toHaveProperty('twoFactorRedirect');
    expect((await h.call('/v1/me', { cookie: sessionCookie(direct) ?? '' })).status).toBe(200);
    // Another device (no trust cookie) still gets the challenge.
    const fresh = await signIn(email, ip);
    expect(await fresh.json()).toMatchObject({ twoFactorRedirect: true });
    // A forged trust cookie is ignored.
    const forged = await signIn(email, ip, 'better-auth.trust_device=forged.value');
    expect(await forged.json()).toMatchObject({ twoFactorRedirect: true });
  });

  it('can be turned off and on again with the password', async () => {
    const { email, ip, cookie } = await reader();
    const refused = await h.call('/v1/auth/two-factor/disable', {
      method: 'POST',
      ip,
      cookie,
      json: { password: 'senha-errada-000' },
    });
    expect(refused.status).toBe(400);
    const disabled = await h.call('/v1/auth/two-factor/disable', {
      method: 'POST',
      ip,
      cookie,
      json: { password: PASSWORD },
    });
    expect(disabled.status).toBe(200);
    const afterDisable = sessionCookie(disabled) ?? cookie;
    const me = meResponseSchema.parse(
      await (await h.call('/v1/me', { cookie: afterDisable })).json(),
    );
    expect(me.user.twoFactorEnabled).toBe(false);
    const direct = await signIn(email, ip);
    expect(await direct.json()).not.toHaveProperty('twoFactorRedirect');
    expect(sessionCookie(direct)).not.toBeNull();

    const enabled = await h.call('/v1/auth/two-factor/enable', {
      method: 'POST',
      ip,
      cookie: sessionCookie(direct) ?? '',
      json: { password: PASSWORD, method: 'otp' },
    });
    expect(enabled.status).toBe(200);
    expect(await enabled.json()).toEqual({ method: 'otp' });
    const challenge = await signIn(email, ip);
    expect(await challenge.json()).toMatchObject({ twoFactorRedirect: true });
  });

  it('never logs codes and limits code requests per IP', async () => {
    const { email, ip } = await reader();
    const challenge = await signIn(email, ip);
    const twoFactor = cookieNamed(challenge, 'better-auth.two_factor') ?? '';
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await h.call('/v1/auth/two-factor/send-otp', {
        method: 'POST',
        ip,
        cookie: twoFactor,
        json: {},
      });
      statuses.push(response.status);
    }
    expect(statuses).toEqual([200, 200, 200, 429]);
    const logged = h.logs.lines.join('\n');
    for (const message of recorder.loginCodes) expect(logged).not.toContain(message.code);
    expect(logged).not.toContain('better-auth.two_factor=');
  });
});

describe('password reset by e-mailed code', () => {
  it('resets with the right code only, revokes sessions and never reuses a code', async () => {
    const { email, ip, cookie } = await reader();
    const requested = await h.call('/v1/auth/email-otp/request-password-reset', {
      method: 'POST',
      ip,
      json: { email },
    });
    expect(requested.status).toBe(200);
    const code = recorder.lastResetCode(email) ?? '';
    expect(code).toMatch(/^\d{6}$/);
    const wrong = code === '000000' ? '111111' : '000000';
    const rejected = await h.call('/v1/auth/email-otp/reset-password', {
      method: 'POST',
      ip,
      json: { email, otp: wrong, password: 'nova-senha-456' },
    });
    expect(rejected.status).toBe(400);
    const weak = await h.call('/v1/auth/email-otp/reset-password', {
      method: 'POST',
      ip,
      json: { email, otp: code, password: '123' },
    });
    expect(weak.status).toBe(400);
    const accepted = await h.call('/v1/auth/email-otp/reset-password', {
      method: 'POST',
      ip,
      json: { email, otp: code, password: 'nova-senha-456' },
    });
    expect(accepted.status).toBe(200);
    expect(recorder.changed.filter((m) => m.to === email)).toHaveLength(1);
    expect((await h.call('/v1/me', { cookie })).status).toBe(401);
    // ADR-040: the code proved the e-mail, so the reader is signed in on this device right away.
    const afterReset = sessionCookie(accepted);
    expect(afterReset).not.toBeNull();
    expect((await h.call('/v1/me', { cookie: afterReset ?? '' })).status).toBe(200);
    const old = await signIn(email, ip, undefined, PASSWORD);
    expect(old.status).toBe(401);
    // Another device still needs the new password and a fresh login code.
    const fresh = await signIn(email, ip, undefined, 'nova-senha-456');
    expect(fresh.status).toBe(200);
    expect(await fresh.json()).toMatchObject({ twoFactorRedirect: true });
    const replay = await h.call('/v1/auth/email-otp/reset-password', {
      method: 'POST',
      ip,
      json: { email, otp: code, password: 'outra-senha-789' },
    });
    expect(replay.status).toBe(400);
    const logged = h.logs.lines.join('\n');
    for (const message of recorder.resetCodes) expect(logged).not.toContain(message.code);
  });

  it('signs in with the new password end to end: reset, sign-in, code, session', async () => {
    const { email, ip } = await reader();
    // A mixed-case address still reaches the same account.
    await h.call('/v1/auth/email-otp/request-password-reset', {
      method: 'POST',
      ip,
      json: { email: email.toUpperCase() },
    });
    const code = recorder.lastResetCode(email) ?? '';
    expect(code).toMatch(/^\d{6}$/);
    const reset = await h.call('/v1/auth/email-otp/reset-password', {
      method: 'POST',
      ip,
      json: { email: email.toUpperCase(), otp: code, password: 'Nova Senha com espaço 1' },
    });
    expect(reset.status).toBe(200);
    expect(await reset.json()).toEqual({ success: true });
    const loginCodesBefore = recorder.loginCodes.length;
    const { session } = await signInWithCode(email, ip, false, 'Nova Senha com espaço 1');
    expect(recorder.loginCodes.length).toBe(loginCodesBefore + 1);
    // The reset code can never be typed as a login code.
    expect(recorder.lastLoginCode(email)).not.toBe(code);
    expect((await h.call('/v1/me', { cookie: session })).status).toBe(200);
    expect((await signIn(email, ip, undefined, 'Nova Senha com espaço 1')).status).toBe(200);
    expect((await signIn(email, ip, undefined, 'nova senha com espaço 1')).status).toBe(401);
  });

  it('signs the reader in after the e-mailed link reset kept for older builds', async () => {
    const { email, ip } = await reader();
    const requested = await h.call('/v1/auth/request-password-reset', {
      method: 'POST',
      ip,
      json: { email, redirectTo: 'bubo://redefinir-senha' },
    });
    expect(requested.status).toBe(200);
    const link = recorder.resets.filter((m) => m.to === email).at(-1)?.url ?? '';
    const token = new URL(link).pathname.split('/').at(-1) ?? '';
    expect(token).not.toBe('');
    const reset = await h.call('/v1/auth/reset-password', {
      method: 'POST',
      ip,
      json: { token, newPassword: 'senha-do-link-123' },
    });
    expect(reset.status).toBe(200);
    expect((await h.call('/v1/me', { cookie: sessionCookie(reset) ?? '' })).status).toBe(200);
    // A failed reset never opens a session.
    const reused = await h.call('/v1/auth/reset-password', {
      method: 'POST',
      ip,
      json: { token, newPassword: 'outra-senha-123' },
    });
    expect(reused.status).toBe(400);
    expect(sessionCookie(reused)).toBeNull();
  });

  it('never opens a session for a wrong or expired reset code', async () => {
    const { email, ip } = await reader();
    await h.call('/v1/auth/email-otp/request-password-reset', {
      method: 'POST',
      ip,
      json: { email },
    });
    const code = recorder.lastResetCode(email) ?? '';
    const wrong = await h.call('/v1/auth/email-otp/reset-password', {
      method: 'POST',
      ip,
      json: { email, otp: code === '000000' ? '111111' : '000000', password: 'nova-senha-456' },
    });
    expect(wrong.status).toBe(400);
    expect(sessionCookie(wrong)).toBeNull();
    // The old password still works because nothing changed.
    expect((await signIn(email, ip)).status).toBe(200);
  });

  it('answers the same for unknown addresses and never sends sign-in codes', async () => {
    const { email, ip } = await reader();
    const before = recorder.resetCodes.length;
    const unknown = await h.call('/v1/auth/email-otp/request-password-reset', {
      method: 'POST',
      ip,
      json: { email: 'ninguem@example.test' },
    });
    expect(unknown.status).toBe(200);
    expect(recorder.resetCodes).toHaveLength(before);
    // Bubo has no passwordless sign-in: a "sign-in" code is never e-mailed and cannot be used.
    const loginCodes = recorder.loginCodes.length;
    const signInOtp = await h.call('/v1/auth/email-otp/send-verification-otp', {
      method: 'POST',
      ip,
      json: { email, type: 'sign-in' },
    });
    expect(signInOtp.status).toBe(200);
    expect(recorder.loginCodes).toHaveLength(loginCodes);
    expect(recorder.resetCodes).toHaveLength(before);
    const passwordless = await h.call('/v1/auth/sign-in/email-otp', {
      method: 'POST',
      ip,
      json: { email, otp: '123456' },
    });
    expect(passwordless.status).toBe(400);
  });
});

describe('app builds without login codes', () => {
  it('are told to update instead of waiting forever on the code challenge', async () => {
    const { email, ip } = await reader();
    const legacy = await h.call('/v1/auth/sign-in/email', {
      method: 'POST',
      ip,
      legacyClient: true,
      json: { email, password: PASSWORD },
    });
    expect(legacy.status).toBe(426);
    expect(await legacy.json()).toMatchObject({ code: 'APP_UPDATE_REQUIRED' });
    expect(legacy.headers.getSetCookie()).toEqual([]);
    // A wrong password is still just a wrong password.
    const wrong = await h.call('/v1/auth/sign-in/email', {
      method: 'POST',
      ip,
      legacyClient: true,
      json: { email, password: 'senha-errada-000' },
    });
    expect(wrong.status).toBe(401);
  });

  it('still sign in when the account does not ask for a code', async () => {
    const { email, ip, cookie } = await reader();
    await h.call('/v1/auth/two-factor/disable', {
      method: 'POST',
      ip,
      cookie,
      json: { password: PASSWORD },
    });
    const legacy = await h.call('/v1/auth/sign-in/email', {
      method: 'POST',
      ip,
      legacyClient: true,
      json: { email, password: PASSWORD },
    });
    expect(legacy.status).toBe(200);
    expect(sessionCookie(legacy)).not.toBeNull();
  });
});

describe('account security notices', () => {
  it('e-mails a notice after an in-app password change', async () => {
    const { email, ip, cookie } = await reader();
    const changed = await h.call('/v1/auth/change-password', {
      method: 'POST',
      ip,
      cookie,
      json: { currentPassword: PASSWORD, newPassword: 'senha-nova-789', revokeOtherSessions: true },
    });
    expect(changed.status).toBe(200);
    expect(recorder.changed.filter((m) => m.to === email)).toHaveLength(1);
    const wrong = await h.call('/v1/auth/change-password', {
      method: 'POST',
      ip,
      cookie: sessionCookie(changed) ?? cookie,
      json: { currentPassword: PASSWORD, newPassword: 'senha-nova-000' },
    });
    expect(wrong.status).toBe(400);
    expect(recorder.changed.filter((m) => m.to === email)).toHaveLength(1);
  });

  it('says goodbye after the account is deleted', async () => {
    const { email, ip, cookie } = await reader();
    const deleted = await h.call('/v1/auth/delete-user', {
      method: 'POST',
      ip,
      cookie,
      json: { password: PASSWORD },
    });
    expect(deleted.status).toBe(200);
    expect(recorder.deleted.filter((m) => m.to === email)).toHaveLength(1);
    expect((await h.call('/v1/me', { cookie })).status).toBe(401);
  });
});
