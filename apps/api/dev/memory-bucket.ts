import { type MediaBucket, type MediaObject } from '../src/services/media';

type StoredObject = { data: Uint8Array<ArrayBuffer>; contentType?: string };

async function toBytes(value: Parameters<MediaBucket['put']>[1]): Promise<Uint8Array<ArrayBuffer>> {
  let view: Uint8Array;
  if (typeof value === 'string') view = new TextEncoder().encode(value);
  else if (value instanceof ArrayBuffer) view = new Uint8Array(value);
  else if (ArrayBuffer.isView(value))
    view = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  else if (value instanceof Blob) view = new Uint8Array(await value.arrayBuffer());
  else view = new Uint8Array(await new Response(value).arrayBuffer());
  // Copy into a plain ArrayBuffer (never shared) so it can back a Response body.
  const copy = new Uint8Array(new ArrayBuffer(view.byteLength));
  copy.set(view);
  return copy;
}

/** In-memory stand-in for the R2 `MEDIA` binding (tests and the local Node dev server). */
export function createMemoryBucket(): MediaBucket & { objects: Map<string, StoredObject> } {
  const objects = new Map<string, StoredObject>();
  return {
    objects,
    async put(key, value, options) {
      const data = await toBytes(value);
      const contentType = options?.httpMetadata?.contentType;
      objects.set(key, contentType ? { data, contentType } : { data });
      return null;
    },
    async get(key): Promise<MediaObject | null> {
      const entry = objects.get(key);
      if (!entry) return null;
      return {
        key,
        size: entry.data.byteLength,
        httpMetadata: entry.contentType ? { contentType: entry.contentType } : {},
        body: new Response(entry.data).body ?? new ReadableStream(),
      };
    },
    async delete(key) {
      objects.delete(key);
    },
  };
}
