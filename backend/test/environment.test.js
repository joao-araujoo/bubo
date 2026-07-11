const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getEnvironment,
  normalizeEnvironment,
  validateEnvironment,
} = require('../src/config/env');

const validBase = {
  PORT: '3001',
  MONGODB_URI: 'mongodb://mongo:27017/bubo',
  JWT_SECRET: 'a-secret-with-more-than-24-characters',
  CLIENT_URL: 'https://bubo.example',
};

test('normalizeEnvironment parses origins and numeric protection limits', () => {
  const config = normalizeEnvironment({
    ...validBase,
    NODE_ENV: 'production',
    PORT: '4100',
    CLIENT_URL: 'https://bubo.example, https://admin.bubo.example',
    API_RATE_LIMIT: '500',
    AUTH_RATE_LIMIT: '40',
    TRUST_PROXY: 'true',
    APP_RELEASE: 'commit-123',
  });

  assert.equal(config.port, 4100);
  assert.deepEqual(config.clientOrigins, [
    'https://bubo.example',
    'https://admin.bubo.example',
  ]);
  assert.equal(config.apiRateLimit, 500);
  assert.equal(config.authRateLimit, 40);
  assert.equal(config.trustProxy, true);
  assert.equal(config.release, 'commit-123');
  assert.equal(config.metricsEnabled, false);
});

test('development enables local metrics by default', () => {
  const config = normalizeEnvironment({
    ...validBase,
    NODE_ENV: 'development',
  });

  assert.equal(config.metricsEnabled, true);
});

test('validateEnvironment rejects weak JWT secrets', () => {
  const config = normalizeEnvironment({
    ...validBase,
    JWT_SECRET: 'short',
  });
  const errors = validateEnvironment(config);

  assert.ok(errors.some((message) => message.includes('JWT_SECRET')));
});

test('production metrics require a strong bearer token', () => {
  const config = normalizeEnvironment({
    ...validBase,
    NODE_ENV: 'production',
    METRICS_ENABLED: 'true',
    METRICS_TOKEN: 'short',
  });
  const errors = validateEnvironment(config);

  assert.ok(errors.some((message) => message.includes('METRICS_TOKEN')));
});

test('external reporting rejects invalid urls and weak production credentials', () => {
  const invalidUrl = validateEnvironment(normalizeEnvironment({
    ...validBase,
    ERROR_REPORTING_URL: 'file:///tmp/errors',
  }));
  assert.ok(invalidUrl.some((message) => message.includes('ERROR_REPORTING_URL')));

  const weakToken = validateEnvironment(normalizeEnvironment({
    ...validBase,
    NODE_ENV: 'production',
    ERROR_REPORTING_URL: 'https://errors.example/collect',
    ERROR_REPORTING_TOKEN: 'short',
  }));
  assert.ok(weakToken.some((message) => message.includes('ERROR_REPORTING_TOKEN')));
});

test('getEnvironment throws before server startup when configuration is invalid', () => {
  assert.throws(
    () => getEnvironment({
      ...validBase,
      JWT_SECRET: '',
    }),
    (error) => error.code === 'INVALID_ENVIRONMENT',
  );
});

test('getEnvironment accepts a production-ready configuration', () => {
  const config = getEnvironment({
    ...validBase,
    NODE_ENV: 'production',
    METRICS_ENABLED: 'true',
    METRICS_TOKEN: 'production-metrics-token-long-enough',
    ERROR_REPORTING_URL: 'https://errors.example/collect',
    ERROR_REPORTING_TOKEN: 'production-error-token',
  });

  assert.equal(config.nodeEnv, 'production');
  assert.equal(config.metricsEnabled, true);
  assert.equal(config.errors.length, 0);
});
