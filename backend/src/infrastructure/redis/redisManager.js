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
  let config = {
    redisEnabled: false,
    redisRequired: false,
    redisUrl: '',
    redisKeyPrefix: 'bubo:development',
    redisConnectTimeoutMs: 5000,
    redisCommandTimeoutMs: 1500,
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

  const attachLifecycle = () => {
    client.on('connect', () => {
      state.status = 'connecting';
      loggerImpl.info('redis_connecting', { target: targetFromUrl(config.redisUrl) });
    });
    client.on('ready', () => {
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
      if (state.status !== 'stopped') state.status = config.redisEnabled ? 'disconnected' : 'disabled';
      loggerImpl.info('redis_disconnected', { target: targetFromUrl(config.redisUrl) });
    });
  };

  const configure = (nextConfig = {}) => {
    if (client) return getState();
    config = { ...config, ...nextConfig };

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
  });

  const connect = async () => {
    if (!config.redisEnabled || !config.redisUrl) {
      state.status = 'disabled';
      return getState();
    }
    if (!client) configure(config);
    if (client.isReady) return getState();

    state.status = 'connecting';
    try {
      if (!client.isOpen) await client.connect();
      const pong = await sendCommand(['PING'], { operation: 'startup_ping' });
      if (pong !== 'PONG') throw unavailableError('Redis ping returned an unexpected response');
      state.status = 'ready';
      state.lastReadyAt = new Date().toISOString();
      state.lastPingAt = new Date().toISOString();
      return getState();
    } catch (error) {
      markFailure(error, 'connect');
      if (config.redisRequired) throw error;
      return getState();
    }
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
