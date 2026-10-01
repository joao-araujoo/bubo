import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { type QueryClient } from '@tanstack/react-query';
import { type PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import Constants from 'expo-constants';

/**
 * Offline-first cache (ADR-016): successful queries (shelf, stats, recall, catalog) are written to
 * AsyncStorage so the app opens instantly with the last known data and refreshes in background.
 *
 * - Keys are scoped by user id, and everything is wiped on sign-out / account deletion.
 * - The session cookie is NOT here (it stays in SecureStore).
 * - `buster` = app version: a new build never reads a cache shaped by an older one.
 */
export const CACHE_MAX_AGE_MS = 24 * 60 * 60_000;

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  // Bump when a persisted response shape gains a required field (v2: shelf detail `reviews`,
  // Task 06; v3: community and memory shapes, Task 08; v4: review tags and friends, Task 08
  // slice 2), so an OTA update with the same app version never reads an older shape.
  key: 'bubo.query-cache.v4',
  throttleTime: 1_000,
});

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: CACHE_MAX_AGE_MS,
  buster: Constants.expoConfig?.version ?? 'dev',
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      query.state.status === 'success' &&
      !['system', 'moderation', 'friends-feed'].includes(String(query.queryKey[0])),
  },
};

/** Drops the in-memory and the persisted cache (sign-out, account deletion, revoked session). */
export async function clearQueryCache(queryClient: QueryClient) {
  queryClient.clear();
  try {
    await persister.removeClient();
  } catch {
    // Storage unavailable: the in-memory cache is already gone.
  }
}
