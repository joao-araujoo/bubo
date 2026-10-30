import { authClient } from '../../lib/auth/client';
import { authErrorMessage } from './messages';

export type SignInOutcome =
  | { kind: 'signed_in' }
  /** Untrusted device: the login code is already on its way (ADR-038). */
  | { kind: 'code' }
  | { kind: 'error'; message: string };

/**
 * E-mail + password sign-in shared by "Entrar" and the password reset fallback. On an untrusted
 * device the server withholds the session and the code is requested right away, so the caller
 * only has to open the code screen.
 */
export async function signInWithPassword(email: string, password: string): Promise<SignInOutcome> {
  const { data, error } = await authClient.signIn.email({ email, password });
  if (error) return { kind: 'error', message: authErrorMessage(error) };
  if (
    data &&
    typeof data === 'object' &&
    'twoFactorRedirect' in data &&
    data.twoFactorRedirect === true
  ) {
    const sent = await authClient.twoFactor.sendOtp();
    if (sent.error) return { kind: 'error', message: authErrorMessage(sent.error) };
    return { kind: 'code' };
  }
  return { kind: 'signed_in' };
}
