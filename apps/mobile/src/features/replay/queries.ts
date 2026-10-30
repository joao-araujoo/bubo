import { type ReplayQuery } from '@bubo/contracts';
import { useQuery } from '@tanstack/react-query';

import { api, ApiError } from '../../lib/api/client';
import { queryKeys } from '../../lib/api/queries';

export function useReplay(userId: string | undefined, query: ReplayQuery) {
  return useQuery({
    queryKey: queryKeys.replay(userId ?? 'anonymous', query),
    queryFn: ({ signal }) => api.getReplay(query, signal),
    enabled: Boolean(userId),
    refetchOnMount: 'always',
    staleTime: 60_000,
    retry: (count, error) => count < 2 && error instanceof ApiError && error.retryable,
  });
}
