import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';
import { createAuthClient } from 'better-auth/react';

const baseURL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    expoClient({
      scheme: 'bubo',
      storagePrefix: 'bubo',
      storage: SecureStore,
    }),
  ],
});
