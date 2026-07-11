const { createClient } = require('redis');
const logger = require('../../utils/logger');

const unavailableError = (message = 'Redis is unavailable') => {
  const error = new Error(message);
  error.code = 'REDIS_UNAVAILABLE';
  return error;
};

const targetFromUrl = (value) => {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return {
      protocol: parsed.protocol.replace(':', ''),
      host: parsed.hostname,
      port: Number(parsed.port) || 6379,
      database: Number(String(parsed.pathname || '/0').replace('/', '')) || 0,
    };
  } catch {
    return null;
  }
};

const createRedisManager = ({ createClientImpl = createClient, loggerImpl = logger } = {}) => {
  let client = null;
  let connectingPromise = null;
  let retryTimer = null;
  let stopping = false;
  let config = {
    redisEnabled: false,
    redisRequired: false,
    redisUrl: '',
    redisKeyPrefix: 'bubo:development',
    redisConnectTimeoutMs: 5000,
    redisCommandTimeoutMs: 1500,
    redisReconnectDelayMs: 30000,
  };
  const state = {
    status: 'disabled',
    reconnects: 0,
    commands: 0,
    failures: 0,
    durationMsTotal: 0,
    durationMsMax: 0,
    lastErrorAt: null,
    lastReadyAt: null,
    lastPingAt: null,
    nextRetryAt: null,
  };

  const clearRetry = () => {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    state.nextRetryAt = null;
  };

  const markFailure = (error, operation) => {
    state.status = config.redisEnabled ? 'degraded' : 'disabled';
    state.failures += 1;
    state.lastErrorAt = new Date().toISOString();
    loggerImpl.warn('redis_operation_failed', {
      operation,
      required: config.redisRequired,
      target: targetFromUrl(config.redisUrl),
      error,
    });
  };

  const scheduleReconnect = () => {
    if (
      stopping
      || config.redisRequired
      || !config.redisEnabled
      || !config.redisUrl
      || retryTimer
      || client?.isReady
    ) return;

    const delayMs = config.redisReconnectDelayMs || 30000;
    state.nextRetryAt = new Date(Date.now() + delayMs).toISOString();
    retryTimer = setTimeout(async () => {
      retryTimer = null;
      state.nextRetryAt = null;
      try {
        await connect();
      } catch (error) {
        markFailure(error, 'scheduled_reconnect');
        scheduleReconnect();
      }
    }, delayMs);
    retryTimer.unref?.();
    loggerImpl.info('redis_reconnect_scheduled', {
      delayMs,
      target: targetFromUrl(config.redisUrl),
    });
  };

  const attachLifecycle = () => {
    client.on('connect', () => {
      state.status = 'connecting';
      loggerImpl.info('redis_connecting', { target: targetFromUrl(config.redisUrl) });
    });
    client.on('ready', () => {
      clearRetry();
      state.status = 'ready';
      state.lastReadyAt = new Date().toISOString();
      loggerImpl.info('redis_ready', {
        required: config.redisRequired,
        target: targetFromUrl(config.redisUrl),
      });
    });
    client.on('reconnecting', () => {
      state.status = 'reconnecting';
      state.reconnects += 1;
      loggerImpl.warn('redis_reconnecting', {
        reconnects: state.reconnects,
        target: targetFromUrl(config.redisUrl),
      });
    });
    client.on('error', (error) => markFailure(error, 'connection'));
    client.on('end', () => {
      if (!stopping) {
        state.status = config.redisEnabled ? 'disconnected' : 'disabled';
        scheduleReconnect();
      }
      loggerImpl.info('redis_disconnected', { target: targetFromUrl(config.redisUrl) });
    });
  };

  const configure = (nextConfig = {}) => {
    if (client) return getState();
    config = { ...config, ...nextConfig };
    stopping = false;

    if (!config.redisEnabled || !config.redisUrl) {
      state.status = 'disabled';
      return getState();
    }

    client = createClientImpl({
      url: config.redisUrl,
      disableOfflineQueue: true,
      socket: {
        connectTimeout: config.redisConnectTimeoutMs,
        reconnectStrategy(retries) {
          if (retries >= 8) return unavailableError('Redis reconnect limit reached');
          return Math.min(100 * (2 ** retries), 2000);
        },
      },
    });
    attachLifecycle();
    state.status = 'configured';
    return getState();
  };

  const getClient = () => client;

  const getState = () => ({
    enabled: Boolean(config.redisEnabled && config.redisUrl),
    required: Boolean(config.redisRequired),
    ready: Boolean(client?.isReady),
    open: Boolean(client?.isOpen),
    status: state.status,
    target: targetFromUrl(config.redisUrl),
    reconnects: state.reconnects,
    commands: state.commands,
    failures: state.failures,
    durationMsAverage: state.commands > 0
      ? Math.round((state.durationMsTotal / state.commands) * 100) / 100
      : 0,
    durationMsMax: state.durationMsMax,
    lastErrorAt: state.lastErrorAt,
    lastReadyAt: state.lastReadyAt,
    lastPingAt: state.lastPingAt,
    nextRetryAt: state.nextRetryAt,
  });

  const waitForReady = async () => {
    if (client.isReady) return;
    let timeout;
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        client.off?.('ready', onReady);
        client.off?.('end', onEnd);
        if (timeout) clearTimeout(timeout);
      };
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onEnd = () => {
        cleanup();
        reject(unavailableError('Redis connection closed before becoming ready'));
      };

      client.once('ready', onReady);
      client.once('end', onEnd);
      timeout = setTimeout(() => {
        cleanup();
        reject(unavailableError('Redis did not become ready before timeout'));
      }, config.redisConnectTimeoutMs);
      timeout.unref?.();
    });
  };

  const connect = async () => {
    if (!config.redisEnabled || !config.redisUrl) {
      state.status = 'disabled';
      return getState();
    }
    if (!client) configure(config);
    if (client.isReady) return getState();
    if (connectingPromise) return connectingPromise;

    connectingPromise = (async () => {
      state.status = 'connecting';
      try {
        if (!client.isOpen) await client.connect();
        if (!client.isReady) await waitForReady();
        const pong = await sendCommand(['PING'], { operation: 'startup_ping' });
        if (pong !== 'PONG') throw unavailableError('Redis ping returned an unexpected response');
        clearRetry();
        state.status = 'ready';
        state.lastReadyAt = new Date().toISOString();
        state.lastPingAt = new Date().toISOString();
        return getState();
      } catch (error) {
        markFailure(error, 'connect');
        if (config.redisRequired) throw error;
        scheduleReconnect();
        return getState();
      } finally {
        connectingPromise = null;
      }
    })();

    return connectingPromise;
  };

  const sendCommand = async (args, { operation = 'command' } = {}) => {
    if (!client || !client.isReady) throw unavailableError();
    const startedAt = Date.now();
    let timeout;

    try {
      const result = await Promise.race([
        client.sendCommand(args),
        new Promise((resolve, reject) => {
          timeout = setTimeout(() => reject(unavailableError(`Redis ${operation} timed out`)), config.redisCommandTimeoutMs);
          timeout.unref?.();
        }),
      ]);
      const durationMs = Date.now() - startedAt;
      state.commands += 1;
      state.durationMsTotal += durationMs;
      state.durationMsMax = Math.max(state.durationMsMax, durationMs);
      state.status = 'ready';
      if (args[0] === 'PING') state.lastPingAt = new Date().toISOString();
      return result;
    } catch (error) {
      markFailure(error, operation);
      throw error;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  };

  const key = (scope, identifier) => `${config.redisKeyPrefix}:${scope}:${identifier}`;

  const getJson = async (scope, identifier) => {
    const raw = await sendCommand(['GET', key(scope, identifier)], { operation: `${scope}_get` });
    if (raw === null || raw === undefined) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      await deleteKey(scope, identifier).catch(() => undefined);
      error.code = 'REDIS_INVALID_JSON';
      throw error;
    }
  };

  const setJson = async (scope, identifier, payload, ttlMs) => sendCommand([
    'SET',
    key(scope, identifier),
    JSON.stringify(payload),
    'PX',
    String(Math.max(1000, Number(ttlMs) || 1000)),
  ], { operation: `${scope}_set` });

  const deleteKey = async (scope, identifier) => sendCommand(
    ['DEL', key(scope, identifier)],
    { operation: `${scope}_delete` },
  );

  const ping = async () => {
    const pong = await sendCommand(['PING'], { operation: 'health_ping' });
    return pong === 'PONG';
  };

  const disconnect = async () => {
    stopping = true;
    clearRetry();
    if (!client) {
      state.status = 'disabled';
      return;
    }
    state.status = 'stopped';
    try {
      if (client.isOpen) await client.quit();
    } catch (error) {
      loggerImpl.warn('redis_shutdown_failed', { error });
      client.destroy?.();
    }
  };

  return {
    configure,
    connect,
    deleteKey,
    disconnect,
    getClient,
    getJson,
    getState,
    key,
    ping,
    sendCommand,
    setJson,
  };
};

const singleton = createRedisManager();

module.exports = {
  configureRedis: singleton.configure,
  connectRedis: singleton.connect,
  createRedisManager,
  deleteRedisKey: singleton.deleteKey,
  disconnectRedis: singleton.disconnect,
  getRedisClient: singleton.getClient,
  getRedisJson: singleton.getJson,
  getRedisState: singleton.getState,
  pingRedis: singleton.ping,
  redisKey: singleton.key,
  sendRedisCommand: singleton.sendCommand,
  setRedisJson: singleton.setJson,
  targetFromUrl,
  unavailableError,
};
