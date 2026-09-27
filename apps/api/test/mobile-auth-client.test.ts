/**
 * End-to-end check of the REAL mobile auth stack (better-auth client + @better-auth/expo plugin,
 * exactly as apps/mobile/src/lib/auth/client.ts configures it) against the real API on PGlite.
 * Only the React Native / Expo native modules are replaced with small fakes.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

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

import { expoClient } from '@better-auth/expo/client';
import { meResponseSchema } from '@bubo/contracts';
import { createAuthClient } from 'better-auth/client';

import { createHarness } from './harness';

let h: Awaited<ReturnType<typeof createHarness>>;

beforeAll(async () => {
  h = await createHarness();
}, 60_000);
afterAll(async () => {
  await h.close();
});

/** SecureStore-compatible in-memory storage (the app uses expo-secure-store). */
function memoryStore() {
  const map = new Map<string, string>();
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

function mobileClient(storage: ReturnType<typeof memoryStore>) {
  return createAuthClient({
    baseURL: 'http://localhost:8787/v1/auth',
    plugins: [expoClient({ scheme: 'bubo', storagePrefix: 'bubo', storage })],
    fetchOptions: {
      // Route the client's HTTP calls into the in-process API (same Request objects).
      customFetchImpl: async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        const headers = new Headers(request.headers);
        headers.set('x-forwarded-for', '10.9.9.9');
        return h.call(`${url.pathname}${url.search}`, {
          method: request.method,
          headers,
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
});
