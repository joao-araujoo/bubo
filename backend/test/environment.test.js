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
  assert.equal(config.instanceCount, 1);
  assert.equal(config.redisEnabled, false);
  assert.equal(config.redisRequired, false);
});

test('development enables local metrics by default', () => {
  const config = normalizeEnvironment({
    ...validBase,
    NODE_ENV: 'development',
  });

  assert.equal(config.metricsEnabled, true);
});

test('multiple instances require redis automatically', () => {
  const config = normalizeEnvironment({
    ...validBase,
    INSTANCE_COUNT: '3',
  });
  const errors = validateEnvironment(config);

  assert.equal(config.redisRequired, true);
  assert.ok(errors.some((message) => message.includes('REDIS_URL')));
});

test('redis configuration accepts authenticated redis and rediss urls', () => {
  const redis = getEnvironment({
    ...validBase,
    INSTANCE_COUNT: '2',
    REDIS_URL: 'redis://reader:private-password@redis.internal:6379/2',
    REDIS_KEY_PREFIX: 'bubo:production',
  });
  const rediss = getEnvironment({
    ...validBase,
    REDIS_REQUIRED: 'true',
    REDIS_URL: 'rediss://cache.example:6380/0',
  });

  assert.equal(redis.redisEnabled, true);
  assert.equal(redis.redisRequired, true);
  assert.equal(redis.redisKeyPrefix, 'bubo:production');
  assert.equal(rediss.redisEnabled, true);
});

test('redis configuration rejects invalid protocols and unsafe prefixes', () => {
  const invalidUrl = validateEnvironment(normalizeEnvironment({
    ...validBase,
    REDIS_URL: 'http://cache.example',
  }));
  const invalidPrefix = validateEnvironment(normalizeEnvironment({
    ...validBase,
    REDIS_KEY_PREFIX: 'bubo production with spaces',
  }));

  assert.ok(invalidUrl.some((message) => message.includes('REDIS_URL')));
  assert.ok(invalidPrefix.some((message) => message.includes('REDIS_KEY_PREFIX')));
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
    INSTANCE_COUNT: '2',
    REDIS_URL: 'rediss://cache.example:6380/0',
    METRICS_ENABLED: 'true',
    METRICS_TOKEN: 'production-metrics-token-long-enough',
    ERROR_REPORTING_URL: 'https://errors.example/collect',
    ERROR_REPORTING_TOKEN: 'production-error-token',
  });

  assert.equal(config.nodeEnv, 'production');
  assert.equal(config.metricsEnabled, true);
  assert.equal(config.redisRequired, true);
  assert.equal(config.errors.length, 0);
});
