const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-with-more-than-24-characters';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.METRICS_ENABLED = 'true';

const app = require('../src/app');
const { stopMetrics } = require('../src/observability/metrics');

const listen = () => new Promise((resolve) => {
  const server = app.listen(0, '127.0.0.1', () => resolve(server));
});

const close = (server) => new Promise((resolve, reject) => {
  server.close((error) => (error ? reject(error) : resolve()));
});

test('observability endpoints expose traceable liveness, readiness and metrics', async (t) => {
  const server = await listen();
  t.after(async () => {
    await close(server);
    stopMetrics();
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const liveness = await fetch(`${baseUrl}/api/health/live`, {
    headers: { 'x-request-id': 'request-http-live-1234' },
  });
  const livenessBody = await liveness.json();
  assert.equal(liveness.status, 200);
  assert.equal(liveness.headers.get('x-request-id'), 'request-http-live-1234');
  assert.equal(liveness.headers.get('cache-control'), 'no-store');
  assert.equal(livenessBody.requestId, 'request-http-live-1234');
  assert.equal(livenessBody.status, 'ok');

  const readiness = await fetch(`${baseUrl}/api/health/ready`, {
    headers: { 'x-request-id': 'request-http-ready-1234' },
  });
  const readinessBody = await readiness.json();
  assert.equal(readiness.status, 503);
  assert.equal(readinessBody.ready, false);
  assert.equal(readinessBody.checks.database, 'disconnected');
  assert.equal(readinessBody.requestId, 'request-http-ready-1234');

  const compatibilityHealth = await fetch(`${baseUrl}/api/health`);
  assert.equal(compatibilityHealth.status, 503);

  const metrics = await fetch(`${baseUrl}/api/metrics`);
  const metricsBody = await metrics.json();
  assert.equal(metrics.status, 200);
  assert.equal(metrics.headers.get('cache-control'), 'no-store');
  assert.equal(metricsBody.service, 'bubo-api');
  assert.equal(metricsBody.database, 'disconnected');
  assert.ok(metricsBody.http.totalRequests >= 3);
  assert.ok(metricsBody.http.routes['GET /api/health/live'].count >= 1);

  const missing = await fetch(`${baseUrl}/api/does-not-exist`, {
    headers: { 'x-request-id': 'bad' },
  });
  const missingBody = await missing.json();
  assert.equal(missing.status, 404);
  assert.equal(missingBody.code, 'ENDPOINT_NOT_FOUND');
  assert.notEqual(missingBody.requestId, 'bad');
  assert.match(missingBody.requestId, /^[0-9a-f-]{36}$/i);
});
