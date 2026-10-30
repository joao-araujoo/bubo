/**
 * End-to-end check of the REAL mobile auth stack (better-auth client + @better-auth/expo plugin,
 * exactly as apps/mobile/src/lib/auth/client.ts configures it) against the real API on PGlite.
 * Only the React Native / Expo native modules are replaced with small fakes.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/** One SecureStore for the whole file: the Expo plugin's cookie jar and our trusted-device helper. */
const secure = vi.hoisted(() => new Map<string, string>());

vi.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (options: Record<string, unknown>) => options.ios },
  AppState: { currentState: 'active', addEventListener: () => ({ remove: () => undefined }) },
}));
vi.mock('expo-constants', () => ({ default: { expoConfig: { scheme: 'bubo' }, platform: {} } }));
vi.mock('expo-linking', () => ({
  createURL: (path: string) => `bubo://${path.replace(/^\//, '')}`,
}));
vi.mock('expo-network', () => ({
  addNetworkStateListener: () => ({ remove: () => undefined }),
  getNetworkStateAsync: async () => ({ isConnected: true, isInternetReachable: true }),
}));
vi.mock('expo-web-browser', () => ({ openAuthSessionAsync: async () => ({ type: 'cancel' }) }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => secure.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    secure.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    secure.delete(key);
  },
}));

import { expoClient } from '@better-auth/expo/client';
import { AUTH_CLIENT_HEADER, AUTH_CLIENT_LOGIN_CODE } from '@bubo/config';
import { meResponseSchema } from '@bubo/contracts';
import { createAuthClient } from 'better-auth/client';
import { emailOTPClient, twoFactorClient } from 'better-auth/client/plugins';

import { sessionIsBooting } from '../../mobile/src/lib/auth/auth-status';
import {
  keepTrustedDeviceCookies,
  mergeTrustedDeviceCookies,
  pickTrustedDeviceCookies,
  restoreTrustedDeviceCookies,
} from '../../mobile/src/lib/auth/trusted-device';
import { createEmailRecorder } from './email-recorder';
import { createHarness } from './harness';

let h: Awaited<ReturnType<typeof createHarness>>;
/** A second API with an e-mail provider: sign-in asks for a code (ADR-038). */
let withCodes: Awaited<ReturnType<typeof createHarness>>;
const recorder = createEmailRecorder();

beforeAll(async () => {
  h = await createHarness();
  withCodes = await createHarness({ emailSender: () => recorder.sender });
}, 90_000);
afterAll(async () => {
  await h.close();
  await withCodes.close();
});

/** SecureStore-compatible storage (the app uses expo-secure-store) over a given map. */
function memoryStore(map = new Map<string, string>()) {
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    getItemAsync: async (key: string) => map.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      map.set(key, value);
    },
    deleteItemAsync: async (key: string) => {
      map.delete(key);
    },
  };
}

function mobileClient(
  storage: ReturnType<typeof memoryStore>,
  api: Awaited<ReturnType<typeof createHarness>> = h,
  ip = '10.9.9.9',
) {
  return createAuthClient({
    baseURL: 'http://localhost:8787/v1/auth',
    plugins: [
      expoClient({ scheme: 'bubo', storagePrefix: 'bubo', storage }),
      twoFactorClient(),
      emailOTPClient(),
    ],
    fetchOptions: {
      headers: { [AUTH_CLIENT_HEADER]: AUTH_CLIENT_LOGIN_CODE },
      // Route the client's HTTP calls into the in-process API (same Request objects).
      customFetchImpl: async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        return api.call(`${url.pathname}${url.search}`, {
          method: request.method,
          headers: new Headers(request.headers),
          ip,
          body: request.method === 'GET' ? undefined : await request.text(),
          appOrigin: null,
        });
      },
    },
  });
}

describe('mobile auth client ↔ API', () => {
  it('signs up, persists the session cookie and authenticates API calls', async () => {
    const storage = memoryStore();
    const client = mobileClient(storage);
    const email = `mobile-${Date.now()}@example.test`;

    const signUp = await client.signUp.email({
      name: 'Leitora Mobile',
      email,
      password: 'senha-forte-123',
    });
    expect(signUp.error).toBeNull();

    const cookie = client.getCookie();
    const cookieValue = typeof cookie === 'string' ? cookie : await cookie;
    expect(cookieValue).toContain('better-auth.session_token=');
    expect([...storage.map.keys()].some((key) => key.startsWith('bubo'))).toBe(true);

    const session = await client.getSession();
    expect(session.data?.user.email).toBe(email);

    // Exactly what apps/mobile/src/lib/api/client.ts does for Bubo API calls.
    const me = await h.call('/v1/me', { headers: { cookie: cookieValue }, appOrigin: null });
    expect(me.status).toBe(200);
    expect(meResponseSchema.parse(await me.json()).user.email).toBe(email);
  });

  it('signs out and signs back in', async () => {
    const storage = memoryStore();
    const client = mobileClient(storage);
    const email = `mobile-back-${Date.now()}@example.test`;
    await client.signUp.email({ name: 'Volta', email, password: 'senha-forte-123' });

    const out = await client.signOut();
    expect(out.error).toBeNull();
    expect((await client.getSession()).data).toBeNull();

    const wrong = await client.signIn.email({ email, password: 'senha-errada-000' });
    expect(wrong.error?.status).toBe(401);

    const back = await client.signIn.email({ email, password: 'senha-forte-123' });
    expect(back.error).toBeNull();
    expect((await client.getSession()).data?.user.email).toBe(email);
  });

  it('asks for the e-mailed code, trusts the device and keeps the trust across sign-out', async () => {
    secure.clear();
    const client = mobileClient(memoryStore(secure), withCodes, '10.9.8.1');
    const email = `mobile-codigo-${Date.now()}@example.test`;
    await client.signUp.email({ name: 'Código', email, password: 'senha-forte-123' });
    await client.signOut();

    const challenge = await client.signIn.email({ email, password: 'senha-forte-123' });
    expect(challenge.error).toBeNull();
    expect(challenge.data).toMatchObject({ twoFactorRedirect: true });
    expect((await client.getSession()).data).toBeNull();

    const sent = await client.twoFactor.sendOtp();
    expect(sent.error).toBeNull();
    const code = recorder.lastLoginCode(email) ?? '';
    expect(code).toMatch(/^\d{6}$/);
    const verified = await client.twoFactor.verifyOtp({ code, trustDevice: true });
    expect(verified.error).toBeNull();
    expect((await client.getSession()).data?.user.email).toBe(email);
    expect(await client.getCookie()).toContain('better-auth.trust_device=');

    // Sign-out wipes the Expo cookie jar; the app keeps the trust aside and puts it back.
    const kept = await keepTrustedDeviceCookies();
    expect(kept && Object.keys(kept)).toEqual(['better-auth.trust_device']);
    await client.signOut();
    expect(await client.getCookie()).toBe('');
    await restoreTrustedDeviceCookies(kept);
    expect(await client.getCookie()).toContain('better-auth.trust_device=');

    const direct = await client.signIn.email({ email, password: 'senha-forte-123' });
    expect(direct.error).toBeNull();
    expect(direct.data).not.toMatchObject({ twoFactorRedirect: true });
    expect((await client.getSession()).data?.user.email).toBe(email);
  });

  it('resets the password with a code typed in the app', async () => {
    const client = mobileClient(memoryStore(), withCodes, '10.9.8.2');
    const email = `mobile-senha-${Date.now()}@example.test`;
    await client.signUp.email({ name: 'Senha', email, password: 'senha-forte-123' });
    await client.signOut();

    const requested = await client.emailOtp.requestPasswordReset({ email });
    expect(requested.error).toBeNull();
    const code = recorder.lastResetCode(email) ?? '';
    const wrong = await client.emailOtp.resetPassword({
      email,
      otp: code === '000000' ? '111111' : '000000',
      password: 'nova-senha-456',
    });
    expect(wrong.error?.status).toBe(400);
    const reset = await client.emailOtp.resetPassword({
      email,
      otp: code,
      password: 'nova-senha-456',
    });
    expect(reset.error).toBeNull();
    // ADR-040: the reset itself opens a session on this device; no second code to type.
    expect((await client.getSession()).data?.user.email).toBe(email);
    await client.signOut();
    const back = await client.signIn.email({ email, password: 'nova-senha-456' });
    expect(back.error).toBeNull();
    expect(back.data).toMatchObject({ twoFactorRedirect: true });
  });

  it('forgot password on a trusted device: reset, sign out, sign in with the new password', async () => {
    secure.clear();
    const client = mobileClient(memoryStore(secure), withCodes, '10.9.8.3');
    const email = `mobile-confiavel-${Date.now()}@example.test`;
    await client.signUp.email({ name: 'Confiável', email, password: 'senha-forte-123' });
    await client.signOut();
    await client.signIn.email({ email, password: 'senha-forte-123' });
    await client.twoFactor.sendOtp();
    await client.twoFactor.verifyOtp({
      code: recorder.lastLoginCode(email) ?? '',
      trustDevice: true,
    });
    // Signed out the way the app does it (the trust cookie survives).
    const kept = await keepTrustedDeviceCookies();
    await client.signOut();
    await restoreTrustedDeviceCookies(kept);

    expect((await client.emailOtp.requestPasswordReset({ email })).error).toBeNull();
    const reset = await client.emailOtp.resetPassword({
      email,
      otp: recorder.lastResetCode(email) ?? '',
      password: 'senha-trocada-789',
    });
    expect(reset.error).toBeNull();
    expect((await client.getSession()).data?.user.email).toBe(email);

    const keptAgain = await keepTrustedDeviceCookies();
    await client.signOut();
    await restoreTrustedDeviceCookies(keptAgain);
    const old = await client.signIn.email({ email, password: 'senha-forte-123' });
    expect(old.error?.status).toBe(401);
    const direct = await client.signIn.email({ email, password: 'senha-trocada-789' });
    expect(direct.error).toBeNull();
    expect(direct.data).not.toMatchObject({ twoFactorRedirect: true });
    expect((await client.getSession()).data?.user.email).toBe(email);
  });

  it('forgot password on a new device: the new password and a login code open the session', async () => {
    const client = mobileClient(memoryStore(), withCodes, '10.9.8.4');
    const email = `mobile-novo-${Date.now()}@example.test`;
    await client.signUp.email({ name: 'Novo', email, password: 'senha-forte-123' });
    await client.signOut();
    await client.emailOtp.requestPasswordReset({ email });
    await client.emailOtp.resetPassword({
      email,
      otp: recorder.lastResetCode(email) ?? '',
      password: 'senha-nova-321',
    });
    await client.signOut();

    const challenge = await client.signIn.email({ email, password: 'senha-nova-321' });
    expect(challenge.error).toBeNull();
    expect(challenge.data).toMatchObject({ twoFactorRedirect: true });
    expect((await client.twoFactor.sendOtp()).error).toBeNull();
    const wrong = await client.twoFactor.verifyOtp({ code: recorder.lastResetCode(email) ?? '' });
    expect(wrong.error).not.toBeNull();
    const verified = await client.twoFactor.verifyOtp({
      code: recorder.lastLoginCode(email) ?? '',
    });
    expect(verified.error).toBeNull();
    expect((await client.getSession()).data?.user.email).toBe(email);
  });

  it('a sign-in that starts the code never sends the navigator back to the boot screen', async () => {
    const client = mobileClient(memoryStore(), withCodes, '10.9.8.6');
    const email = `mobile-boot-${Date.now()}@example.test`;
    await client.signUp.email({ name: 'Boot', email, password: 'senha-forte-123' });
    await client.signOut();
    // The app's navigator watches this atom (authClient.useSession in React).
    const states: { pending: boolean; signedIn: boolean }[] = [];
    const stop = client.useSession.subscribe((state) =>
      states.push({ pending: state.isPending, signedIn: state.data !== null }),
    );
    await client.getSession();
    const settled = states.length;
    const challenge = await client.signIn.email({ email, password: 'senha-forte-123' });
    expect(challenge.data).toMatchObject({ twoFactorRedirect: true });
    await client.twoFactor.sendOtp();
    await client.getSession();
    stop();
    // Better Auth marks a signed-out session pending again on these refetches (the old bug)…
    const after = states.slice(settled);
    expect(after.some((state) => state.pending && !state.signedIn)).toBe(true);
    // …but once resolved the app keeps its screens, so the code screen can open.
    for (const state of after) {
      expect(sessionIsBooting({ pending: state.pending, resolvedBefore: true })).toBe(false);
    }
    expect(sessionIsBooting({ pending: true, resolvedBefore: false })).toBe(true);
  });

  it('an app build without login codes is told to update', async () => {
    const legacy = createAuthClient({
      baseURL: 'http://localhost:8787/v1/auth',
      plugins: [expoClient({ scheme: 'bubo', storagePrefix: 'bubo', storage: memoryStore() })],
      fetchOptions: {
        customFetchImpl: async (input, init) => {
          const request = new Request(input, init);
          const url = new URL(request.url);
          return withCodes.call(`${url.pathname}${url.search}`, {
            method: request.method,
            headers: new Headers(request.headers),
            ip: '10.9.8.5',
            body: request.method === 'GET' ? undefined : await request.text(),
            appOrigin: null,
            legacyClient: true,
          });
        },
      },
    });
    const email = `mobile-antigo-${Date.now()}@example.test`;
    await legacy.signUp.email({ name: 'Antigo', email, password: 'senha-forte-123' });
    await legacy.signOut();
    const attempt = await legacy.signIn.email({ email, password: 'senha-forte-123' });
    expect(attempt.error).toMatchObject({ status: 426, code: 'APP_UPDATE_REQUIRED' });
  });
});

describe('trusted-device cookie helpers', () => {
  it('keeps only trust cookies and merges them back without clobbering newer entries', () => {
    const jar = JSON.stringify({
      'better-auth.session_token': { value: 's', expires: null },
      '__Secure-better-auth.trust_device': { value: 't', expires: '2099-01-01T00:00:00.000Z' },
    });
    const kept = pickTrustedDeviceCookies(jar);
    expect(kept).toEqual({
      '__Secure-better-auth.trust_device': { value: 't', expires: '2099-01-01T00:00:00.000Z' },
    });
    expect(pickTrustedDeviceCookies(null)).toBeNull();
    expect(pickTrustedDeviceCookies('{}')).toBeNull();
    expect(pickTrustedDeviceCookies('ba-chunks:3')).toBeNull();
    expect(pickTrustedDeviceCookies('not json')).toBeNull();
    expect(JSON.parse(mergeTrustedDeviceCookies('{}', kept ?? {}))).toEqual(kept);
    expect(
      JSON.parse(
        mergeTrustedDeviceCookies(
          JSON.stringify({
            '__Secure-better-auth.trust_device': { value: 'newer', expires: null },
          }),
          kept ?? {},
        ),
      ),
    ).toEqual({ '__Secure-better-auth.trust_device': { value: 'newer', expires: null } });
  });
});
