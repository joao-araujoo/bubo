const crypto = require('crypto');
const assert = require('node:assert/strict');
const { RedisStore } = require('rate-limit-redis');
const {
  configureRedis,
  connectRedis,
  deleteRedisKey,
  disconnectRedis,
  getRedisJson,
  getRedisState,
  sendRedisCommand,
  setRedisJson,
} = require('../src/infrastructure/redis/redisManager');

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const waitForMissingJson = async (scope, identifier, timeoutMs = 5000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await getRedisJson(scope, identifier) === null) return true;
    await sleep(200);
  }
  return false;
};

const main = async () => {
  const redisUrl = process.env.REDIS_URL;
  assert.ok(redisUrl, 'REDIS_URL is required for Redis verification');

  const verificationId = `${process.env.GITHUB_RUN_ID || 'local'}-${crypto.randomUUID()}`;
  const redisKeyPrefix = process.env.REDIS_KEY_PREFIX || 'bubo:verification';
  const cacheIdentifier = `cache-${verificationId}`;
  const ttlIdentifier = `${cacheIdentifier}-ttl`;
  const rateLimitIdentifier = `client-${verificationId}`;
  const rateLimitKey = `${redisKeyPrefix}:verification:rate-limit:${verificationId}:${rateLimitIdentifier}`;
  const rateLimitPrefix = `${redisKeyPrefix}:verification:rate-limit:${verificationId}:`;
  const phases = [];
  let output;

  configureRedis({
    redisEnabled: true,
    redisRequired: true,
    redisUrl,
    redisKeyPrefix,
    redisConnectTimeoutMs: Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 5000,
    redisCommandTimeoutMs: Number(process.env.REDIS_COMMAND_TIMEOUT_MS) || 1500,
  });

  try {
    const connected = await connectRedis();
    assert.equal(connected.ready, true, 'Redis must be ready');
    phases.push('connected');

    const payload = {
      verificationId,
      books: [{ title: 'Bubo Redis Verification' }],
    };
    await setRedisJson('verification', cacheIdentifier, payload, 5000);
    assert.deepEqual(
      await getRedisJson('verification', cacheIdentifier),
      payload,
      'JSON written by one operation must be readable by another',
    );
    phases.push('json-roundtrip');

    const sendCommand = (...args) => sendRedisCommand(args, {
      operation: 'verification_rate_limit',
    });
    const firstStore = new RedisStore({ prefix: rateLimitPrefix, sendCommand });
    const secondStore = new RedisStore({ prefix: rateLimitPrefix, sendCommand });
    firstStore.init({ windowMs: 10000 });
    secondStore.init({ windowMs: 10000 });

    const firstHit = await firstStore.increment(rateLimitIdentifier);
    const secondHit = await secondStore.increment(rateLimitIdentifier);
    const sharedValue = await firstStore.get(rateLimitIdentifier);

    assert.equal(firstHit.totalHits, 1, 'First store must create the counter');
    assert.equal(secondHit.totalHits, 2, 'Second store must increment the same counter');
    assert.equal(sharedValue.totalHits, 2, 'Both stores must observe the shared total');
    phases.push('shared-counter');

    await firstStore.resetKey(rateLimitIdentifier);
    const resetKeyExists = Number(await sendRedisCommand(
      ['EXISTS', rateLimitKey],
      { operation: 'verification_rate_limit_reset' },
    ));
    assert.equal(resetKeyExists, 0, 'Reset in one store must remove the shared Redis key');
    phases.push('shared-reset');

    await setRedisJson('verification', ttlIdentifier, { expires: true }, 1000);
    assert.equal(
      await waitForMissingJson('verification', ttlIdentifier),
      true,
      'Cache entries must expire according to TTL',
    );
    phases.push('ttl-expiration');

    const state = getRedisState();
    assert.equal(state.ready, true);
    assert.ok(state.commands > 0, 'Redis command metrics must be recorded');
    assert.equal(Boolean(state.target?.host), true);
    assert.equal(JSON.stringify(state).includes('@'), false, 'State must not expose URL credentials');
    phases.push('sanitized-metrics');

    output = {
      status: 'ok',
      verificationId,
      phases,
      commands: state.commands,
      rateLimitSharedHits: secondHit.totalHits,
      redis: {
        status: state.status,
        host: state.target.host,
        database: state.target.database,
      },
    };
  } finally {
    await deleteRedisKey('verification', cacheIdentifier).catch(() => undefined);
    await deleteRedisKey('verification', ttlIdentifier).catch(() => undefined);
    await sendRedisCommand(['DEL', rateLimitKey], {
      operation: 'verification_cleanup',
    }).catch(() => undefined);
    await disconnectRedis();
  }

  console.log(JSON.stringify(output));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
