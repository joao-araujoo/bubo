import { createPgliteDatabase, PGLITE_DATABASE_URL } from '../dev/pglite';
import { type AppDeps, createApp } from '../src/app';
import { createBindings, createLogCollector } from './helpers';

export const TEST_SECRET = 'test-secret-with-at-least-thirty-two-characters';

type CallInit = RequestInit & {
  cookie?: string;
  ip?: string;
  appOrigin?: string | null;
  json?: unknown;
};

/**
 * Full API on an in-memory Postgres (PGlite) with real Better Auth. `call` emulates the Expo client
 * (sends `expo-origin: bubo://` and the session cookie).
 */
export async function createHarness(
  deps: Omit<AppDeps, 'databaseProvider' | 'pingDatabase'> = {},
  bindingOverrides: Record<string, string | undefined> = {},
) {
  const database = await createPgliteDatabase();
  const logs = createLogCollector();
  const app = createApp({
    databaseProvider: database.provider,
    pingDatabase: database.ping,
    logSink: logs.sink,
    emailSender: () => ({ sendPasswordReset: async () => undefined }),
    // Tests never reach real catalog sources; catalog tests inject a fake upstream.
    catalogFetch: async () => {
      throw new Error('network disabled in tests');
    },
    ...deps,
  });
  const bindings = createBindings({
    DATABASE_URL: PGLITE_DATABASE_URL,
    BETTER_AUTH_SECRET: TEST_SECRET,
    BETTER_AUTH_URL: 'http://localhost:8787',
    ...bindingOverrides,
  });

  let ipCounter = 0;
  let emailCounter = 0;

  async function call(path: string, init: CallInit = {}) {
    const headers = new Headers(init.headers);
    const body = init.json !== undefined ? JSON.stringify(init.json) : init.body;
    if (body) headers.set('content-type', 'application/json');
    if (init.cookie) headers.set('cookie', init.cookie);
    if (init.appOrigin !== null && !headers.has('expo-origin')) {
      headers.set('expo-origin', init.appOrigin ?? 'bubo://');
    }
    headers.set('x-forwarded-for', init.ip ?? '10.255.255.1');
    return app.request(`http://localhost:8787${path}`, { ...init, body, headers }, bindings);
  }

  /** Signs up a fresh reader and returns its session cookie. */
  async function signUp() {
    ipCounter += 1;
    emailCounter += 1;
    const response = await call('/v1/auth/sign-up/email', {
      method: 'POST',
      ip: `10.1.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`,
      json: {
        name: 'Leitora Teste',
        email: `harness${emailCounter}@example.test`,
        password: 'senha-forte-123',
      },
    });
    if (response.status !== 200) throw new Error(`sign-up failed: ${response.status}`);
    const cookie = response.headers
      .getSetCookie()
      .find((c) => c.startsWith('better-auth.session_token='));
    if (!cookie) throw new Error('no session cookie');
    return { cookie: cookie.split(';')[0] ?? '' };
  }

  return { app, call, signUp, logs, database, bindings, close: () => database.close() };
}
