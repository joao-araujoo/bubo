import { deflateSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';

import { createMemoryBucket } from '../dev/memory-bucket';
import { createMemoryCache } from '../src/services/catalog-cache';
import { allowedCoverUrl, CoverCache, imageType } from '../src/services/cover-cache';
import { MediaStorage } from '../src/services/media';

const URL = 'https://covers.openlibrary.org/b/id/123-L.jpg?default=false';
// A tiny, real 32x48 PNG fixture, with valid chunk CRCs and compressed RGB scanlines.
function png() {
  const chunk = (name: string, data: Buffer) => {
    const content = Buffer.concat([Buffer.from(name), data]);
    let crc = 0xffffffff;
    for (const byte of content) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const result = Buffer.alloc(data.length + 12);
    result.writeUInt32BE(data.length);
    content.copy(result, 4);
    result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
    return result;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(32);
  header.writeUInt32BE(48, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.alloc(48 * (32 * 3 + 1), 0))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
function setup(
  fetch: (input: string, init?: RequestInit) => Promise<Response>,
  timeoutMs?: number,
) {
  const bucket = createMemoryBucket();
  const cache = createMemoryCache();
  const options = {
    fetch,
    cache,
    media: new MediaStorage(bucket),
    publicUrl: 'https://media.example.test',
    timeoutMs,
  };
  return { bucket, cache, options, covers: new CoverCache(options) };
}

describe('bounded provider cover ingestion', () => {
  it('rejects HTTP, credentials, internal hosts, arbitrary paths and destinations', async () => {
    const fetch = vi.fn(async () => new Response(png()));
    const { covers } = setup(fetch);
    for (const url of [
      'http://covers.openlibrary.org/b/id/1-L.jpg',
      'https://127.0.0.1/a',
      'https://covers.openlibrary.org.evil.test/a',
      'https://books.google.com@127.0.0.1/a',
      'https://books.google.com:444/books/content',
      'https://books.google.com/url?q=http://127.0.0.1',
      'https://covers.openlibrary.org\\@127.0.0.1/a',
    ]) {
      expect(allowedCoverUrl(url)).toBeNull();
      expect(await covers.ingest([url])).toBeNull();
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('checks each redirect and limits loops', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://169.254.169.254/latest/meta-data' },
        }),
    );
    expect(await setup(fetch).covers.ingest([URL])).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    const loop = vi.fn(async () => new Response(null, { status: 302, headers: { location: URL } }));
    expect(await setup(loop).covers.ingest([URL])).toBeNull();
    expect(loop).toHaveBeenCalledTimes(3);
  });

  it('stores the detected image type, reuses R2 across cache resets and coalesces downloads', async () => {
    const fetch = vi.fn(async (_input: string, init?: RequestInit) => {
      expect(init?.redirect).toBe('manual');
      return new Response(png(), { headers: { 'content-type': 'text/plain' } });
    });
    const { covers, bucket, options } = setup(fetch);
    const result = await Promise.all([covers.ingest([URL]), covers.ingest([URL])]);
    expect(result[0]).toMatch(/^https:\/\/media.example.test\/covers\/catalog-v1\/[a-f0-9]{64}$/);
    expect(result[1]).toBe(result[0]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect([...bucket.objects.values()][0]?.contentType).toBe('image/png');
    const fresh = new CoverCache({ ...options, cache: createMemoryCache() });
    expect(await fresh.ingest([URL])).toBe(result[0]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await fresh.cached([URL])).toBe(result[0]);
  });

  it('rejects HTML disguised as an image, truncated files and oversized streamed bodies', async () => {
    expect(imageType(png())).toBe('image/png');
    expect(imageType(png().subarray(0, 32))).toBeNull();
    expect(imageType(new TextEncoder().encode('<svg onload="alert(1)"></svg>'))).toBeNull();
    for (const response of [
      new Response('<html>not an image</html>', { headers: { 'content-type': 'image/jpeg' } }),
      new Response(new Uint8Array(2 * 1024 * 1024 + 1)),
      new Response(png(), { headers: { 'content-length': '9000000' } }),
    ]) {
      const { covers, bucket } = setup(async () => response);
      expect(await covers.ingest([URL])).toBeNull();
      expect(bucket.objects.size).toBe(0);
    }
  });

  it('bounds stalled downloads, negative-caches failures and preserves the candidates', async () => {
    const fetch = vi.fn(() => new Promise<Response>(() => undefined));
    const { covers } = setup(fetch, 15);
    const candidates = [URL];
    expect(await covers.ingest(candidates)).toBeNull();
    expect(await covers.ingest(candidates)).toBeNull();
    expect(candidates).toEqual([URL]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps discovery searches free of downloads and survives storage failures', async () => {
    const fetch = vi.fn(async () => new Response(png()));
    const { covers, options } = setup(fetch);
    expect(await covers.cached([URL])).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    const broken = new CoverCache({
      ...options,
      media: new MediaStorage({
        get: async () => {
          throw new Error('R2 unavailable');
        },
        put: async () => undefined,
        delete: async () => undefined,
      }),
    });
    expect(await broken.ingest([URL])).toBeNull();
  });
});
