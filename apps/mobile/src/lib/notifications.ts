import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type * as NotificationsModule from 'expo-notifications';
import { type Href, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { lightColors } from '../theme';
import { api } from './api/client';

/**
 * Push notifications (Task 09, ADR-022). The API decides what to send (it knows due cards, replies
 * and friend requests); the device only registers its Expo token, shows what arrives and opens the
 * right screen when tapped.
 */

const TOKEN_KEY = 'bubo.push-token.v1';

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

/** Paths a notification may open; anything else is ignored. */
const ALLOWED_PREFIXES = [
  '/revisar',
  '/notificacoes',
  '/amigos',
  '/debates/',
  '/resenhas/',
  '/ciclos/',
];

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
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
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
    const { granted } = await Notifications.getPermissionsAsync();
    return granted;
  } catch {
    return false;
  }
}

/**
 * Asks for permission when needed (Android 13+ shows the system prompt only after a channel
 * exists), gets the Expo push token and sends it to the API.
 */
export async function registerForPush(): Promise<PushState> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return 'unavailable';
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return 'unavailable';
    await ensureAndroidChannels(Notifications);
    const current = await Notifications.getPermissionsAsync();
    const granted =
      current.granted ||
      (current.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
    if (!granted) return 'denied';
    const id = projectId();
    if (isExpoGo || !id) return 'unavailable';
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    await api.registerPushToken({ token, platform: Platform.OS });
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return 'registered';
  } catch {
    return 'unavailable';
  }
}

/** What the settings screen shows, without prompting: 'off' = never asked or not registered. */
export async function currentPushState(): Promise<PushState | 'off'> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return 'unavailable';
    const { granted, canAskAgain } = await Notifications.getPermissionsAsync();
    if (!granted) return canAskAgain ? 'off' : 'denied';
    if (isExpoGo || !projectId()) return 'unavailable';
    return (await AsyncStorage.getItem(TOKEN_KEY)) ? 'registered' : 'off';
  } catch {
    return 'unavailable';
  }
}

/** Sign-out: this device stops receiving pushes for the account (best effort). */
export async function unregisterPush() {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await AsyncStorage.removeItem(TOKEN_KEY);
    await api.removePushToken(token);
  } catch {
    // Offline: the API drops tokens Expo reports as unregistered, and a token moves to the next
    // account that signs in on this device.
  }
}

/** Re-sends a known token at start-up (it can change after reinstalling or restoring). */
export async function refreshPushRegistration() {
  try {
    if (!(await AsyncStorage.getItem(TOKEN_KEY))) return;
    if (await notificationsAllowed()) await registerForPush();
  } catch {
    // Nothing to do: the next start tries again.
  }
}

function pathOf(response: NotificationsModule.NotificationResponse | null): Href | null {
  const url = response?.notification.request.content.data?.url;
  if (typeof url !== 'string') return null;
  return ALLOWED_PREFIXES.some((prefix) => url === prefix || url.startsWith(prefix))
    ? (url as Href)
    : null;
}

/** Opens the screen a tapped notification points to, also when it launched the app. */
export function useNotificationNavigation(enabled: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let subscription: { remove: () => void } | undefined;
    void loadNotifications().then((Notifications) => {
      if (!Notifications || !active) return;
      const initial = pathOf(Notifications.getLastNotificationResponse());
      if (initial) {
        router.push(initial);
        Notifications.clearLastNotificationResponse();
      }
      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const path = pathOf(response);
        if (path) router.push(path);
      });
      void refreshPushRegistration();
    });
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [enabled, router]);
}
