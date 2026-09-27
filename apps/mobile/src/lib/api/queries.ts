import {
  type AddBookRequest,
  type CreateCardRequest,
  type CreateSessionRequest,
  type MeResponse,
  type OnboardingRequest,
  type ReviewRequest,
  type UpdateShelfEntryRequest,
} from '@bubo/contracts';
import { toLocalIsoDate } from '@bubo/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, ApiError } from './client';

/** Query keys live in one place so invalidation stays predictable. */
export const queryKeys = {
  system: {
    health: ['system', 'health'] as const,
  },
  /** Scoped by user id so a different account never sees cached data from the previous one. */
  me: (userId: string) => ['me', userId] as const,
  shelf: (userId: string) => ['shelf', userId] as const,
  shelfEntry: (userId: string, entryId: string) => ['shelf', userId, entryId] as const,
  stats: (userId: string, today: string) => ['stats', userId, today] as const,
  due: (userId: string, today: string) => ['recall', userId, today] as const,
  catalogSearch: (userId: string, q: string) => ['catalog', userId, 'search', q] as const,
  catalogBook: (userId: string, catalogId: string) =>
    ['catalog', userId, 'book', catalogId] as const,
  catalogIsbn: (userId: string, isbn: string) => ['catalog', userId, 'isbn', isbn] as const,
};

/** Normalized search text (the cache key and the request share it). */
export function normalizeCatalogQuery(q: string) {
  return q.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Catalog search. Results are cached for a day on the server and kept here for 30 minutes. */
export function useCatalogSearch(userId: string | undefined, q: string) {
  const query = normalizeCatalogQuery(q);
  return useQuery({
    queryKey: queryKeys.catalogSearch(userId ?? 'anonymous', query),
    queryFn: ({ signal }) => api.searchCatalog(query, signal),
    enabled: userId !== undefined && query.length >= 2,
    staleTime: 30 * 60_000,
    placeholderData: (previous) => previous,
  });
}

/** Barcode lookup. isbn must already be a valid ISBN-13 (the scanner validates it). */
export function useIsbnLookup(userId: string | undefined, isbn: string | null) {
  return useQuery({
    queryKey: queryKeys.catalogIsbn(userId ?? 'anonymous', isbn ?? ''),
    queryFn: ({ signal }) => api.lookupIsbn(isbn ?? '', signal),
    enabled: userId !== undefined && userId !== '' && isbn !== null,
    staleTime: 10 * 60_000,
    retry: (count, error) => count < 2 && error instanceof ApiError && error.retryable,
  });
}

export function useCatalogBook(userId: string | undefined, catalogId: string) {
  return useQuery({
    queryKey: queryKeys.catalogBook(userId ?? 'anonymous', catalogId),
    queryFn: ({ signal }) => api.getCatalogBook(catalogId, signal),
    enabled: userId !== undefined && catalogId !== '',
    staleTime: 10 * 60_000,
  });
}

/** API liveness (used by the DEV showcase and diagnostics). */
export function useApiHealth(enabled = true) {
  return useQuery({
    queryKey: queryKeys.system.health,
    queryFn: ({ signal }) => api.getHealth(signal),
    enabled,
    staleTime: 30_000,
  });
}

/** The signed-in reader (profile + onboarding state). */
export function useMe(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.me(userId ?? 'anonymous'),
    queryFn: ({ signal }) => api.getMe(signal),
    enabled: userId !== undefined,
    staleTime: 5 * 60_000,
    // Gates navigation on launch: fail fast to the retry screen instead of a long splash.
    retry: 1,
  });
}

export function useShelf(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.shelf(userId ?? 'anonymous'),
    queryFn: ({ signal }) => api.getShelf(signal),
    enabled: userId !== undefined,
  });
}

export function useShelfEntry(userId: string | undefined, entryId: string) {
  return useQuery({
    queryKey: queryKeys.shelfEntry(userId ?? 'anonymous', entryId),
    queryFn: ({ signal }) => api.getShelfEntry(entryId, signal),
    enabled: userId !== undefined && entryId !== '',
  });
}

/** Stats for the reader's *local* today (streaks follow the device's calendar day). */
export function useStats(userId: string | undefined) {
  const today = toLocalIsoDate(new Date());
  return useQuery({
    queryKey: queryKeys.stats(userId ?? 'anonymous', today),
    queryFn: ({ signal }) => api.getStats(today, signal),
    enabled: userId !== undefined,
  });
}

/** Recall cards due on the reader's local today. */
export function useDueCards(userId: string | undefined) {
  const today = toLocalIsoDate(new Date());
  return useQuery({
    queryKey: queryKeys.due(userId ?? 'anonymous', today),
    queryFn: ({ signal }) => api.getDueCards(today, signal),
    enabled: userId !== undefined,
  });
}

/** Everything that depends on the shelf, sessions or reviews is refreshed together. */
function useInvalidateReading(userId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['shelf', userId] }),
      queryClient.invalidateQueries({ queryKey: ['stats', userId] }),
      queryClient.invalidateQueries({ queryKey: ['recall', userId] }),
      // "Já está na estante" on catalog screens.
      queryClient.invalidateQueries({ queryKey: ['catalog', userId, 'book'] }),
    ]);
}

export function useCreateCard(userId: string) {
  const invalidate = useInvalidateReading(userId);
  return useMutation({
    mutationFn: (body: CreateCardRequest) => api.createCard(body),
    onSuccess: invalidate,
  });
}

export function useDeleteCard(userId: string) {
  const invalidate = useInvalidateReading(userId);
  return useMutation({ mutationFn: (id: string) => api.deleteCard(id), onSuccess: invalidate });
}

/** Review mutations do NOT refetch the due list mid-session (the queue stays stable). */
export function useReviewCard() {
  return useMutation({
    mutationFn: ({ cardId, body }: { cardId: string; body: ReviewRequest }) =>
      api.reviewCard(cardId, body),
  });
}

export function useRefreshAfterReview(userId: string) {
  return useInvalidateReading(userId);
}

export function useAddBook(userId: string) {
  const invalidate = useInvalidateReading(userId);
  return useMutation({
    mutationFn: (body: AddBookRequest) => api.addBook(body),
    onSuccess: invalidate,
  });
}

export function useUpdateShelfEntry(userId: string, entryId: string) {
  const invalidate = useInvalidateReading(userId);
  return useMutation({
    mutationFn: (body: UpdateShelfEntryRequest) => api.updateShelfEntry(entryId, body),
    onSuccess: invalidate,
  });
}

export function useDeleteShelfEntry(userId: string, entryId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateReading(userId);
  return useMutation({
    mutationFn: () => api.deleteShelfEntry(entryId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: queryKeys.shelfEntry(userId, entryId) });
      await invalidate();
    },
  });
}

export function useRecordSession(userId: string) {
  const invalidate = useInvalidateReading(userId);
  return useMutation({
    mutationFn: (body: CreateSessionRequest) => api.recordSession(body),
    onSuccess: invalidate,
  });
}

/**
 * Saves onboarding. The `me` cache is NOT updated here on purpose: the "Pronto!" screen is shown
 * first, and `finishOnboarding` flips the navigation guard when the reader taps "Ir para o Bubo".
 */
export function useCompleteOnboarding(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: OnboardingRequest) => api.completeOnboarding(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shelf(userId) }),
  });
}

export function useFinishOnboarding(userId: string) {
  const queryClient = useQueryClient();
  return (me: MeResponse) => queryClient.setQueryData(queryKeys.me(userId), me);
}
