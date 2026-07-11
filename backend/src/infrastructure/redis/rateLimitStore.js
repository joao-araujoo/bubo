const { RedisStore } = require('rate-limit-redis');
const {
  getRedisClient,
  sendRedisCommand,
} = require('./redisManager');

const sanitizeNamespace = (value) => String(value || 'default')
  .toLowerCase()
  .replace(/[^a-z0-9_-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 48) || 'default';

const createRateLimitStore = ({ namespace, config }) => {
  if (!config.redisEnabled || !getRedisClient()) {
    return {
      distributed: false,
      passOnStoreError: true,
      store: undefined,
    };
  }

  const safeNamespace = sanitizeNamespace(namespace);
  return {
    distributed: true,
    passOnStoreError: !config.redisRequired,
    store: new RedisStore({
      prefix: `${config.redisKeyPrefix}:rate-limit:${safeNamespace}:`,
      sendCommand: (...args) => sendRedisCommand(args, {
        operation: `rate_limit_${safeNamespace}`,
      }),
    }),
  };
};

module.exports = {
  createRateLimitStore,
  sanitizeNamespace,
};
