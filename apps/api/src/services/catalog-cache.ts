/**
 * Catalog response cache (ADR-016). Values are plain JSON and are re-validated by the caller with
 * the Zod contracts on read, so a stale or corrupted entry can never reach a client unchecked.
 *
 * Layers: an in-memory LRU per isolate (always) + the Workers edge cache (`caches.default`) when
 * the runtime provides it. The Node dev server and tests use memory only.
 */
export interface CatalogCache {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
}

type Entry = { value: unknown; expiresAt: number };

export function createMemoryCache(options: { maxEntries?: number; now?: () => number } = {}) {
  const maxEntries = options.maxEntries ?? 500;
  const now = options.now ?? (() => Date.now());
  const entries = new Map<string, Entry>();

  const cache: CatalogCache & { size: () => number } = {
    async get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= now()) {
        entries.delete(key);
        return undefined;
      }
      // Refresh recency (Map keeps insertion order → first key is the least recently used).
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },
    async set(key, value, ttlSeconds) {
      entries.delete(key);
      entries.set(key, { value, expiresAt: now() + ttlSeconds * 1000 });
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },
    size: () => entries.size,
  };
  return cache;
}

type EdgeCache = {
  match(request: string): Promise<Response | undefined>;
  put(request: string, response: Response): Promise<void>;
};

function isEdgeCache(value: unknown): value is EdgeCache {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'match') === 'function' &&
    typeof Reflect.get(value, 'put') === 'function'
  );
}

/** `caches.default` on Cloudflare Workers, or null elsewhere. */
export function findEdgeCache(): EdgeCache | null {
  const storage: unknown = Reflect.get(globalThis, 'caches');
  if (typeof storage !== 'object' || storage === null) return null;
  const cache: unknown = Reflect.get(storage, 'default');
  return isEdgeCache(cache) ? cache : null;
}

const EDGE_ORIGIN = 'https://catalog-cache.bubo.internal/';

/** Memory first, then the edge cache. Edge failures are swallowed: the cache is best-effort. */
export function createLayeredCache(memory: CatalogCache, edge: EdgeCache | null): CatalogCache {
  if (!edge) return memory;
  const url = (key: string) => `${EDGE_ORIGIN}${encodeURIComponent(key)}`;
  return {
    async get(key) {
      const hit = await memory.get(key);
      if (hit !== undefined) return hit;
      try {
        const response = await edge.match(url(key));
        if (!response) return undefined;
        const value: unknown = await response.json();
        const ttl = Number(response.headers.get('x-bubo-ttl') ?? '300');
        await memory.set(key, value, Math.min(Number.isFinite(ttl) ? ttl : 300, 3600));
        return value;
      } catch {
        return undefined;
      }
    },
    async set(key, value, ttlSeconds) {
      await memory.set(key, value, ttlSeconds);
      try {
        await edge.put(
          url(key),
          new Response(JSON.stringify(value), {
            headers: {
              'content-type': 'application/json',
              'cache-control': `public, max-age=${ttlSeconds}`,
              'x-bubo-ttl': String(ttlSeconds),
            },
          }),
        );
      } catch {
        // Best-effort: the memory layer already holds the value.
      }
    },
  };
}
