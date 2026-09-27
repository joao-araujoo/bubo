import { createMockFetch, jsonResponse } from '@bubo/testing';
import { describe, expect, it } from 'vitest';

import { AppError } from '../src/lib/errors';
import { redact } from '../src/lib/logger';
import { GeminiService } from '../src/services/gemini';
import { MediaStorage, mediaKey } from '../src/services/media';
import { createMemoryBucket } from './helpers';

const okGemini = {
  candidates: [
    { content: { parts: [{ text: 'Olá, ' }, { text: 'leitor.' }] }, finishReason: 'STOP' },
  ],
  usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 3, totalTokenCount: 7 },
};

describe('GeminiService', () => {
  it('calls generateContent with the key in a header, never in the URL', async () => {
    const fetchMock = createMockFetch(() => jsonResponse(okGemini));
    const gemini = new GeminiService({
      apiKey: 'test-key',
      model: 'gemini-2.5-flash',
      fetch: fetchMock,
    });
    const result = await gemini.generateText('Resuma o capítulo', { temperature: 0.2, json: true });

    expect(result).toEqual({
      text: 'Olá, leitor.',
      model: 'gemini-2.5-flash',
      finishReason: 'STOP',
      usage: { promptTokens: 4, outputTokens: 3, totalTokens: 7 },
    });
    const call = fetchMock.calls[0];
    expect(call?.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    );
    expect(call?.url).not.toContain('test-key');
    expect(call?.headers.get('x-goog-api-key')).toBe('test-key');
    expect(JSON.parse(call?.body ?? '{}')).toMatchObject({
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    });
  });

  it('is unavailable without an API key', async () => {
    const gemini = new GeminiService({ apiKey: undefined, model: 'm' });
    expect(gemini.isConfigured).toBe(false);
    await expect(gemini.generateText('x')).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });

  it('maps provider failures to stable error codes', async () => {
    const rateLimited = new GeminiService({
      apiKey: 'k',
      model: 'm',
      fetch: createMockFetch(() => new Response('{}', { status: 429 })),
    });
    await expect(rateLimited.generateText('x')).rejects.toMatchObject({ code: 'RATE_LIMITED' });

    const broken = new GeminiService({
      apiKey: 'k',
      model: 'm',
      fetch: createMockFetch(() => new Response('oops', { status: 500 })),
    });
    await expect(broken.generateText('x')).rejects.toMatchObject({ code: 'UPSTREAM_ERROR' });

    const empty = new GeminiService({
      apiKey: 'k',
      model: 'm',
      fetch: createMockFetch(() => jsonResponse({ candidates: [] })),
    });
    await expect(empty.generateText('x')).rejects.toBeInstanceOf(AppError);
  });

  it('rejects empty prompts before calling the provider', async () => {
    const fetchMock = createMockFetch(() => jsonResponse(okGemini));
    const gemini = new GeminiService({ apiKey: 'k', model: 'm', fetch: fetchMock });
    await expect(gemini.generateText('   ')).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(fetchMock.calls).toHaveLength(0);
  });
});

describe('MediaStorage (R2)', () => {
  it('builds safe keys and rejects traversal', () => {
    expect(mediaKey('covers', 'book_123.webp')).toBe('covers/book_123.webp');
    expect(() => mediaKey('covers', '../secrets')).toThrow(AppError);
    expect(() => mediaKey('covers', 'a/b')).toThrow(AppError);
  });

  it('stores and reads images with their content type', async () => {
    const bucket = createMemoryBucket();
    const storage = new MediaStorage(bucket);
    const key = mediaKey('avatars', 'user_1.png');
    await storage.putImage(key, new Uint8Array([1, 2, 3]).buffer, 'image/png');
    const object = await storage.get(key);
    expect(object?.size).toBe(3);
    expect(object?.httpMetadata?.contentType).toBe('image/png');
    await storage.delete(key);
    expect(await storage.get(key)).toBeNull();
  });

  it('validates type and size', async () => {
    const storage = new MediaStorage(createMemoryBucket());
    await expect(
      storage.putImage('uploads/a.gif', new Uint8Array([1]).buffer, 'image/gif'),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(
      storage.putImage('uploads/a.png', new ArrayBuffer(0), 'image/png'),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});

describe('redact', () => {
  it('hides sensitive keys recursively', () => {
    expect(
      redact({ user: 'a', apiKey: 'x', nested: { DATABASE_URL: 'y', list: [{ token: 'z' }] } }),
    ).toEqual({
      user: 'a',
      apiKey: '[redacted]',
      nested: { DATABASE_URL: '[redacted]', list: [{ token: '[redacted]' }] },
    });
  });
});
