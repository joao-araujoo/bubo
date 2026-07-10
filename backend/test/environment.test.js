const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getEnvironment,
  normalizeEnvironment,
  validateEnvironment,
} = require('../src/config/env');

test('normalizeEnvironment parses origins and numeric protection limits', () => {
  const config = normalizeEnvironment({
    NODE_ENV: 'production',
    PORT: '4100',
    MONGODB_URI: 'mongodb://mongo:27017/bubo',
    JWT_SECRET: 'a-secret-with-more-than-24-characters',
    CLIENT_URL: 'https://bubo.example, https://admin.bubo.example',
    API_RATE_LIMIT: '500',
    AUTH_RATE_LIMIT: '40',
    TRUST_PROXY: 'true',
  });

  assert.equal(config.port, 4100);
  assert.deepEqual(config.clientOrigins, [
    'https://bubo.example',
    'https://admin.bubo.example',
  ]);
  assert.equal(config.apiRateLimit, 500);
  assert.equal(config.authRateLimit, 40);
  assert.equal(config.trustProxy, true);
});

test('validateEnvironment rejects weak JWT secrets', () => {
  const config = normalizeEnvironment({
    MONGODB_URI: 'mongodb://localhost:27017/bubo',
    JWT_SECRET: 'short',
    CLIENT_URL: 'http://localhost:5173',
  });
  const errors = validateEnvironment(config);

  assert.ok(errors.some((message) => message.includes('JWT_SECRET')));
});

test('getEnvironment throws before server startup when configuration is invalid', () => {
  assert.throws(
    () => getEnvironment({
      PORT: '3001',
      MONGODB_URI: 'mongodb://localhost:27017/bubo',
      JWT_SECRET: '',
      CLIENT_URL: 'http://localhost:5173',
    }),
    (error) => error.code === 'INVALID_ENVIRONMENT',
  );
});

test('getEnvironment accepts a production-ready configuration', () => {
  const config = getEnvironment({
    NODE_ENV: 'production',
    PORT: '3001',
    MONGODB_URI: 'mongodb://mongo:27017/bubo',
    JWT_SECRET: 'production-secret-with-more-than-24-characters',
    CLIENT_URL: 'https://bubo.example',
  });

  assert.equal(config.nodeEnv, 'production');
  assert.equal(config.errors.length, 0);
});
