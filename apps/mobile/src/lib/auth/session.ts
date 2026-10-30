import { type MeResponse } from '@bubo/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { ApiError } from '../api/client';
import { useMe } from '../api/queries';
import { haptics } from '../haptics';
import { unregisterPush } from '../notifications';
import { clearQueryCache } from '../query/persist';
import { sessionIsBooting } from './auth-status';
import { authClient } from './client';
import { keepTrustedDeviceCookies, restoreTrustedDeviceCookies } from './trusted-device';

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
  const [resolved, setResolved] = useState(!session.isPending);
  // Adjusting state during render (React's "previous render" pattern): once the session resolved,
  // later refetches never send the navigator back to the boot screen.
  if (!session.isPending && !resolved) setResolved(true);

  if (sessionIsBooting({ pending: session.isPending, resolvedBefore: resolved })) {
    return { status: 'loading' };
  }
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

/**
 * Signs out, then drops every cached query so nothing from this account survives. "Lembrar este
 * aparelho" survives a sign-out: the trust cookie is bound to the account on the server.
 */
export function useSignOut() {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    haptics.press();
    // While the session is still valid: this device stops receiving the account's pushes.
    await unregisterPush();
    const trusted = await keepTrustedDeviceCookies();
    await authClient.signOut();
    await restoreTrustedDeviceCookies(trusted);
    await clearQueryCache(queryClient);
  }, [queryClient]);
}
