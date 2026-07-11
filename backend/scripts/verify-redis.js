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

const main = async () => {
  const redisUrl = process.env.REDIS_URL;
  assert.ok(redisUrl, 'REDIS_URL is required for Redis verification');

  const verificationId = `${process.env.GITHUB_RUN_ID || 'local'}-${crypto.randomUUID()}`;
  const redisKeyPrefix = process.env.REDIS_KEY_PREFIX || 'bubo:verification';
  const cacheIdentifier = `cache-${verificationId}`;
  const rateLimitIdentifier = `client-${verificationId}`;
  const rateLimitPrefix = `${redisKeyPrefix}:verification:rate-limit:${verificationId}:`;

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
    assert.ok(sharedValue.resetTime instanceof Date);

    await firstStore.resetKey(rateLimitIdentifier);
    const resetValue = await secondStore.get(rateLimitIdentifier);
    assert.equal(resetValue.totalHits, 0, 'Reset in one store must be visible to another');

    await setRedisJson('verification', `${cacheIdentifier}-ttl`, { expires: true }, 1000);
    await sleep(1200);
    assert.equal(
      await getRedisJson('verification', `${cacheIdentifier}-ttl`),
      null,
      'Cache entries must expire according to TTL',
    );

    const state = getRedisState();
    assert.equal(state.ready, true);
    assert.ok(state.commands >= 10);
    assert.equal(state.target.host.length > 0, true);
    assert.equal(JSON.stringify(state).includes('@'), false, 'State must not expose URL credentials');

    console.log(JSON.stringify({
      status: 'ok',
      verificationId,
      commands: state.commands,
      rateLimitSharedHits: secondHit.totalHits,
      redis: {
        status: state.status,
        host: state.target.host,
        database: state.target.database,
      },
    }));
  } finally {
    await deleteRedisKey('verification', cacheIdentifier).catch(() => undefined);
    await deleteRedisKey('verification', `${cacheIdentifier}-ttl`).catch(() => undefined);
    await sendRedisCommand(['DEL', `${rateLimitPrefix}${rateLimitIdentifier}`], {
      operation: 'verification_cleanup',
    }).catch(() => undefined);
    await disconnectRedis();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
