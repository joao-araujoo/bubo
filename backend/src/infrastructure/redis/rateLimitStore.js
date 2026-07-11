const { MemoryStore } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const logger = require('../../utils/logger');
const {
  getRedisState,
  sendRedisCommand,
  unavailableError,
} = require('./redisManager');

const sanitizeNamespace = (value) => String(value || 'default')
  .toLowerCase()
  .replace(/[^a-z0-9_-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 48) || 'default';

class LazyRedisStore {
  constructor({
    prefix,
    operation,
    getState = getRedisState,
    sendCommand = sendRedisCommand,
    storeFactory = (options) => new RedisStore(options),
  }) {
    this.prefix = prefix;
    this.operation = operation;
    this.getState = getState;
    this.sendCommand = sendCommand;
    this.storeFactory = storeFactory;
    this.delegate = null;
    this.options = null;
  }

  init(options) {
    this.options = options;
    if (this.delegate) this.delegate.init(options);
  }

  getDelegate() {
    const state = this.getState();
    if (!state.ready) {
      throw unavailableError(`Redis is unavailable for ${this.operation}`);
    }

    if (!this.delegate) {
      this.delegate = this.storeFactory({
        prefix: this.prefix,
        sendCommand: (...args) => this.sendCommand(args, {
          operation: this.operation,
        }),
      });
      if (this.options) this.delegate.init(this.options);
    }

    return this.delegate;
  }

  async get(key) {
    return this.getDelegate().get(key);
  }

  async increment(key) {
    return this.getDelegate().increment(key);
  }

  async decrement(key) {
    return this.getDelegate().decrement(key);
  }

  async resetKey(key) {
    return this.getDelegate().resetKey(key);
  }
}

class ResilientRateLimitStore {
  constructor({
    primary,
    fallback = new MemoryStore(),
    namespace,
    loggerImpl = logger,
    logIntervalMs = 30000,
  }) {
    this.primary = primary;
    this.fallback = fallback;
    this.namespace = namespace;
    this.logger = loggerImpl;
    this.logIntervalMs = logIntervalMs;
    this.lastFallbackLogAt = 0;
    this.prefix = primary.prefix;
    this.localKeys = false;
  }

  init(options) {
    this.primary.init(options);
    this.fallback.init(options);
  }

  logFallback(error, operation) {
    const now = Date.now();
    if (now - this.lastFallbackLogAt < this.logIntervalMs) return;
    this.lastFallbackLogAt = now;
    this.logger.warn('rate_limit_local_fallback', {
      namespace: this.namespace,
      operation,
      error,
    });
  }

  async get(key) {
    try {
      const result = await this.primary.get(key);
      await this.fallback.resetKey(key);
      return result;
    } catch (error) {
      this.logFallback(error, 'get');
      return this.fallback.get(key);
    }
  }

  async increment(key) {
    try {
      const result = await this.primary.increment(key);
      await this.fallback.resetKey(key);
      return result;
    } catch (error) {
      this.logFallback(error, 'increment');
      return this.fallback.increment(key);
    }
  }

  async decrement(key) {
    try {
      await this.primary.decrement(key);
      await this.fallback.resetKey(key);
    } catch (error) {
      this.logFallback(error, 'decrement');
      await this.fallback.decrement(key);
    }
  }

  async resetKey(key) {
    const results = await Promise.allSettled([
      this.primary.resetKey(key),
      this.fallback.resetKey(key),
    ]);
    const primaryResult = results[0];
    if (primaryResult.status === 'rejected') {
      this.logFallback(primaryResult.reason, 'resetKey');
    }
  }

  async shutdown() {
    await Promise.allSettled([
      this.primary.shutdown?.(),
      this.fallback.shutdown?.(),
    ]);
  }
}

const createRateLimitStore = ({ namespace, config }) => {
  if (!config.redisEnabled) {
    return {
      distributed: false,
      passOnStoreError: true,
      store: undefined,
    };
  }

  const safeNamespace = sanitizeNamespace(namespace);
  const primary = new LazyRedisStore({
    prefix: `${config.redisKeyPrefix}:rate-limit:${safeNamespace}:`,
    operation: `rate_limit_${safeNamespace}`,
  });

  if (config.redisRequired) {
    return {
      distributed: true,
      passOnStoreError: false,
      store: primary,
    };
  }

  return {
    distributed: true,
    passOnStoreError: false,
    store: new ResilientRateLimitStore({
      primary,
      namespace: safeNamespace,
    }),
  };
};

module.exports = {
  LazyRedisStore,
  ResilientRateLimitStore,
  createRateLimitStore,
  sanitizeNamespace,
};
