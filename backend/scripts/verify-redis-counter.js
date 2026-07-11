const assert = require('node:assert/strict');
const { RedisStore } = require('rate-limit-redis');
const {
  configureRedis,
  connectRedis,
  disconnectRedis,
  sendRedisCommand,
} = require('../src/infrastructure/redis/redisManager');

const main = async () => {
  const redisUrl = process.env.REDIS_URL;
  const verificationId = process.env.REDIS_VERIFICATION_ID;
  const mode = process.env.REDIS_VERIFICATION_MODE || 'increment';
  const keyPrefix = process.env.REDIS_KEY_PREFIX || 'bubo:verification';
  const clientKey = 'shared-client';
  let output;

  assert.ok(redisUrl, 'REDIS_URL is required');
  assert.ok(verificationId, 'REDIS_VERIFICATION_ID is required');
  assert.ok(['increment', 'read', 'reset'].includes(mode), 'Unsupported verification mode');

  configureRedis({
    redisEnabled: true,
    redisRequired: true,
    redisUrl,
    redisKeyPrefix: keyPrefix,
    redisConnectTimeoutMs: Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 5000,
    redisCommandTimeoutMs: Number(process.env.REDIS_COMMAND_TIMEOUT_MS) || 1500,
  });

  try {
    const connected = await connectRedis();
    assert.equal(connected.ready, true);

    const store = new RedisStore({
      prefix: `${keyPrefix}:process-verification:${verificationId}:`,
      sendCommand: (...args) => sendRedisCommand(args, {
        operation: 'process_verification_rate_limit',
      }),
    });
    store.init({ windowMs: 60000 });

    if (mode === 'reset') {
      await store.resetKey(clientKey);
      output = { status: 'ok', mode, totalHits: 0 };
    } else {
      const result = mode === 'increment'
        ? await store.increment(clientKey)
        : await store.get(clientKey);

      output = {
        status: 'ok',
        mode,
        totalHits: result?.totalHits || 0,
        resetTime: result?.resetTime?.toISOString?.() || null,
      };
    }
  } finally {
    await disconnectRedis();
  }

  console.log(JSON.stringify(output));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
