import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  platform: { OS: 'android' },
  constants: {
    executionEnvironment: 'standalone',
    expoConfig: {
      extra: { eas: { projectId: '00000000-0000-4000-8000-000000000001' as string | undefined } },
    },
  },
  permission: {
    granted: false,
    canAskAgain: true,
    ios: undefined as { status: number } | undefined,
  },
  registered: vi.fn(),
  removed: vi.fn(),
  channels: vi.fn(),
  ask: vi.fn(),
  getToken: vi.fn(),
  dismiss: vi.fn(),
  clear: vi.fn(),
  handler: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => state.storage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      state.storage.set(key, value);
    },
    removeItem: async (key: string) => {
      state.storage.delete(key);
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach((key) => state.storage.delete(key));
    },
  },
}));
vi.mock('react-native', () => ({
  Platform: state.platform,
  AppState: { addEventListener: vi.fn() },
}));
vi.mock('expo-constants', () => ({
  default: state.constants,
  ExecutionEnvironment: { StoreClient: 'expo-go' },
}));
vi.mock('expo-router', () => ({ useRouter: vi.fn() }));
vi.mock('../../mobile/src/theme/colors', () => ({ lightColors: { primary: '#7C3AED' } }));
vi.mock('../../mobile/src/lib/api/client', () => ({
  api: { registerPushToken: state.registered, removePushToken: state.removed },
}));
vi.mock('expo-notifications', () => ({
  setNotificationHandler: state.handler,
  setNotificationChannelAsync: state.channels,
  getPermissionsAsync: async () => state.permission,
  requestPermissionsAsync: state.ask,
  getExpoPushTokenAsync: state.getToken,
  dismissAllNotificationsAsync: state.dismiss,
  clearLastNotificationResponse: state.clear,
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  AndroidImportance: { DEFAULT: 3 },
  AndroidNotificationVisibility: { PRIVATE: 0 },
}));

beforeEach(() => {
  vi.resetModules();
  state.storage.clear();
  state.platform.OS = 'android';
  state.constants.executionEnvironment = 'standalone';
  state.constants.expoConfig.extra.eas.projectId = '00000000-0000-4000-8000-000000000001';
  state.permission = { granted: false, canAskAgain: true, ios: undefined };
  for (const fn of [
    state.registered,
    state.removed,
    state.channels,
    state.ask,
    state.getToken,
    state.dismiss,
    state.clear,
    state.handler,
  ])
    fn.mockReset();
  state.ask.mockResolvedValue({ granted: true });
  state.getToken.mockResolvedValue({ data: 'ExponentPushToken[phone-0001]' });
});

describe('native push registration lifecycle', () => {
  it('never prompts when the build cannot register remote push', async () => {
    state.constants.expoConfig.extra.eas.projectId = undefined;
    const push = await import('../../mobile/src/lib/notifications');
    expect(await push.registerForPush('reader-a')).toBe('unavailable');
    expect(state.ask).not.toHaveBeenCalled();
    expect(state.registered).not.toHaveBeenCalled();
  });

  it('creates Android channels before requesting consent and persists the owner', async () => {
    const push = await import('../../mobile/src/lib/notifications');
    expect(await push.registerForPush('reader-a')).toBe('registered');
    expect(state.channels).toHaveBeenCalledTimes(2);
    expect(state.channels.mock.invocationCallOrder[1]).toBeLessThan(
      state.ask.mock.invocationCallOrder[0] ?? 0,
    );
    expect(state.registered).toHaveBeenCalledWith({
      token: 'ExponentPushToken[phone-0001]',
      platform: 'android',
      expectedUserId: 'reader-a',
    });
    expect(state.storage.get('bubo.push-owner.v1')).toBe('reader-a');
    expect(await push.currentPushState('reader-b')).toBe('off');
  });

  it('accepts iOS provisional permission without a second system prompt', async () => {
    state.platform.OS = 'ios';
    state.permission.ios = { status: 3 };
    const push = await import('../../mobile/src/lib/notifications');
    expect(await push.registerForPush('reader-a')).toBe('registered');
    expect(state.ask).not.toHaveBeenCalled();
    expect(state.channels).not.toHaveBeenCalled();
  });

  it('refreshes without prompting and removes registration when permission is revoked', async () => {
    state.storage.set('bubo.push-token.v1', 'ExponentPushToken[phone-0001]');
    state.storage.set('bubo.push-owner.v1', 'reader-a');
    const push = await import('../../mobile/src/lib/notifications');
    await push.refreshPushRegistration('reader-a');
    expect(state.ask).not.toHaveBeenCalled();
    expect(state.removed).toHaveBeenCalledWith('ExponentPushToken[phone-0001]');
    expect(state.storage.has('bubo.push-token.v1')).toBe(false);
  });

  it('keeps a durable removal after offline logout and retries only for its account', async () => {
    state.permission.granted = true;
    const push = await import('../../mobile/src/lib/notifications');
    await push.registerForPush('reader-a');
    state.removed.mockRejectedValueOnce(new Error('offline'));
    await push.unregisterPush();
    expect(state.storage.get('bubo.push-removal.v1')).toBe('ExponentPushToken[phone-0001]');
    expect(state.storage.has('bubo.push-token.v1')).toBe(true);
    expect(await push.currentPushState('reader-a')).toBe('off');
    state.removed.mockClear();
    await push.refreshPushRegistration('reader-b');
    expect(state.removed).not.toHaveBeenCalled();
    await push.refreshPushRegistration('reader-a');
    expect(state.removed).toHaveBeenCalledOnce();
    expect(state.storage.size).toBe(0);
  });

  it('suppresses old-account foreground alerts after a forced transition', async () => {
    state.permission.granted = true;
    const push = await import('../../mobile/src/lib/notifications');
    push.setNotificationAccount('reader-a');
    await push.registerForPush('reader-a');
    const handler = state.handler.mock.calls[0]?.[0] as {
      handleNotification: (input: {
        request: { content: { data: { userId: string } } };
      }) => Promise<{ shouldShowBanner: boolean; shouldShowList: boolean }>;
    };
    const notification = { request: { content: { data: { userId: 'reader-a' } } } };
    expect(await handler.handleNotification(notification)).toMatchObject({
      shouldShowBanner: true,
    });
    push.setNotificationAccount('reader-b');
    expect(await handler.handleNotification(notification)).toMatchObject({
      shouldShowBanner: false,
      shouldShowList: false,
    });
    push.setNotificationAccount(null);
    expect(await handler.handleNotification(notification)).toMatchObject({
      shouldShowBanner: false,
    });
  });

  it('does not share a pending native registration across account transitions', async () => {
    state.permission.granted = true;
    let resolveToken: ((value: { data: string }) => void) | undefined;
    state.getToken.mockImplementationOnce(
      () =>
        new Promise<{ data: string }>((resolve) => {
          resolveToken = resolve;
        }),
    );
    const push = await import('../../mobile/src/lib/notifications');
    push.setNotificationAccount('reader-a');
    const first = push.registerForPush('reader-a');
    await vi.waitFor(() => expect(state.getToken).toHaveBeenCalledOnce());
    push.setNotificationAccount('reader-b');
    const second = push.registerForPush('reader-b');
    resolveToken?.({ data: 'ExponentPushToken[phone-0001]' });
    expect(await first).toBe('unavailable');
    expect(await second).toBe('registered');
    expect(state.registered).toHaveBeenCalledOnce();
    expect(state.registered.mock.calls[0]?.[0]).toMatchObject({ expectedUserId: 'reader-b' });
    expect(state.storage.get('bubo.push-owner.v1')).toBe('reader-b');
  });

  it('does not persist stale ownership after an old-account API response', async () => {
    state.permission.granted = true;
    let resolveRegistration: (() => void) | undefined;
    state.registered.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveRegistration = resolve;
        }),
    );
    const push = await import('../../mobile/src/lib/notifications');
    push.setNotificationAccount('reader-a');
    const first = push.registerForPush('reader-a');
    await vi.waitFor(() => expect(state.registered).toHaveBeenCalledOnce());
    push.setNotificationAccount('reader-b');
    resolveRegistration?.();
    expect(await first).toBe('unavailable');
    expect(state.storage.size).toBe(0);
    expect(await push.registerForPush('reader-b')).toBe('registered');
    expect(state.storage.get('bubo.push-owner.v1')).toBe('reader-b');
  });

  it('logout cancels a registration still waiting for the native token', async () => {
    state.permission.granted = true;
    let resolveToken: ((value: { data: string }) => void) | undefined;
    state.getToken.mockImplementation(
      () =>
        new Promise<{ data: string }>((resolve) => {
          resolveToken = resolve;
        }),
    );
    const push = await import('../../mobile/src/lib/notifications');
    const registering = push.registerForPush('reader-a');
    await vi.waitFor(() => expect(state.getToken).toHaveBeenCalledOnce());
    const leaving = push.unregisterPush();
    resolveToken?.({ data: 'ExponentPushToken[phone-0001]' });
    expect(await registering).toBe('unavailable');
    await leaving;
    expect(state.registered).not.toHaveBeenCalled();
    expect(state.storage.size).toBe(0);
  });
});
