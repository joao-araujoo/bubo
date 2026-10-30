import { describe, expect, it, vi } from 'vitest';
import { computeReplay, createReplayPeriod } from '@bubo/domain';
import { type Book } from '@bubo/contracts';

vi.mock('../../mobile/src/lib/auth/client', () => ({ authHeaders: async () => ({}) }));
vi.mock('../../mobile/src/lib/config', () => ({
  publicConfig: { apiUrl: 'http://localhost:8787' },
}));

import { createApiClient } from '../../mobile/src/lib/api/client';
import {
  storyCaptureGeometry,
  storyCaptureOptions,
} from '../../mobile/src/features/replay/capture';
import {
  periodLabel,
  replayChapters,
  replayMonthIsFuture,
  replaySnapshotLabel,
  storyBooks,
} from '../../mobile/src/features/replay/model';

const now = new Date('2026-10-04T15:00:00Z');
const emptyReplay = computeReplay<Book>({
  period: createReplayPeriod({ kind: 'year', year: 2026, timeZone: 'America/Sao_Paulo' }, now),
  now,
  firstSessionAt: null,
  books: [],
  sessions: [],
});

describe('mobile Replay and export contract', () => {
  it('draws exact Full HD before capture across device densities and platform pixel conventions', () => {
    for (const density of [1, 1.5, 2, 2.625, 3, 3.5, 4]) {
      const geometry = storyCaptureGeometry(density);
      expect(geometry.sourceWidth * density).toBeCloseTo(1080);
      expect(geometry.sourceHeight * density).toBeCloseTo(1920);
      expect(360 * geometry.artScale).toBeCloseTo(geometry.sourceWidth);
      const ios = storyCaptureOptions('ios', density);
      expect(ios.width * density).toBeCloseTo(1080);
      expect(ios.height * density).toBeCloseTo(1920);
      expect(storyCaptureOptions('android', density)).toMatchObject({
        width: 1080,
        height: 1920,
        format: 'png',
      });
    }
  });

  it('does not fabricate chapters or covers for empty history, and marks future months by IANA local time', () => {
    expect(replayChapters(emptyReplay)).toEqual([]);
    expect(storyBooks({ kind: 'replay', replay: emptyReplay, chapter: 'intro' })).toEqual([]);
    expect(replayMonthIsFuture(emptyReplay.period, 11, now)).toBe(true);
    expect(replayMonthIsFuture(emptyReplay.period, 10, now)).toBe(false);
    const boundary = new Date('2026-10-01T01:00:00Z');
    expect(replayMonthIsFuture(emptyReplay.period, 10, boundary)).toBe(true);
    expect(periodLabel({ ...emptyReplay.period, kind: 'month', month: 9 })).toBe(
      'setembro de 2026',
    );
    expect(replaySnapshotLabel({ ...emptyReplay, generatedAt: '2026-10-01T01:00:00Z' })).toBe(
      '30/09',
    );
  });

  it('sends only explicit period and timezone, validates response and forwards auth through the actual HTTP client', async () => {
    const requests: Request[] = [];
    const client = createApiClient({
      baseUrl: 'http://localhost:8787',
      getHeaders: async () => ({ cookie: 'test-session' }),
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return Response.json(emptyReplay);
      },
    });
    await client.getReplay({ kind: 'year', year: 2026, timeZone: 'America/Sao_Paulo' });
    expect(requests[0]?.url).toBe(
      'http://localhost:8787/v1/me/replay?kind=year&year=2026&timeZone=America%2FSao_Paulo',
    );
    expect(requests[0]?.headers.get('cookie')).toBe('test-session');
    await client.getReplay({ kind: 'month', year: 2026, month: 9, timeZone: 'UTC' });
    expect(new URL(requests[1]!.url).searchParams.get('month')).toBe('9');
    const invalid = createApiClient({
      baseUrl: 'http://localhost:8787',
      fetch: async () => Response.json({}),
    });
    await expect(
      invalid.getReplay({ kind: 'year', year: 2026, timeZone: 'UTC' }),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('keeps API/network failures retryable without turning them into an empty report', async () => {
    const offline = createApiClient({
      baseUrl: 'http://localhost:8787',
      fetch: async () => {
        throw new Error('offline');
      },
    });
    await expect(
      offline.getReplay({ kind: 'year', year: 2026, timeZone: 'UTC' }),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR', retryable: true });
    const anonymous = createApiClient({
      baseUrl: 'http://localhost:8787',
      fetch: async () =>
        Response.json(
          { error: { code: 'UNAUTHORIZED', message: 'Sign in', requestId: 'test' } },
          { status: 401 },
        ),
    });
    await expect(
      anonymous.getReplay({ kind: 'year', year: 2026, timeZone: 'UTC' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', retryable: false });
  });
});
