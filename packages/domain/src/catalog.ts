/**
 * Pure catalog helpers shared by the API (merge/dedupe, cover hardening) and the mobile app
 * (typographic cover fallback). See ADR-016.
 */

/** Catalog ids: `isbn:<ISBN-13>`, `gb:<Google Books volume id>`, `ol:<Open Library work id>`. */
export const CATALOG_ID_PATTERN = /^(isbn:97[89]\d{10}|gb:[A-Za-z0-9_-]{6,40}|ol:OL\d{1,12}W)$/;

export type CatalogSource = 'google' | 'openlibrary';

export function isCatalogId(value: string): boolean {
  return CATALOG_ID_PATTERN.test(value);
}

/** Lowercase, accent-free, punctuation-free, single-spaced text for matching. */
export function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Match key for "the same work" across sources: folded title (subtitle dropped) + first author's
 * last name. Editions of the same work in the same language collapse into one result.
 */
export function workMatchKey(title: string, authors: readonly string[]): string {
  const mainTitle = foldText(title.split(/[:(\u2013\u2014]/)[0] ?? title).replace(
    /^(o|a|os|as|the) /,
    '',
  );
  const firstAuthor = foldText(authors[0] ?? '');
  const lastName = firstAuthor.split(' ').pop() ?? '';
  return `${mainTitle}|${lastName}`;
}

/** Hosts the API accepts cover images from (https only). */
export const COVER_HOSTS = [
  'books.google.com',
  'books.googleusercontent.com',
  'covers.openlibrary.org',
] as const;

/**
 * Hardens a cover URL from a catalog source: forces https, keeps only allowlisted hosts and asks
 * Google for a larger, flat (no page curl) image. Returns null for anything else.
 */
export function hardenCoverUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Parsed by hand: this module runs in Workers, Node and React Native without relying on `URL`.
  // The host group excludes `@` and `:`, so credentials and custom ports never match.
  const match = /^https?:\/\/([a-z0-9.-]+)(\/[^\s?#]*)?(?:\?([^\s#]*))?$/i.exec(raw.trim());
  if (!match) return null;
  const host = (match[1] ?? '').toLowerCase();
  if (!(COVER_HOSTS as readonly string[]).includes(host)) return null;
  const path = match[2] ?? '/';
  let params = (match[3] ?? '').split('&').filter((part) => part.length > 0);
  if (host !== 'covers.openlibrary.org') {
    params = params.filter((part) => !/^(edge|zoom|fife)=/.test(part));
    params.push('zoom=1', 'fife=w400-h600');
  }
  const value = `https://${host}${path}${params.length ? `?${params.join('&')}` : ''}`;
  return value.length <= 600 ? value : null;
}

/** Open Library cover by ISBN; `default=false` makes a missing cover a 404 (never a blank image). */
export function openLibraryIsbnCover(isbn13: string): string {
  return `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg?default=false`;
}

/** Open Library cover by cover id. */
export function openLibraryCoverById(coverId: number): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg?default=false`;
}

/** Ordered, de-duplicated cover candidates for a stored book. The client tries them in order. */
export function coverCandidates(input: {
  coverUrl: string | null;
  isbn13: string | null;
  extra?: readonly (string | null | undefined)[];
}): string[] {
  const list = [
    input.coverUrl,
    ...(input.extra ?? []),
    input.isbn13 ? openLibraryIsbnCover(input.isbn13) : null,
  ]
    .map((url) => hardenCoverUrl(url))
    .filter((url): url is string => url !== null);
  return [...new Set(list)].slice(0, 4);
}

/** Up to two initials for the typographic cover fallback ("O Hobbit" → "OH"). */
export function titleInitials(title: string): string {
  const words = title
    .trim()
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word));
  const letters = words
    .slice(0, 2)
    .map((word) => [...word.replace(/^[^\p{L}\p{N}]+/u, '')][0] ?? '');
  return letters.join('').toUpperCase() || '?';
}

/** Stable 0..n-1 bucket for a string (picks the fallback cover palette per book). */
export function stableBucket(value: string, buckets: number): number {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return buckets > 0 ? hash % buckets : 0;
}

/** First 4-digit year in a free-form date ("2019-05-02", "May 2019", "c1965"). */
export function parsePublishedYear(value: string | number | null | undefined): number | null {
  if (typeof value === 'number')
    return Number.isInteger(value) && value > 0 && value <= 2100 ? value : null;
  const match = value?.match(/\b(\d{4})\b/);
  const year = match ? Number(match[1]) : NaN;
  return year > 0 && year <= 2100 ? year : null;
}
