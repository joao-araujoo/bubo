import { errorResponseSchema, healthResponseSchema, readyResponseSchema } from '@bubo/contracts';
import { describe, expect, it, vi } from 'vitest';

import { type AppDeps, createApp } from '../src/app';
import { createBindings, createLogCollector } from './helpers';

const fixedNow = () => new Date('2026-09-26T12:00:00.000Z');
const DB_URL = 'postgresql://db.example.test/bubo?sslmode=require';

function setup(options: { ping?: AppDeps['pingDatabase'] } = {}) {
  const logs = createLogCollector();
  const pingDatabase = options.ping ?? vi.fn(async () => ({ ok: true as const, latencyMs: 3 }));
  const app = createApp({ now: fixedNow, logSink: logs.sink, pingDatabase });
  return { app, logs, pingDatabase };
}

describe('GET /v1/health', () => {
  it('returns a valid liveness payload without touching the database', async () => {
    const { app, pingDatabase } = setup();
    const res = await app.request('/v1/health', {}, createBindings({ DATABASE_URL: DB_URL }));
    expect(res.status).toBe(200);
    const body = healthResponseSchema.parse(await res.json());
    expect(body).toMatchObject({ status: 'ok', service: 'bubo-api', environment: 'development' });
    expect(body.timestamp).toBe('2026-09-26T12:00:00.000Z');
    expect(pingDatabase).not.toHaveBeenCalled();
  });

  it('stays alive even when configuration is invalid', async () => {
    const { app } = setup();
    const res = await app.request('/v1/health', {}, createBindings({ APP_ENV: 'production' }));
    expect(res.status).toBe(200);
  });
});

describe('GET /v1/ready', () => {
  it('is not ready when DATABASE_URL is missing', async () => {
    const { app, pingDatabase } = setup();
    const res = await app.request('/v1/ready', {}, createBindings());
    expect(res.status).toBe(503);
    const body = readyResponseSchema.parse(await res.json());
    expect(body.checks.database.status).toBe('not_configured');
    expect(pingDatabase).not.toHaveBeenCalled();
  });

  it('is ready when config is valid and the database answers', async () => {
    const { app, pingDatabase } = setup();
    const res = await app.request('/v1/ready', {}, createBindings({ DATABASE_URL: DB_URL }));
    expect(res.status).toBe(200);
    const body = readyResponseSchema.parse(await res.json());
    expect(body).toMatchObject({
      status: 'ready',
      checks: { database: { status: 'ok', latencyMs: 3 } },
    });
    expect(pingDatabase).toHaveBeenCalledWith(DB_URL);
  });

  it('reports a database failure without leaking the connection string', async () => {
    const { app } = setup({
      ping: async () => ({ ok: false, latencyMs: 12, error: 'Database unreachable (Error)' }),
    });
    const res = await app.request('/v1/ready', {}, createBindings({ DATABASE_URL: DB_URL }));
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).not.toContain('db.example.test');
    expect(readyResponseSchema.parse(JSON.parse(text)).checks.database.status).toBe('error');
  });

  it('reports invalid configuration by variable name only', async () => {
    const { app } = setup();
    const res = await app.request(
      '/v1/ready',
      {},
      createBindings({ BETTER_AUTH_SECRET: 'short-secret-value' }),
    );
    const body = readyResponseSchema.parse(await res.json());
    expect(body.checks.config.status).toBe('error');
    expect(body.checks.config.message).toContain('BETTER_AUTH_SECRET');
    expect(JSON.stringify(body)).not.toContain('short-secret-value');
  });
});

describe('request id, errors and headers', () => {
  it('generates a request id and echoes a valid incoming one', async () => {
    const { app } = setup();
    const generated = await app.request('/v1/health', {}, createBindings());
    expect(generated.headers.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/);

    const echoed = await app.request(
      '/v1/health',
      { headers: { 'X-Request-Id': 'client-req-12345' } },
      createBindings(),
    );
    expect(echoed.headers.get('X-Request-Id')).toBe('client-req-12345');

    const rejected = await app.request(
      '/v1/health',
      { headers: { 'X-Request-Id': 'bad id with spaces' } },
      createBindings(),
    );
    expect(rejected.headers.get('X-Request-Id')).not.toBe('bad id with spaces');
  });

  it('returns the error envelope for unknown routes', async () => {
    const { app } = setup();
    const res = await app.request('/v1/nope', {}, createBindings());
    expect(res.status).toBe(404);
    const body = errorResponseSchema.parse(await res.json());
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.requestId).toBe(res.headers.get('X-Request-Id'));
  });

  it('sets security headers', async () => {
    const { app } = setup();
    const res = await app.request('/v1/health', {}, createBindings());
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('writes structured, redacted access logs', async () => {
    const { app, logs } = setup();
    await app.request(
      '/v1/health',
      { headers: { Authorization: 'Bearer secret' } },
      createBindings(),
    );
    const entry = JSON.parse(logs.lines.at(-1) ?? '{}') as Record<string, unknown>;
    expect(entry).toMatchObject({
      level: 'info',
      message: 'request',
      path: '/v1/health',
      status: 200,
    });
    expect(logs.lines.join('\n')).not.toContain('Bearer secret');
  });
});

describe('GET /v1/openapi.json', () => {
  it('serves an OpenAPI document for every registered route', async () => {
    const { app } = setup();
    const res = await app.request('http://localhost/v1/openapi.json', {}, createBindings());
    expect(res.status).toBe(200);
    const doc = (await res.json()) as { openapi: string; paths: Record<string, unknown> };
    expect(doc.openapi).toBe('3.0.3');
    expect(Object.keys(doc.paths)).toEqual([
      '/v1/me/memory',
      '/v1/me/achievements',
      '/v1/me/league',
      '/v1/health',
      '/v1/ready',
      '/v1/me',
      '/v1/me/onboarding',
      '/v1/me/stats',
      '/v1/shelf',
      '/v1/shelf/{id}',
      '/v1/sessions',
      '/v1/sessions/assessment',
      '/v1/recall/due',
      '/v1/recall/cards',
      '/v1/recall/cards/{id}',
      '/v1/recall/cards/{id}/review',
      '/v1/catalog/search',
      '/v1/catalog/books/{catalogId}',
      '/v1/catalog/isbn/{isbn}',
      '/v1/clubs',
      '/v1/clubs/{id}',
      '/v1/clubs/{id}/membership',
      '/v1/clubs/{id}/posts',
      '/v1/clubs/{id}/posts/{postId}',
      '/v1/clubs/{id}/posts/{postId}/replies',
      '/v1/clubs/{id}/replies/{replyId}',
      '/v1/clubs/{id}/moderation',
      '/v1/reports',
      '/v1/blocks',
      '/v1/blocks/{userId}',
      '/v1/community/feed',
      '/v1/clubs/join',
      '/v1/clubs/invite/{code}',
      '/v1/clubs/{id}/invite-code',
      '/v1/clubs/{id}/members',
      '/v1/clubs/{id}/polls',
      '/v1/clubs/{id}/polls/{pollId}',
      '/v1/clubs/{id}/polls/{pollId}/vote',
      '/v1/clubs/{id}/polls/{pollId}/argument',
      '/v1/reactions',
      '/v1/community/friends',
      '/v1/community/friends/{userId}',
      '/v1/community/friends-feed',
      '/v1/me/social-preferences',
      '/v1/clubs/{id}/cycles',
      '/v1/clubs/{id}/cycles/{cycleId}/close',
      '/v1/me/moderation',
      '/v1/me/preferences',
      '/v1/me/push-token',
      '/v1/me/push-token/{token}',
      '/v1/notifications',
      '/v1/notifications/read',
    ]);
  });
});
