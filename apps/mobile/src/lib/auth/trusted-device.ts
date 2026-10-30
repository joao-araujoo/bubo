import { APP_SCHEME } from '@bubo/config';
import * as SecureStore from 'expo-secure-store';

/**
 * "Lembrar este aparelho" (ADR-038). The server trusts a device through a signed
 * `trust_device` cookie that lives in the Better Auth cookie jar. The Expo client wipes that jar
 * on sign-out, so the trust is kept aside before signing out and put back afterwards. The jar is
 * `@better-auth/expo`'s own storage entry (`${storagePrefix}_cookie`); if its format ever changes
 * these helpers simply find nothing and the reader is asked for a code again.
 */
const COOKIE_JAR_KEY = `${APP_SCHEME}_cookie`;
const CHUNK_MARKER = 'ba-chunks:';

export type TrustedDeviceCookies = Record<string, unknown>;

function parseJar(raw: string | null): Record<string, unknown> | null {
  if (!raw || raw.startsWith(CHUNK_MARKER)) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** The trust cookies inside a jar, or null when there is nothing worth keeping. */
export function pickTrustedDeviceCookies(raw: string | null): TrustedDeviceCookies | null {
  const jar = parseJar(raw);
  if (!jar) return null;
  const kept: TrustedDeviceCookies = {};
  for (const [name, value] of Object.entries(jar)) {
    if (name.includes('trust_device') && value && typeof value === 'object') kept[name] = value;
  }
  return Object.keys(kept).length > 0 ? kept : null;
}

/** A jar with the kept trust cookies merged back in (the current jar wins on conflicts). */
export function mergeTrustedDeviceCookies(raw: string | null, kept: TrustedDeviceCookies): string {
  return JSON.stringify({ ...kept, ...(parseJar(raw) ?? {}) });
}

export async function keepTrustedDeviceCookies(): Promise<TrustedDeviceCookies | null> {
  try {
    return pickTrustedDeviceCookies(await SecureStore.getItemAsync(COOKIE_JAR_KEY));
  } catch {
    return null;
  }
}

export async function restoreTrustedDeviceCookies(kept: TrustedDeviceCookies | null) {
  if (!kept) return;
  try {
    const raw = await SecureStore.getItemAsync(COOKIE_JAR_KEY);
    await SecureStore.setItemAsync(COOKIE_JAR_KEY, mergeTrustedDeviceCookies(raw, kept));
  } catch {
    // Best effort: without the trust cookie the reader is simply asked for a code next time.
  }
}
