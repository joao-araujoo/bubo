import { type CatalogSource } from '@bubo/domain';

import { type CatalogCache } from './catalog-cache';
import { type FetchLike } from './catalog';

export type Fetched = { ok: true; data: unknown } | { ok: false; status: number };
type State = { next: Map<string, number>; pending: Map<string, Promise<Fetched>> };
const states = new WeakMap<CatalogCache, State>();

/** Per-isolate pacing, shared across requests, with bounded queues and in-flight coalescing. */
export class CatalogTransport {
  private readonly state: State;
  constructor(
    private readonly options: {
      fetch: FetchLike;
      cache: CatalogCache;
      timeoutMs: number;
      contact?: string;
    },
  ) {
    this.state = states.get(options.cache) ?? { next: new Map(), pending: new Map() };
    states.set(options.cache, this.state);
  }

  async get(url: string, source: CatalogSource): Promise<Fetched> {
    // Do not put credentials in cache keys or logs.
    const identity = new URL(url);
    identity.searchParams.delete('key');
    const key = `upstream:v4:${identity}`;
    const cached = await this.options.cache.get(key);
    if (cached !== undefined) return { ok: true, data: cached };
    const pending = this.state.pending.get(key);
    if (pending) return pending;
    const task = this.fetch(url, source, key);
    this.state.pending.set(key, task);
    try {
      return await task;
    } finally {
      this.state.pending.delete(key);
    }
  }

  private async fetch(url: string, source: CatalogSource, key: string): Promise<Fetched> {
    const backoff = `upstream:backoff:${source}`;
    if (await this.options.cache.get(backoff)) return { ok: false, status: 429 };
    const now = Date.now();
    const start = Math.max(now, this.state.next.get(source) ?? now);
    if (start - now > 2000) return { ok: false, status: 429 };
    this.state.next.set(source, start + (source === 'google' ? 200 : 1000));
    if (start > now) await new Promise((resolve) => setTimeout(resolve, start - now));
    if (await this.options.cache.get(backoff)) return { ok: false, status: 429 };
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<Fetched>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve({ ok: false, status: 0 });
      }, this.options.timeoutMs);
    });
    const request = (async (): Promise<Fetched> => {
      try {
        const response = await this.options.fetch(url, {
          headers: {
            accept: 'application/json',
            'user-agent': `Bubo catalog${this.options.contact ? ` (${this.options.contact})` : ''}`,
          },
          signal: controller.signal,
        });
        if (!response.ok) {
          if (response.status === 429 || response.status === 403) {
            const retry = response.headers.get('retry-after');
            const seconds = retry ? Number(retry) || (Date.parse(retry) - Date.now()) / 1000 : 600;
            await this.options.cache.set(
              backoff,
              true,
              Math.max(60, Math.min(3600, Number.isFinite(seconds) ? seconds : 600)),
            );
          }
          return { ok: false, status: response.status };
        }
        const data: unknown = await response.json();
        if (controller.signal.aborted) return { ok: false, status: 0 };
        const endpoint = new URL(url).pathname;
        const list =
          typeof data === 'object' && data !== null
            ? (Reflect.get(data, source === 'google' ? 'items' : 'docs') as unknown)
            : undefined;
        const isSearch = endpoint.endsWith('/volumes') || endpoint === '/search.json';
        if (
          isSearch &&
          !Array.isArray(list) &&
          !(
            source === 'google' &&
            typeof data === 'object' &&
            data !== null &&
            Reflect.get(data, 'totalItems') === 0
          )
        ) {
          return { ok: false, status: 0 };
        }
        const ttl = isSearch && (!Array.isArray(list) || list.length === 0) ? 300 : 3600;
        await this.options.cache.set(key, data, ttl);
        return { ok: true, data };
      } catch {
        return { ok: false, status: 0 };
      }
    })();
    try {
      return await Promise.race([request, timeout]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}
