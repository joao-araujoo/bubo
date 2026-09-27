import { COVER_HOSTS } from '@bubo/domain';

import { type FetchLike } from './catalog';
import { type CatalogCache } from './catalog-cache';
import { type MediaStorage, mediaKey } from './media';

const MAX_BYTES = 2 * 1024 * 1024;
const DEADLINE_MS = 2500;
type Budget = {
  active: number;
  started: number;
  count: number;
  pending: Map<string, Promise<string | null>>;
};
const budgets = new WeakMap<CatalogCache, Budget>();

/** Exact trusted HTTPS hosts and provider image paths only, including every redirect hop. */
export function allowedCoverUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (
      url.protocol !== 'https:' ||
      url.port ||
      url.username ||
      url.password ||
      url.hash ||
      raw.includes('\\')
    )
      return null;
    if (!(COVER_HOSTS as readonly string[]).includes(url.hostname)) return null;
    if (
      url.hostname === 'covers.openlibrary.org' &&
      !/^\/b\/(id|isbn)\/[0-9X]+-[SML]\.jpg$/.test(url.pathname)
    )
      return null;
    if (url.hostname === 'books.google.com' && url.pathname !== '/books/content') return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Binary structure and bounded dimensions, independent of the untrusted HTTP Content-Type. */
export function imageType(bytes: Uint8Array): string | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...bytes.slice(start, start + length));
  const dimensions = (w: number, h: number) =>
    w >= 20 && h >= 20 && w <= 6000 && h <= 6000 && w * h <= 16_000_000;
  if (
    bytes.length >= 45 &&
    bytes[0] === 137 &&
    ascii(1, 3) === 'PNG' &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10 &&
    view.getUint32(8) === 13 &&
    ascii(12, 4) === 'IHDR'
  ) {
    let offset = 8;
    let data = false;
    while (offset + 12 <= bytes.length) {
      const length = view.getUint32(offset);
      if (offset + length + 12 > bytes.length) return null;
      const chunk = ascii(offset + 4, 4);
      if (chunk === 'IDAT' && length > 0) data = true;
      if (chunk === 'IEND')
        return data &&
          length === 0 &&
          offset + 12 === bytes.length &&
          dimensions(view.getUint32(16), view.getUint32(20))
          ? 'image/png'
          : null;
      offset += length + 12;
    }
    return null;
  }
  if (
    bytes.length > 20 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[bytes.length - 2] === 255 &&
    bytes[bytes.length - 1] === 217
  ) {
    let offset = 2;
    let validSize = false;
    while (offset + 4 < bytes.length) {
      if (bytes[offset] !== 255) return null;
      const marker = bytes[offset + 1] ?? 0;
      if (marker === 218) return validSize ? 'image/jpeg' : null;
      const length = view.getUint16(offset + 2);
      if (length < 2 || offset + 2 + length > bytes.length) return null;
      if ([192, 193, 194].includes(marker) && length >= 8)
        validSize = dimensions(view.getUint16(offset + 7), view.getUint16(offset + 5));
      offset += 2 + length;
    }
  }
  if (
    bytes.length >= 30 &&
    ascii(0, 4) === 'RIFF' &&
    ascii(8, 4) === 'WEBP' &&
    view.getUint32(4, true) + 8 === bytes.length
  ) {
    const kind = ascii(12, 4);
    const size = view.getUint32(16, true);
    if (size + 20 > bytes.length) return null;
    if (
      kind === 'VP8 ' &&
      size >= 10 &&
      bytes[23] === 157 &&
      bytes[24] === 1 &&
      bytes[25] === 42 &&
      dimensions(view.getUint16(26, true) & 16383, view.getUint16(28, true) & 16383)
    )
      return 'image/webp';
    if (kind === 'VP8L' && size >= 5 && bytes[20] === 47) {
      const bits = view.getUint32(21, true);
      if (dimensions((bits & 16383) + 1, ((bits >>> 14) & 16383) + 1)) return 'image/webp';
    }
  }
  return null;
}

export class CoverCache {
  private readonly budget: Budget;
  constructor(
    private readonly options: {
      fetch: FetchLike;
      cache: CatalogCache;
      media: MediaStorage;
      publicUrl: string;
      timeoutMs?: number;
    },
  ) {
    this.budget = budgets.get(options.cache) ?? {
      active: 0,
      started: Date.now(),
      count: 0,
      pending: new Map(),
    };
    budgets.set(options.cache, this.budget);
  }

  private async identity(url: string) {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url));
    const name = [...new Uint8Array(hash)].map((n) => n.toString(16).padStart(2, '0')).join('');
    const key = mediaKey('covers', 'catalog-v1', name);
    return { key, publicUrl: `${this.options.publicUrl.replace(/\/$/, '')}/${key}` };
  }

  /** Only consults a small metadata cache; never downloads during search. */
  async cached(urls: readonly string[]): Promise<string | null> {
    for (const raw of urls.slice(0, 2)) {
      const url = allowedCoverUrl(raw);
      if (!url) continue;
      const { key, publicUrl } = await this.identity(url);
      if (await this.options.cache.get(`cover:ready:${key}`)) return publicUrl;
    }
    return null;
  }

  async ingest(urls: readonly string[]): Promise<string | null> {
    const known = await this.cached(urls);
    if (known) return known;
    // One candidate per action; failure retains the external URLs and typographic fallback.
    const url = urls
      .slice(0, 2)
      .map(allowedCoverUrl)
      .find((value) => value !== null);
    if (!url) return null;
    const { key, publicUrl } = await this.identity(url);
    const pending = this.budget.pending.get(key);
    if (pending) return pending;
    if (await this.options.cache.get(`cover:failed:${key}`)) return null;
    const concurrent = this.budget.pending.get(key);
    if (concurrent) return concurrent;
    if (Date.now() - this.budget.started >= 60_000) {
      this.budget.started = Date.now();
      this.budget.count = 0;
    }
    if (this.budget.active >= 2 || this.budget.count >= 20) return null;
    this.budget.active += 1;
    this.budget.count += 1;
    const task = this.store(url, key, publicUrl);
    this.budget.pending.set(key, task);
    try {
      return await task;
    } finally {
      this.budget.active -= 1;
      this.budget.pending.delete(key);
    }
  }

  private async store(initial: string, key: string, publicUrl: string): Promise<string | null> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve(null);
      }, this.options.timeoutMs ?? DEADLINE_MS);
    });
    const work = (async () => {
      try {
        const existing = await this.options.media.get(key);
        if (existing) {
          await existing.body.cancel();
          return publicUrl;
        }
        let url = initial;
        for (let hop = 0; hop <= 2; hop += 1) {
          if (controller.signal.aborted) return null;
          const response = await this.options.fetch(url, {
            redirect: 'manual',
            signal: controller.signal,
            headers: { accept: 'image/jpeg,image/png,image/webp' },
          });
          if ([301, 302, 303, 307, 308].includes(response.status)) {
            await response.body?.cancel();
            const location = response.headers.get('location');
            const next = location ? allowedCoverUrl(new URL(location, url).href) : null;
            if (!next) return null;
            url = next;
            continue;
          }
          if (
            !response.ok ||
            Number(response.headers.get('content-length')) > MAX_BYTES ||
            !response.body
          ) {
            await response.body?.cancel();
            return null;
          }
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let size = 0;
          const abort = () => {
            void reader.cancel().catch(() => undefined);
          };
          controller.signal.addEventListener('abort', abort, { once: true });
          try {
            while (!controller.signal.aborted) {
              const { value, done } = await reader.read();
              if (done) break;
              size += value.byteLength;
              if (size > MAX_BYTES) {
                await reader.cancel();
                return null;
              }
              chunks.push(value);
            }
          } finally {
            controller.signal.removeEventListener('abort', abort);
            reader.releaseLock();
          }
          if (controller.signal.aborted) return null;
          const bytes = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.length;
          }
          const type = imageType(bytes);
          if (!type) return null;
          await this.options.media.putImage(key, bytes.buffer, type);
          return publicUrl;
        }
      } catch {
        return null;
      }
      return null;
    })();
    try {
      const result = await Promise.race([work, timeout]);
      await this.options.cache.set(
        `${result ? 'cover:ready' : 'cover:failed'}:${key}`,
        true,
        result ? 86400 : 600,
      );
      return result;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}
