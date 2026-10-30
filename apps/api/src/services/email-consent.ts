import { API_PREFIX } from '@bubo/config';
import { API_ROUTES } from '@bubo/contracts';
import { type Executor, schema } from '@bubo/database';
import { eq } from 'drizzle-orm';

import { getPreferences, savePreferences } from './preferences';

const { users } = schema;

/**
 * One-click opt-out links for optional e-mails (ADR-038, RFC 8058). The token is an HMAC over the
 * reader id signed with the auth secret: it carries no personal data, cannot be forged and keeps
 * working for links in old e-mails. Rotating the secret invalidates every link, which is fine.
 */
const PURPOSE = 'bubo-email-unsubscribe-v1';
const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const padded = value
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  try {
    return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

async function signature(secret: string, userId: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(`${PURPOSE}:${userId}`)),
  );
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export async function createUnsubscribeToken(secret: string, userId: string): Promise<string> {
  return `${toBase64Url(encoder.encode(userId))}.${toBase64Url(await signature(secret, userId))}`;
}

/** The reader id carried by a valid token, or null for anything malformed or tampered. */
export async function verifyUnsubscribeToken(
  secret: string,
  token: string,
): Promise<string | null> {
  if (typeof token !== 'string' || token.length > 512) return null;
  const [idPart, signaturePart, extra] = token.split('.');
  if (!idPart || !signaturePart || extra !== undefined) return null;
  const idBytes = fromBase64Url(idPart);
  const given = fromBase64Url(signaturePart);
  if (!idBytes || !given) return null;
  const userId = new TextDecoder().decode(idBytes);
  if (!userId || userId.length > 255) return null;
  const expected = await signature(secret, userId);
  return constantTimeEqual(expected, given) ? userId : null;
}

/** Absolute link for the e-mail footer and the List-Unsubscribe header. */
export function unsubscribeUrl(baseUrl: string, token: string): string {
  const url = new URL(`${API_PREFIX}${API_ROUTES.emailUnsubscribe}`, baseUrl);
  url.searchParams.set('token', token);
  return url.href;
}

/**
 * Turns the optional reading-return e-mail off. Returns false when the account no longer exists
 * (the link then simply has nothing left to do).
 */
export async function unsubscribeReadingReminders(db: Executor, userId: string): Promise<boolean> {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return false;
  const current = await getPreferences(db, userId);
  if (current.emailReadingReminders) {
    await savePreferences(db, userId, { ...current, emailReadingReminders: false });
  }
  return true;
}
