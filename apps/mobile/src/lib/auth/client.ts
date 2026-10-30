import { expoClient } from '@better-auth/expo/client';
import { API_PREFIX, APP_SCHEME, AUTH_CLIENT_HEADER, AUTH_CLIENT_LOGIN_CODE } from '@bubo/config';
import { API_ROUTES } from '@bubo/contracts';
import { emailOTPClient, twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

import { publicConfig } from '../config';

/**
 * Better Auth client. The Expo plugin keeps the session cookie in the device keychain/keystore
 * (expo-secure-store) and attaches it to auth requests; `getCookie()` exposes it for our API.
 * The two-factor client handles the e-mailed login code and trusted devices; the e-mail OTP
 * client handles password reset by code (ADR-038). Screens decide where to navigate.
 */
export const authClient = createAuthClient({
  baseURL: `${publicConfig.apiUrl}${API_PREFIX}${API_ROUTES.auth}`,
  // This build finishes sign-ins with the e-mailed code; older builds are told to update (ADR-040).
  fetchOptions: { headers: { [AUTH_CLIENT_HEADER]: AUTH_CLIENT_LOGIN_CODE } },
  plugins: [
    expoClient({
      scheme: APP_SCHEME,
      storagePrefix: APP_SCHEME,
      storage: SecureStore,
    }),
    twoFactorClient(),
    emailOTPClient(),
  ],
});

/** Headers that authenticate a request to the Bubo API (empty when signed out). */
export async function authHeaders(): Promise<Record<string, string>> {
  const cookie = await authClient.getCookie();
  return cookie ? { cookie } : {};
}
