const { RedisStore } = require('rate-limit-redis');
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
};

const createRateLimitStore = ({ namespace, config }) => {
  if (!config.redisEnabled) {
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
    store: new LazyRedisStore({
      prefix: `${config.redisKeyPrefix}:rate-limit:${safeNamespace}:`,
      operation: `rate_limit_${safeNamespace}`,
    }),
  };
};

module.exports = {
  LazyRedisStore,
  createRateLimitStore,
  sanitizeNamespace,
};
