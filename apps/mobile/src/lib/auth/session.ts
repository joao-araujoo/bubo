import { type MeResponse } from '@bubo/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { ApiError } from '../api/client';
import { useMe } from '../api/queries';
import { haptics } from '../haptics';
import { clearQueryCache } from '../query/persist';
import { authClient } from './client';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  /** `unauthorized`: the server no longer accepts the stored session (revoked/expired). */
  | { status: 'error'; unauthorized: boolean; retry: () => void }
  | { status: 'needs_onboarding'; userId: string; me: MeResponse }
  | { status: 'ready'; userId: string; me: MeResponse };

/**
 * Single source of truth for navigation guards: Better Auth session (cached in SecureStore) +
 * the reader's onboarding state from GET /v1/me.
 */
export function useAuthState(): AuthState {
  const session = authClient.useSession();
  const userId = session.data?.user.id;
  const me = useMe(userId);

  if (session.isPending) return { status: 'loading' };
  if (!userId) return { status: 'signed_out' };
  if (me.data) {
    return me.data.onboardingCompleted
      ? { status: 'ready', userId, me: me.data }
      : { status: 'needs_onboarding', userId, me: me.data };
  }
  if (me.isError) {
    const unauthorized = me.error instanceof ApiError && me.error.status === 401;
    return { status: 'error', unauthorized, retry: () => void me.refetch() };
  }
  return { status: 'loading' };
}

/** Signs out, then drops every cached query so nothing from this account survives. */
export function useSignOut() {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    haptics.press();
    await authClient.signOut();
    await clearQueryCache(queryClient);
  }, [queryClient]);
}
