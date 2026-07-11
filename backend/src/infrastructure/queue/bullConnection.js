const { createNodeRedisClient } = require('bullmq');
const { createClient } = require('redis');
const logger = require('../../utils/logger');

const createBullConnection = async ({ redisUrl, connectTimeoutMs, role }) => {
  const rawClient = createClient({
    url: redisUrl,
    disableOfflineQueue: role === 'producer',
    socket: {
      connectTimeout: connectTimeoutMs,
      reconnectStrategy(retries) {
        if (role === 'producer' && retries >= 3) return new Error('Queue producer reconnect limit reached');
        return Math.min(250 * (2 ** retries), 5000);
      },
    },
  });

  rawClient.on('error', (error) => {
    logger.warn('deep_review_queue_redis_error', { role, error });
  });
  rawClient.on('reconnecting', () => {
    logger.warn('deep_review_queue_redis_reconnecting', { role });
  });

  const connection = createNodeRedisClient(rawClient);
  await connection.connect();
  return { connection, rawClient };
};

const closeBullConnection = async (resource) => {
  if (!resource?.connection) return;
  try {
    if (resource.connection.status !== 'end') await resource.connection.quit();
  } catch (error) {
    logger.warn('deep_review_queue_connection_close_failed', { error });
    resource.rawClient?.destroy?.();
  }
};

module.exports = {
  closeBullConnection,
  createBullConnection,
};
