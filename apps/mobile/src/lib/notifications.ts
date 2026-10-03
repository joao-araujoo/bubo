import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type * as NotificationsModule from 'expo-notifications';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { lightColors } from '../theme/colors';
import { api } from './api/client';
import { notificationMatchesUser, notificationPath } from './notification-policy';

/**
 * Push notifications (Task 09, ADR-022). The API decides what to send (it knows due cards, replies
 * and friend requests); the device only registers its Expo token, shows what arrives and opens the
 * right screen when tapped.
 */

const TOKEN_KEY = 'bubo.push-token.v1';
const OWNER_KEY = 'bubo.push-owner.v1';
const REMOVAL_KEY = 'bubo.push-removal.v1';
let registration: { userId: string; promise: Promise<PushState> } | null = null;
let registrationEpoch = 0;
let notificationAccount: string | null = null;

/** Called at account transitions, including forced sign-out; cancels in-flight work. */
export function setNotificationAccount(userId: string | null) {
  if (notificationAccount === userId) return;
  notificationAccount = userId;
  registrationEpoch += 1;
}

/** Android channels — ids must match the API (`PUSH_CHANNEL`). The reader can mute each one. */
const ANDROID_CHANNELS = [
  {
    id: 'lembretes',
    name: 'Lembretes de revisão',
    description: 'Um aviso por dia, no horário escolhido, quando há lembranças para revisar.',
  },
  {
    id: 'comunidade',
    name: 'Comunidade',
    description: 'Respostas às suas discussões, pedidos de amizade e novos ciclos dos clubes.',
  },
] as const;

export type PushState =
  | 'registered'
  | 'denied'
  /** Expo Go, an emulator or a build without push credentials (Firebase / EAS project). */
  | 'unavailable';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type Notifications = typeof NotificationsModule;
let loading: Promise<Notifications | null> | null = null;

/**
 * Loads `expo-notifications` on demand. Expo Go on Android (SDK 53+) throws as soon as the module
 * is evaluated, which used to break every route; there, and on web, push is simply unavailable.
 */
function loadNotifications(): Promise<Notifications | null> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return Promise.resolve(null);
  if (isExpoGo && Platform.OS === 'android') return Promise.resolve(null);
  loading ??= import('expo-notifications')
    .then((Notifications) => {
      Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          const display =
            notificationAccount !== null &&
            notificationMatchesUser(notification.request.content.data, notificationAccount);
          return {
            shouldShowBanner: display,
            shouldShowList: display,
            shouldPlaySound: false,
            shouldSetBadge: false,
          };
        },
      });
      return Notifications;
    })
    .catch(() => null);
  return loading;
}

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

function hasPermission(
  Notifications: Notifications,
  permission: NotificationsModule.NotificationPermissionsStatus,
) {
  return (
    permission.granted ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

async function ensureAndroidChannels(Notifications: Notifications) {
  if (Platform.OS !== 'android') return;
  await Promise.all(
    ANDROID_CHANNELS.map((channel) =>
      Notifications.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        description: channel.description,
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: lightColors.primary,
        vibrationPattern: [0, 180, 120, 180],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      }),
    ),
  );
}

/** Whether the system already allows notifications (no prompt). */
export async function notificationsAllowed(): Promise<boolean> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return false;
    return hasPermission(Notifications, await Notifications.getPermissionsAsync());
  } catch {
    return false;
  }
}

/**
 * Asks for permission when needed (Android 13+ shows the system prompt only after a channel
 * exists), gets the Expo push token and sends it to the API.
 */
async function performRegistration(userId: string, askPermission: boolean): Promise<PushState> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return 'unavailable';
  const epoch = registrationEpoch;
  try {
    // Check the build before any system permission prompt. Expo Go and unconfigured builds
    // must not ask for a capability they cannot actually register.
    if (isExpoGo || !projectId()) return 'unavailable';
    const Notifications = await loadNotifications();
    if (!Notifications) return 'unavailable';
    await ensureAndroidChannels(Notifications);
    const current = await Notifications.getPermissionsAsync();
    const granted =
      hasPermission(Notifications, current) ||
      (askPermission &&
        current.canAskAgain &&
        hasPermission(
          Notifications,
          await Notifications.requestPermissionsAsync({
            ios: { allowAlert: true, allowSound: true, allowBadge: false },
          }),
        ));
    if (!granted) return 'denied';
    const id = projectId();
    if (!id) return 'unavailable';
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    if (epoch !== registrationEpoch) return 'unavailable';
    await api.registerPushToken({ token, platform: Platform.OS, expectedUserId: userId });
    if (epoch !== registrationEpoch) return 'unavailable';
    await AsyncStorage.setItem(TOKEN_KEY, token);
    await AsyncStorage.setItem(OWNER_KEY, userId);
    // A registration transfers this token to the active account; no old removal may undo it.
    if ((await AsyncStorage.getItem(REMOVAL_KEY)) === token)
      await AsyncStorage.removeItem(REMOVAL_KEY);
    return 'registered';
  } catch {
    return 'unavailable';
  }
}

/** Only an explicit reader action may call with askPermission=true. */
export function registerForPush(userId: string, askPermission = true): Promise<PushState> {
  if (!userId) return Promise.resolve('unavailable');
  if (notificationAccount && notificationAccount !== userId) return Promise.resolve('unavailable');
  if (registration) {
    if (registration.userId === userId) return registration.promise;
    return registration.promise.then(() => registerForPush(userId, askPermission));
  }
  const promise = performRegistration(userId, askPermission).finally(() => {
    if (registration?.promise === promise) registration = null;
  });
  registration = { userId, promise };
  return promise;
}

/** What the settings screen shows, without prompting: 'off' = never asked or not registered. */
export async function currentPushState(userId?: string): Promise<PushState | 'off'> {
  try {
    if (isExpoGo || !projectId()) return 'unavailable';
    const Notifications = await loadNotifications();
    if (!Notifications) return 'unavailable';
    const permission = await Notifications.getPermissionsAsync();
    if (!hasPermission(Notifications, permission)) return permission.canAskAgain ? 'off' : 'denied';
    if (isExpoGo || !projectId()) return 'unavailable';
    if (await AsyncStorage.getItem(REMOVAL_KEY)) return 'off';
    const owner = await AsyncStorage.getItem(OWNER_KEY);
    if (userId && owner && owner !== userId) return 'off';
    return (await AsyncStorage.getItem(TOKEN_KEY)) ? 'registered' : 'off';
  } catch {
    return 'unavailable';
  }
}

/** Sign-out: this device stops receiving pushes for the account (best effort). */
export async function unregisterPush() {
  registrationEpoch += 1;
  setNotificationAccount(null);
  await registration?.promise;
  try {
    const Notifications = await loadNotifications();
    if (Notifications) {
      await Notifications.dismissAllNotificationsAsync();
      Notifications.clearLastNotificationResponse();
    }
  } catch {
    /* Delivered alerts are also removed when the device allows it. */
  }
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    // Durable retry: offline sign-out cannot revoke a server token, so never forget it locally.
    await AsyncStorage.setItem(REMOVAL_KEY, token);
    await api.removePushToken(token);
    await AsyncStorage.multiRemove([TOKEN_KEY, OWNER_KEY, REMOVAL_KEY]);
  } catch {
    // The removal is retried if this account returns. Server session revocation also deletes
    // its tokens. An alert already accepted by APNs/FCM cannot be retracted remotely.
  }
}

/** Re-sends a known token at start-up (it can change after reinstalling or restoring). */
export async function refreshPushRegistration(userId: string) {
  try {
    if (!(await AsyncStorage.getItem(TOKEN_KEY))) return;
    const owner = await AsyncStorage.getItem(OWNER_KEY);
    if (owner && owner !== userId) return;
    const pending = await AsyncStorage.getItem(REMOVAL_KEY);
    if (pending) {
      await api.removePushToken(pending);
      await AsyncStorage.multiRemove([TOKEN_KEY, OWNER_KEY, REMOVAL_KEY]);
      return;
    }
    if (await notificationsAllowed()) await registerForPush(userId, false);
    else await unregisterPush();
  } catch {
    // Nothing to do: the next start tries again.
  }
}

/** Opens the screen a tapped notification points to, also when it launched the app. */
export function useNotificationNavigation(userId: string | null) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const handled = useRef(new Set<string>());
  useLayoutEffect(() => {
    setNotificationAccount(userId);
  }, [userId]);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    const subscriptions: { remove: () => void }[] = [];
    void loadNotifications().then((Notifications) => {
      if (!Notifications || !active) return;
      const refresh = () => {
        if (active) void refreshPushRegistration(userId);
      };
      const open = (response: NotificationsModule.NotificationResponse | null) => {
        if (!active || !response) return;
        Notifications.clearLastNotificationResponse();
        if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
        const { data } = response.notification.request.content;
        if (!notificationMatchesUser(data, userId)) return;
        const path = notificationPath(data?.url);
        const id = response.notification.request.identifier;
        if (!path || handled.current.has(id)) return;
        if (handled.current.size > 50) handled.current.clear();
        handled.current.add(id);
        router.push(path as Href);
      };
      subscriptions.push(Notifications.addNotificationResponseReceivedListener(open));
      subscriptions.push(
        Notifications.addNotificationReceivedListener((notification) => {
          if (notificationMatchesUser(notification.request.content.data, userId)) {
            void queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
          }
        }),
      );
      subscriptions.push(Notifications.addPushTokenListener(refresh));
      subscriptions.push(
        AppState.addEventListener('change', (state) => {
          if (state === 'active') refresh();
        }),
      );
      open(Notifications.getLastNotificationResponse());
      refresh();
    });
    return () => {
      active = false;
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [userId, router, queryClient]);
}
