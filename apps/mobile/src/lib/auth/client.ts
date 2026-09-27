import { expoClient } from '@better-auth/expo/client';
import { API_PREFIX, APP_SCHEME } from '@bubo/config';
import { API_ROUTES } from '@bubo/contracts';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

import { publicConfig } from '../config';

/**
 * Better Auth client. The Expo plugin keeps the session cookie in the device keychain/keystore
 * (expo-secure-store) and attaches it to auth requests; `getCookie()` exposes it for our API.
 */
export const authClient = createAuthClient({
  baseURL: `${publicConfig.apiUrl}${API_PREFIX}${API_ROUTES.auth}`,
  plugins: [
    expoClient({
      scheme: APP_SCHEME,
      storagePrefix: APP_SCHEME,
      storage: SecureStore,
    }),
  ],
});

/** Headers that authenticate a request to the Bubo API (empty when signed out). */
export async function authHeaders(): Promise<Record<string, string>> {
  const cookie = await authClient.getCookie();
  return cookie ? { cookie } : {};
}
