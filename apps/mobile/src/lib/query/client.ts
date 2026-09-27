import NetInfo from '@react-native-community/netinfo';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { ApiError } from '../api/client';

/**
 * TanStack Query is the only home for server state (no Redux). Local UI state stays in
 * components/context.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        // Kept as long as the persisted cache (lib/query/persist.ts) so restored data survives.
        gcTime: 24 * 60 * 60_000,
        retry: (failureCount, error) =>
          failureCount < 3 && (!(error instanceof ApiError) || error.retryable),
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 15_000),
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

let wired = false;

/**
 * Connects TanStack Query to React Native: NetInfo drives online/offline (queries pause offline
 * and resume on reconnect) and AppState drives "focus" refetching. Idempotent.
 */
export function wireQueryToReactNative() {
  if (wired) return;
  wired = true;

  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    }),
  );

  if (Platform.OS !== 'web') {
    AppState.addEventListener('change', (status) => focusManager.setFocused(status === 'active'));
  }
}
