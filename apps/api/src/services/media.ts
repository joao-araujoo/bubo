import { AppError } from '../lib/errors';

/**
 * The subset of Cloudflare's R2Bucket that Bubo uses. Declared structurally so the service can be
 * unit-tested with an in-memory fake; the real `env.MEDIA` R2Bucket satisfies it.
 */
export type MediaObject = {
  key: string;
  size: number;
  httpMetadata?: { contentType?: string };
  body: ReadableStream;
};

export type MediaBucket = {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  get(key: string): Promise<MediaObject | null>;
  delete(key: string): Promise<void>;
};

/** Top-level prefixes allowed in the bucket. Keeps user uploads segregated by purpose. */
export const MEDIA_PREFIXES = ['covers', 'avatars', 'uploads'] as const;
export type MediaPrefix = (typeof MEDIA_PREFIXES)[number];

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** Builds a validated object key like `covers/<id>.webp`; rejects traversal and odd characters. */
export function mediaKey(prefix: MediaPrefix, ...segments: string[]): string {
  if (!MEDIA_PREFIXES.includes(prefix)) {
    throw new AppError('BAD_REQUEST', 'Invalid media prefix.');
  }
  if (segments.length === 0 || segments.some((s) => !SAFE_SEGMENT.test(s) || s.includes('..'))) {
    throw new AppError('BAD_REQUEST', 'Invalid media key.');
  }
  return [prefix, ...segments].join('/');
}

export class MediaStorage {
  constructor(private readonly bucket: MediaBucket) {}

  async putImage(key: string, body: ArrayBuffer, contentType: string): Promise<void> {
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType)) {
      throw new AppError('VALIDATION_FAILED', 'Unsupported image type.', {
        issues: [{ path: 'contentType', message: `Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}` }],
      });
    }
    if (body.byteLength === 0 || body.byteLength > MAX_IMAGE_BYTES) {
      throw new AppError('VALIDATION_FAILED', 'Image must be between 1 byte and 5 MB.');
    }
    await this.bucket.put(key, body, { httpMetadata: { contentType } });
  }

  get(key: string): Promise<MediaObject | null> {
    return this.bucket.get(key);
  }

  delete(key: string): Promise<void> {
    return this.bucket.delete(key);
  }
}
