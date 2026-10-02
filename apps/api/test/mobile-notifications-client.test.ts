import { meResponseSchema } from '@bubo/contracts';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';

vi.mock('../../mobile/src/lib/auth/client', () => ({ authHeaders: async () => ({}) }));
vi.mock('../../mobile/src/lib/config', () => ({
  publicConfig: { apiUrl: 'http://localhost:8787' },
}));

import { ApiError, createApiClient } from '../../mobile/src/lib/api/client';
import { createHarness } from './harness';

// Task 09 routes through the real mobile client: paths, methods and bodies must match the API.
let h: Awaited<ReturnType<typeof createHarness>>;
const calls: string[] = [];

function clientFor(cookie: string) {
  const bridge: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    calls.push(`${request.method} ${url.pathname}`);
    const body = request.method === 'GET' ? undefined : await request.text();
    return h.call(`${url.pathname}${url.search}`, {
      method: request.method,
      headers: request.headers,
      ...(body ? { body } : {}),
    });
  };
  return createApiClient({
    baseUrl: 'http://localhost:8787',
    fetch: bridge,
    getHeaders: async () => ({ cookie, 'expo-origin': 'bubo://' }),
  });
}

beforeAll(async () => {
  h = await createHarness();
}, 60_000);
afterAll(async () => {
  await h.close();
});

it('saves preferences, registers a device and reads the inbox through the mobile client', async () => {
  const { cookie } = await h.signUp();
  meResponseSchema.parse(await (await h.call('/v1/me', { cookie })).json());
  const api = clientFor(cookie);

  const defaults = await api.getPreferences();
  expect(defaults.reviewReminder).toBe(false);
  const saved = await api.savePreferences({
    ...defaults,
    reviewReminder: true,
    reminderHour: 21,
    dailyFocusMinutes: 45,
  });
  expect(saved).toMatchObject({ reviewReminder: true, reminderHour: 21, dailyFocusMinutes: 45 });
  await expect(api.savePreferences({ ...saved, timeZone: 'Nowhere/Zone' })).rejects.toBeInstanceOf(
    ApiError,
  );

  const token = 'ExponentPushToken[mobile-client-0001]';
  expect(await api.registerPushToken({ token, platform: 'android' })).toEqual({ registered: true });
  expect(await api.removePushToken(token)).toEqual({ registered: false });

  const inbox = await api.getNotifications();
  expect(inbox).toEqual({ items: [], unreadCount: 0 });
  expect(await api.markNotificationsRead({ all: true })).toEqual({ items: [], unreadCount: 0 });

  expect(calls).toEqual([
    'GET /v1/me/preferences',
    'PUT /v1/me/preferences',
    'PUT /v1/me/preferences',
    'POST /v1/me/push-token',
    `DELETE /v1/me/push-token/${encodeURIComponent(token)}`,
    'GET /v1/notifications',
    'POST /v1/notifications/read',
  ]);
});
