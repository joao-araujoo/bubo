import { type CatalogBook } from '@bubo/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CatalogService, COVER_REUSE_WAIT_MS, SEARCH_MERGE_WAIT_MS } from '../src/services/catalog';
import { createMemoryCache } from '../src/services/catalog-cache';
import { CoverCache } from '../src/services/cover-cache';
import { MediaStorage } from '../src/services/media';
import { createMemoryBucket } from '../dev/memory-bucket';

const json = (value: unknown) => new Response(JSON.stringify(value));
const volume = {
  id: 'volume0001',
  volumeInfo: {
    title: 'Duna',
    authors: ['Frank Herbert'],
    imageLinks: { thumbnail: 'https://books.google.com/books/content?id=volume0001&img=1' },
  },
};
const openLibrary = {
  docs: [
    {
      key: '/works/OL1W',
      title: 'Duna',
      author_name: ['Frank Herbert'],
      editions: { docs: [{ key: '/books/OL1M', title: 'Duna', language: ['por'] }] },
    },
  ],
};

afterEach(() => vi.useRealTimers());

describe('responsive catalog without discarding slower sources', () => {
  it('keeps ready covers and limits a slow metadata batch to one 100 ms window', async () => {
    vi.useFakeTimers();
    const cache = createMemoryCache();
    const covers = new CoverCache({
      fetch: vi.fn(async () => json({})),
      cache,
      media: new MediaStorage(createMemoryBucket()),
      publicUrl: 'https://media.example.test',
    });
    const ready = 'https://media.example.test/covers/catalog-v1/ready';
    const late = 'https://media.example.test/covers/catalog-v1/late';
    const slowUrl = 'https://covers.openlibrary.org/b/id/1-L.jpg?default=false';
    vi.spyOn(covers, 'cached').mockImplementation(async (urls) =>
      urls.includes(slowUrl)
        ? new Promise<string>((resolve) => setTimeout(() => resolve(late), 500))
        : ready,
    );
    const ingest = vi.spyOn(covers, 'ingest');
    const background: Promise<unknown>[] = [];
    const service = new CatalogService({
      fetch: async () => json(volume),
      cache,
      covers,
      background: (task) => background.push(task),
    });
    const book = await service.getBook('gb:volume0001');
    if (!book) throw new Error('Missing fixture');
    const books = [book, { ...book, catalogId: 'ol:OL1M', coverUrls: [slowUrl] }];
    let answered = false;
    const pending = service.withCachedCovers(books).then((result) => {
      answered = true;
      return result;
    });
    await vi.advanceTimersByTimeAsync(COVER_REUSE_WAIT_MS - 1);
    expect(answered).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const response = await pending;
    expect(response[0]?.cachedCoverUrl).toBe(ready);
    expect(response[1]?.coverUrls).toEqual([slowUrl]);
    expect(response[1]?.cachedCoverUrl).toBeUndefined();
    expect(ingest).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    await Promise.all(background);
    // Metadata that finishes later cannot mutate an already returned batch.
    expect(response[1]?.cachedCoverUrl).toBeUndefined();
    expect(books[0]?.cachedCoverUrl).toBeUndefined();
  });

  it('coalesces normalized searches and writes full results after a delayed partial write', async () => {
    vi.useFakeTimers();
    const memory = createMemoryCache();
    const writes: unknown[] = [];
    let flushPartial: (() => void) | undefined;
    const partialWrite = new Promise<void>((resolve) => {
      flushPartial = resolve;
    });
    const cache = {
      get: memory.get,
      set: async (key: string, value: unknown, ttl: number) => {
        if (key.startsWith('search:')) {
          writes.push(value);
          if (writes.length === 1) await partialWrite;
        }
        await memory.set(key, value, ttl);
      },
    };
    let finish: ((response: Response) => void) | undefined;
    const delayed = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    const background: Promise<unknown>[] = [];
    const fetch = vi.fn(async (input: string) =>
      input.includes('googleapis') ? json({ items: [volume] }) : delayed,
    );
    const options = { fetch, cache, background: (task: Promise<unknown>) => background.push(task) };
    const first = new CatalogService(options).search('Duna', 20);
    await vi.advanceTimersByTimeAsync(SEARCH_MERGE_WAIT_MS);
    expect(writes).toHaveLength(1);
    finish?.(json(openLibrary));
    const second = new CatalogService(options).search('  DUNA ', 20);
    await vi.advanceTimersByTimeAsync(0);
    // The second request must join the first, rather than let a full write get overwritten.
    expect(writes).toHaveLength(1);
    flushPartial?.();
    const responses = await Promise.all([first, second]);
    expect(responses.map((response) => response.query)).toEqual(['Duna', 'DUNA']);
    await Promise.all(background);
    expect(writes).toHaveLength(2);
    const complete = await new CatalogService(options).search('duna', 20);
    expect(complete.sources).toMatchObject({ google: 'ok', openlibrary: 'ok' });
    expect(complete.results.map((book) => book.catalogId).sort()).toEqual([
      'gb:volume0001',
      'ol:OL1M',
    ]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each(['google', 'openlibrary'] as const)(
    'shows real books while %s is slow, then caches the complete result',
    async (slow) => {
      vi.useFakeTimers();
      let finish: ((response: Response) => void) | undefined;
      const delayed = new Promise<Response>((resolve) => {
        finish = resolve;
      });
      const background: Promise<unknown>[] = [];
      const fetch = vi.fn(async (input: string) => {
        const google = input.includes('googleapis');
        if ((slow === 'google') === google) return delayed;
        return json(google ? { items: [volume] } : openLibrary);
      });
      const service = new CatalogService({
        fetch,
        cache: createMemoryCache(),
        background: (task) => background.push(task),
      });
      let answered = false;
      const pending = service.search('Duna', 20).then((response) => {
        answered = true;
        return response;
      });
      await vi.advanceTimersByTimeAsync(SEARCH_MERGE_WAIT_MS - 1);
      expect(answered).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      const partial = await pending;
      expect(partial.results).toHaveLength(1);
      expect(partial.results[0]?.title).toBe('Duna');
      expect(partial.sources[slow]).toBe('error');
      expect(background).toHaveLength(1);
      finish?.(json(slow === 'google' ? { items: [volume] } : openLibrary));
      await Promise.all(background);
      const count = fetch.mock.calls.length;
      const complete = await service.search(' DUNA ', 20);
      expect(complete.results).toHaveLength(2);
      expect(complete.sources).toMatchObject({ google: 'ok', openlibrary: 'ok' });
      expect(fetch).toHaveBeenCalledTimes(count);
    },
  );

  it('waits for a real result when the fast source is empty', async () => {
    vi.useFakeTimers();
    let finish: ((response: Response) => void) | undefined;
    const delayed = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    const service = new CatalogService({
      fetch: async (input) => (input.includes('googleapis') ? json({ totalItems: 0 }) : delayed),
      cache: createMemoryCache(),
      background: () => undefined,
    });
    let answered = false;
    const pending = service.search('subject:fantasy', 20).then((response) => {
      answered = true;
      return response;
    });
    await vi.advanceTimersByTimeAsync(SEARCH_MERGE_WAIT_MS + 1);
    expect(answered).toBe(false);
    finish?.(json(openLibrary));
    expect((await pending).sources).toMatchObject({ google: 'ok', openlibrary: 'ok' });
  });

  it('does not expire a complete fast search after the partial-response TTL', async () => {
    vi.useFakeTimers();
    const background = vi.fn();
    const fetch = vi.fn(async (input: string) =>
      json(input.includes('googleapis') ? { items: [volume] } : openLibrary),
    );
    const service = new CatalogService({ fetch, cache: createMemoryCache(), background });
    expect((await service.search('Duna', 20)).results).toHaveLength(2);
    expect(background).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(61_000);
    expect((await service.search('Duna', 20)).sources).toMatchObject({
      google: 'ok',
      openlibrary: 'ok',
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('bounds a slow new cover while preserving external candidates and warming metadata', async () => {
    vi.useFakeTimers();
    const cache = createMemoryCache();
    const covers = new CoverCache({
      fetch: () => new Promise<Response>(() => undefined),
      cache,
      media: new MediaStorage(createMemoryBucket()),
      publicUrl: 'https://media.example.test',
      timeoutMs: 500,
    });
    vi.spyOn(covers, 'cached').mockResolvedValue(null);
    vi.spyOn(covers, 'ingest').mockImplementation(
      () => new Promise<null>((resolve) => setTimeout(() => resolve(null), 500)),
    );
    const background: Promise<unknown>[] = [];
    const service = new CatalogService({
      fetch: async () => json({}),
      cache,
      covers,
      background: (task) => background.push(task),
    });
    const book: CatalogBook = {
      catalogId: 'gb:volume0001',
      title: 'Duna',
      subtitle: null,
      authors: ['Frank Herbert'],
      publisher: null,
      publishedYear: null,
      totalPages: null,
      isbn13: null,
      language: 'pt',
      description: null,
      coverUrls: ['https://books.google.com/books/content?id=volume0001&img=1'],
      sources: ['google'],
    };
    const pending = service.cacheCover(book);
    await vi.advanceTimersByTimeAsync(COVER_REUSE_WAIT_MS);
    expect(await pending).toEqual(book);
    expect(background).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(500);
    await Promise.all(background);
    expect(book.coverUrls).toEqual(['https://books.google.com/books/content?id=volume0001&img=1']);
  });

  it('reuses metadata from a cover that finishes after the detail response', async () => {
    vi.useFakeTimers();
    const cache = createMemoryCache();
    const covers = new CoverCache({
      fetch: async () => json({}),
      cache,
      media: new MediaStorage(createMemoryBucket()),
      publicUrl: 'https://media.example.test',
    });
    let finish: ((url: string) => void) | undefined;
    vi.spyOn(covers, 'cached').mockResolvedValue(null);
    vi.spyOn(covers, 'ingest').mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    const fetch = vi.fn(async () => json(volume));
    const background: Promise<unknown>[] = [];
    const service = new CatalogService({
      fetch,
      cache,
      covers,
      background: (task) => background.push(task),
    });
    const book = await service.getBook('gb:volume0001');
    expect(book).not.toBeNull();
    if (!book) return;
    const pending = service.cacheCover(book);
    await vi.advanceTimersByTimeAsync(COVER_REUSE_WAIT_MS);
    expect((await pending).cachedCoverUrl).toBeUndefined();
    const ready = 'https://media.example.test/covers/catalog-v1/ready';
    finish?.(ready);
    await Promise.all(background);
    expect(await service.getBook('gb:volume0001')).toMatchObject({
      cachedCoverUrl: ready,
      coverUrls: [ready, ...book.coverUrls],
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
