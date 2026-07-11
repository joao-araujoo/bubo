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
const { sanitizeValue } = require('../src/utils/logger');

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
});

test('external error payloads inherit context without leaking credentials', async () => {
  await runWithRequestContext({ requestId: 'request-report-1234', userId: 'user-8' }, async () => {
    const payload = buildPayload(new Error('Database unavailable'), {
      authorization: 'Bearer hidden',
      password: 'hidden',
      operation: 'create-review',
    });

    assert.equal(payload.request.requestId, 'request-report-1234');
    assert.equal(payload.request.userId, 'user-8');
    assert.equal(payload.context.authorization, '[REDACTED]');
    assert.equal(payload.context.password, '[REDACTED]');
    assert.equal(payload.context.operation, 'create-review');
    assert.equal(payload.error.message, 'Database unavailable');
  });
});

test('http metrics normalize identifiers and aggregate bounded latency data', () => {
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

  const snapshot = getMetricsSnapshot({
    database: 'connected',
    runtime: { acceptingTraffic: true },
    service: 'bubo-api-test',
    release: 'test-release',
  });

  assert.equal(snapshot.service, 'bubo-api-test');
  assert.equal(snapshot.release, 'test-release');
  assert.equal(snapshot.http.totalRequests, 1);
  assert.equal(snapshot.http.statusClasses['2xx'], 1);
  assert.equal(snapshot.http.latencyBuckets[100], 0);
  assert.equal(snapshot.http.latencyBuckets[250], 1);
  assert.equal(snapshot.http.routes['GET /api/books/library/:id'].count, 1);
  assert.equal(snapshot.http.routes['GET /api/books/library/:id'].durationMsAverage, 120);
  resetMetrics();
});

test('health contracts distinguish process liveness from service readiness', () => {
  const runtime = {
    acceptingTraffic: true,
    shuttingDown: false,
    uptimeSeconds: 12,
  };
  const liveness = buildLiveness({ requestId: 'request-live-1234', runtime });
  const ready = buildReadiness({ requestId: 'request-ready-1234', runtime, databaseReady: true });
  const degraded = buildReadiness({
    requestId: 'request-degraded-1234',
    runtime: { ...runtime, acceptingTraffic: false },
    databaseReady: true,
  });

  assert.equal(liveness.status, 'ok');
  assert.equal(ready.ready, true);
  assert.equal(ready.checks.database, 'connected');
  assert.equal(degraded.ready, false);
  assert.equal(degraded.checks.process, 'not-ready');
});
