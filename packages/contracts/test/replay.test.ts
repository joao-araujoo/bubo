import { expect, it } from 'vitest';

import { API_ROUTE_DEFINITIONS, API_ROUTES, replayQuerySchema, replayResponseSchema } from '../src';

it('parses an explicit monthly or annual calendar query', () => {
  expect(
    replayQuerySchema.parse({
      kind: 'month',
      year: '2026',
      month: '10',
      timeZone: 'America/Sao_Paulo',
    }),
  ).toEqual({ kind: 'month', year: 2026, month: 10, timeZone: 'America/Sao_Paulo' });
  expect(replayQuerySchema.parse({ kind: 'year', year: '2026', timeZone: 'UTC' })).toEqual({
    kind: 'year',
    year: 2026,
    timeZone: 'UTC',
  });
});

it('rejects ambiguous periods and fixed/unknown offsets', () => {
  for (const value of [
    { kind: 'month', year: 2026, timeZone: 'UTC' },
    { kind: 'year', year: 2026, month: 10, timeZone: 'UTC' },
    { kind: 'month', year: 2026, month: 13, timeZone: 'UTC' },
    { kind: 'month', year: 2026, month: 0, timeZone: 'UTC' },
    { kind: 'year', year: 2019, timeZone: 'UTC' },
    { kind: 'year', year: 2101, timeZone: 'UTC' },
    { kind: 'year', year: 2026, timeZone: '+03:00' },
    { kind: 'year', year: 2026, timeZone: 'America/Wrong' },
    { kind: 'year', year: 2026 },
  ])
    expect(replayQuerySchema.safeParse(value).success).toBe(false);
});

it('registers Replay as a session-protected route with a response contract', () => {
  const route = API_ROUTE_DEFINITIONS.find((item) => item.path === API_ROUTES.replay);
  expect(route).toMatchObject({ method: 'get', auth: true, tags: ['me'] });
  expect(route?.responses[200]?.schema).toBeDefined();
});

it('requires an ISO server snapshot timestamp for each Replay response', () => {
  const schema = replayResponseSchema.pick({ generatedAt: true });
  expect(schema.parse({ generatedAt: '2026-10-15T16:00:00.000Z' })).toEqual({
    generatedAt: '2026-10-15T16:00:00.000Z',
  });
  expect(schema.safeParse({}).success).toBe(false);
  expect(schema.safeParse({ generatedAt: 'today' }).success).toBe(false);
  expect(schema.safeParse({ generatedAt: '2026-10-15' }).success).toBe(false);
});
