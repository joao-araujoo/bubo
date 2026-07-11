const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPayload } = require('../src/observability/errorReporter');
const { buildLiveness, buildReadiness } = require('../src/observability/health');
const {
  beginHttpRequest,
  getMetricsSnapshot,
  normalizePath,
  resetMetrics,
} = require('../src/observability/metrics');
const {
  createRequestId,
  getRequestContext,
  runWithRequestContext,
  updateRequestContext,
} = require('../src/observability/requestContext');
const {
  redactSensitiveText,
  sanitizeValue,
} = require('../src/utils/logger');

test('request context accepts safe ids and rejects unsafe values', () => {
  assert.equal(createRequestId('request-12345678'), 'request-12345678');
  assert.notEqual(createRequestId('short'), 'short');
  assert.match(createRequestId('short'), /^[0-9a-f-]{36}$/i);
});

test('request context survives asynchronous work and accepts authenticated user data', async () => {
  await runWithRequestContext({ requestId: 'request-async-1234' }, async () => {
    await Promise.resolve();
    updateRequestContext({ userId: 'user-42' });
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(getRequestContext(), {
      requestId: 'request-async-1234',
      userId: 'user-42',
    });
  });

  assert.deepEqual(getRequestContext(), {});
});

test('structured sanitization removes secrets recursively and handles circular objects', () => {
  const value = {
    email: 'reader@example.com',
    password: 'do-not-log',
    diagnostic: 'Failed redis://reader:private-password@cache.internal:6379 and Bearer abc.def.ghi',
    headers: {
      authorization: 'Bearer secret-token',
      'x-request-id': 'request-12345678',
    },
  };
  value.circular = value;

  const sanitized = sanitizeValue(value);
  assert.equal(sanitized.email, 'reader@example.com');
  assert.equal(sanitized.password, '[REDACTED]');
  assert.equal(sanitized.headers.authorization, '[REDACTED]');
  assert.equal(sanitized.headers['x-request-id'], 'request-12345678');
  assert.equal(sanitized.circular, '[CIRCULAR]');
  assert.equal(sanitized.diagnostic.includes('private-password'), false);
  assert.equal(sanitized.diagnostic.includes('abc.def.ghi'), false);
  assert.equal(sanitized.diagnostic.includes('redis://[REDACTED]@cache.internal:6379'), true);
});

test('text redaction covers authenticated urls and authorization schemes', () => {
  const redacted = redactSensitiveText(
    'mongodb://user:pass@mongo:27017 redis://reader:secret@redis:6379 Bearer token.value Basic dXNlcjpwYXNz',
  );

  assert.equal(redacted.includes('user:pass'), false);
  assert.equal(redacted.includes('reader:secret'), false);
  assert.equal(redacted.includes('token.value'), false);
  assert.equal(redacted.includes('dXNlcjpwYXNz'), false);
  assert.match(redacted, /mongodb:\/\/\[REDACTED\]@mongo:27017/);
  assert.match(redacted, /Bearer \[REDACTED\]/);
  assert.match(redacted, /Basic \[REDACTED\]/);
});

test('external error payloads inherit context without leaking credentials', async () => {
  await runWithRequestContext({ requestId: 'request-report-1234', userId: 'user-8' }, async () => {
    const payload = buildPayload(
      new Error('Redis failed at redis://reader:hidden@cache.internal:6379'),
      {
        authorization: 'Bearer hidden',
        password: 'hidden',
        operation: 'create-review',
      },
    );

    assert.equal(payload.request.requestId, 'request-report-1234');
    assert.equal(payload.request.userId, 'user-8');
    assert.equal(payload.context.authorization, '[REDACTED]');
    assert.equal(payload.context.password, '[REDACTED]');
    assert.equal(payload.context.operation, 'create-review');
    assert.equal(payload.error.message.includes('hidden'), false);
    assert.equal(payload.error.message.includes('redis://[REDACTED]@cache.internal:6379'), true);
  });
});

test('http metrics normalize identifiers and include shared dependency state', () => {
  resetMetrics();
  assert.equal(
    normalizePath('/api/books/library/507f1f77bcf86cd799439011/sessions/42?draft=true'),
    '/api/books/library/:id/sessions/:id',
  );

  const complete = beginHttpRequest();
  complete({
    method: 'GET',
    path: '/api/books/library/507f1f77bcf86cd799439011',
    statusCode: 200,
    durationMs: 120,
  });

  const redis = {
    enabled: true,
    required: false,
    ready: true,
    status: 'ready',
    commands: 8,
    failures: 0,
  };
  const snapshot = getMetricsSnapshot({
    database: 'connected',
    redis,
    runtime: { acceptingTraffic: true },
    service: 'bubo-api-test',
    release: 'test-release',
  });

  assert.equal(snapshot.service, 'bubo-api-test');
  assert.equal(snapshot.release, 'test-release');
  assert.deepEqual(snapshot.redis, redis);
  assert.equal(snapshot.http.totalRequests, 1);
  assert.equal(snapshot.http.statusClasses['2xx'], 1);
  assert.equal(snapshot.http.latencyBuckets[100], 0);
  assert.equal(snapshot.http.latencyBuckets[250], 1);
  assert.equal(snapshot.http.routes['GET /api/books/library/:id'].count, 1);
  assert.equal(snapshot.http.routes['GET /api/books/library/:id'].durationMsAverage, 120);
  resetMetrics();
});

test('health contracts distinguish optional and required redis availability', () => {
  const runtime = {
    acceptingTraffic: true,
    shuttingDown: false,
    uptimeSeconds: 12,
  };
  const liveness = buildLiveness({ requestId: 'request-live-1234', runtime });
  const withoutRedis = buildReadiness({
    requestId: 'request-ready-1234',
    runtime,
    databaseReady: true,
    redis: { enabled: false, required: false, ready: false, status: 'disabled' },
  });
  const optionalRedisDown = buildReadiness({
    requestId: 'request-optional-1234',
    runtime,
    databaseReady: true,
    redis: { enabled: true, required: false, ready: false, status: 'degraded' },
  });
  const requiredRedisDown = buildReadiness({
    requestId: 'request-required-1234',
    runtime,
    databaseReady: true,
    redis: { enabled: true, required: true, ready: false, status: 'degraded' },
  });
  const requiredRedisReady = buildReadiness({
    requestId: 'request-redis-ready-1234',
    runtime,
    databaseReady: true,
    redis: { enabled: true, required: true, ready: true, status: 'ready' },
  });

  assert.equal(liveness.status, 'ok');
  assert.equal(withoutRedis.ready, true);
  assert.equal(withoutRedis.redis, 'disabled');
  assert.equal(optionalRedisDown.ready, true);
  assert.equal(optionalRedisDown.status, 'degraded');
  assert.equal(requiredRedisDown.ready, false);
  assert.equal(requiredRedisDown.dependencies.redis.required, true);
  assert.equal(requiredRedisReady.ready, true);
  assert.equal(requiredRedisReady.status, 'ok');
});
