import { describe, expect, it } from 'vitest';

import { createFixedClock, createMockFetch, createTestServerBindings, jsonResponse } from '../src';

describe('testing helpers', () => {
  it('provides development bindings without secrets', () => {
    const env = createTestServerBindings({ GEMINI_API_KEY: 'test-key' });
    expect(env.APP_ENV).toBe('development');
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.GEMINI_API_KEY).toBe('test-key');
  });

  it('records fetch calls', async () => {
    const fetchMock = createMockFetch(() => jsonResponse({ ok: true }, { status: 201 }));
    const response = await fetchMock('https://example.test/a', { method: 'POST', body: 'x' });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
    expect(fetchMock.calls).toHaveLength(1);
    expect(fetchMock.calls[0]).toMatchObject({
      url: 'https://example.test/a',
      method: 'POST',
      body: 'x',
    });
  });

  it('advances a fixed clock', () => {
    const clock = createFixedClock(1000);
    clock.advance(250);
    expect(clock.now()).toBe(1250);
  });
});
