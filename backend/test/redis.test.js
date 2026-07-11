const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const {
  createRedisManager,
  targetFromUrl,
} = require('../src/infrastructure/redis/redisManager');
const {
  LazyRedisStore,
  ResilientRateLimitStore,
  sanitizeNamespace,
} = require('../src/infrastructure/redis/rateLimitStore');

class FakeRedisClient extends EventEmitter {
  constructor({ failConnect = false, responses = {} } = {}) {
    super();
    this.failConnect = failConnect;
    this.responses = responses;
    this.isOpen = false;
    this.isReady = false;
    this.commands = [];
  }

  async connect() {
    if (this.failConnect) throw new Error('connection refused');
    this.isOpen = true;
    this.emit('connect');
    this.isReady = true;
    this.emit('ready');
  }

  async sendCommand(args) {
    this.commands.push(args);
    const command = args[0];
    if (command === 'PING') return 'PONG';
    if (command === 'GET') return this.responses[args[1]] ?? null;
    if (command === 'SET') {
      this.responses[args[1]] = args[2];
      return 'OK';
    }
    if (command === 'DEL') {
      delete this.responses[args[1]];
      return 1;
    }
    return 'OK';
  }

  async quit() {
    this.isReady = false;
    this.isOpen = false;
    this.emit('end');
  }
}

class FakeCounterStore {
  constructor({ fail = false } = {}) {
    this.fail = fail;
    this.values = new Map();
    this.windowMs = 60000;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async get(key) {
    if (this.fail) throw new Error('primary unavailable');
    return this.values.get(key);
  }

  async increment(key) {
    if (this.fail) throw new Error('primary unavailable');
    const current = this.values.get(key) || {
      totalHits: 0,
      resetTime: new Date(Date.now() + this.windowMs),
    };
    current.totalHits += 1;
    this.values.set(key, current);
    return current;
  }

  async decrement(key) {
    if (this.fail) throw new Error('primary unavailable');
    const current = this.values.get(key);
    if (current && current.totalHits > 0) current.totalHits -= 1;
  }

  async resetKey(key) {
    if (this.fail) throw new Error('primary unavailable');
    this.values.delete(key);
  }
}

const baseConfig = {
  redisEnabled: true,
  redisRequired: true,
  redisUrl: 'redis://reader:very-secret@cache.internal:6379/2',
  redisKeyPrefix: 'bubo:test',
  redisConnectTimeoutMs: 1000,
  redisCommandTimeoutMs: 1000,
  redisReconnectDelayMs: 1000,
};

test('redis target metadata never exposes credentials', () => {
  assert.deepEqual(targetFromUrl(baseConfig.redisUrl), {
    protocol: 'redis',
    host: 'cache.internal',
    port: 6379,
    database: 2,
  });
  assert.equal(targetFromUrl('https://cache.internal'), null);
  assert.equal(targetFromUrl('not-a-url'), null);
});

test('redis manager remains disabled without a configured url', async () => {
  const manager = createRedisManager();
  manager.configure({ redisEnabled: false, redisUrl: '' });
  const state = await manager.connect();

  assert.equal(state.enabled, false);
  assert.equal(state.ready, false);
  assert.equal(state.status, 'disabled');
});

test('invalid redis urls never create a client during module configuration', async () => {
  let clientCreations = 0;
  const manager = createRedisManager({
    createClientImpl: () => {
      clientCreations += 1;
      return new FakeRedisClient();
    },
    loggerImpl: { info() {}, warn() {} },
  });
  const configured = manager.configure({
    ...baseConfig,
    redisUrl: 'https://cache.internal',
  });

  assert.equal(configured.status, 'invalid');
  assert.equal(clientCreations, 0);
  await assert.rejects(() => manager.connect(), (error) => error.code === 'REDIS_UNAVAILABLE');
});

test('redis manager connects, namespaces JSON values and records commands', async () => {
  const client = new FakeRedisClient();
  const manager = createRedisManager({
    createClientImpl: () => client,
    loggerImpl: { info() {}, warn() {} },
  });
  manager.configure(baseConfig);

  const connected = await manager.connect();
  assert.equal(connected.ready, true);
  assert.equal(connected.status, 'ready');
  assert.equal(manager.key('book-search', 'abc'), 'bubo:test:book-search:abc');

  await manager.setJson('book-search', 'abc', { books: [{ title: 'Bubo' }] }, 5000);
  assert.deepEqual(await manager.getJson('book-search', 'abc'), {
    books: [{ title: 'Bubo' }],
  });
  await manager.deleteKey('book-search', 'abc');
  assert.equal(await manager.getJson('book-search', 'abc'), null);

  const state = manager.getState();
  assert.ok(state.commands >= 5);
  assert.equal(state.failures, 0);
  assert.equal(state.target.host, 'cache.internal');
  assert.equal(JSON.stringify(state).includes('very-secret'), false);

  await manager.disconnect();
  assert.equal(manager.getState().ready, false);
});

test('optional redis degrades without preventing startup and schedules recovery', async () => {
  const manager = createRedisManager({
    createClientImpl: () => new FakeRedisClient({ failConnect: true }),
    loggerImpl: { info() {}, warn() {} },
  });
  manager.configure({ ...baseConfig, redisRequired: false });

  const state = await manager.connect();
  assert.equal(state.ready, false);
  assert.equal(state.status, 'degraded');
  assert.equal(state.failures, 1);
  assert.ok(state.nextRetryAt);
  await manager.disconnect();
  assert.equal(manager.getState().nextRetryAt, null);
});

test('required redis prevents startup when it cannot connect', async () => {
  const manager = createRedisManager({
    createClientImpl: () => new FakeRedisClient({ failConnect: true }),
    loggerImpl: { info() {}, warn() {} },
  });
  manager.configure(baseConfig);

  await assert.rejects(() => manager.connect(), /connection refused/);
  assert.equal(manager.getState().required, true);
  assert.equal(manager.getState().ready, false);
});

test('lazy rate-limit store does not load scripts before redis is ready', async () => {
  let ready = false;
  let factoryCalls = 0;
  let initOptions;
  const delegate = {
    init(options) {
      initOptions = options;
    },
    async increment() {
      return { totalHits: 1, resetTime: new Date() };
    },
    async get() {
      return { totalHits: 1, resetTime: new Date() };
    },
    async decrement() {},
    async resetKey() {},
  };
  const store = new LazyRedisStore({
    prefix: 'bubo:test:rate-limit:api:',
    operation: 'rate_limit_api',
    getState: () => ({ ready }),
    sendCommand: async () => 'OK',
    storeFactory: () => {
      factoryCalls += 1;
      return delegate;
    },
  });
  store.init({ windowMs: 10000 });

  await assert.rejects(() => store.increment('client'), (error) => error.code === 'REDIS_UNAVAILABLE');
  assert.equal(factoryCalls, 0);

  ready = true;
  const incremented = await store.increment('client');
  assert.equal(incremented.totalHits, 1);
  assert.equal(factoryCalls, 1);
  assert.equal(initOptions.windowMs, 10000);

  await store.get('client');
  assert.equal(factoryCalls, 1, 'The same delegate must be reused after initialization');
});

test('optional rate-limit store counts locally during outage and returns to primary', async () => {
  const primary = new FakeCounterStore({ fail: true });
  const fallback = new FakeCounterStore();
  const warnings = [];
  const store = new ResilientRateLimitStore({
    primary,
    fallback,
    namespace: 'api',
    loggerImpl: { warn: (...args) => warnings.push(args) },
    logIntervalMs: 60000,
  });
  store.init({ windowMs: 10000 });

  const firstLocal = await store.increment('reader');
  const secondLocal = await store.increment('reader');
  assert.equal(firstLocal.totalHits, 1);
  assert.equal(secondLocal.totalHits, 2);
  assert.equal((await store.get('reader')).totalHits, 2);
  assert.equal(warnings.length, 1, 'Repeated failures should be log-rate-limited');

  primary.fail = false;
  const recovered = await store.increment('reader');
  assert.equal(recovered.totalHits, 1, 'Recovered primary starts its distributed counter');
  assert.equal(await fallback.get('reader'), undefined, 'Stale local counter is cleared after recovery');

  primary.fail = true;
  const newLocalWindow = await store.increment('reader');
  assert.equal(newLocalWindow.totalHits, 1, 'A later outage starts a fresh local fallback');
});

test('rate-limit namespaces are deterministic and bounded', () => {
  assert.equal(sanitizeNamespace('Book Search / Public'), 'book-search-public');
  assert.equal(sanitizeNamespace('---'), 'default');
  assert.equal(sanitizeNamespace('A'.repeat(80)).length, 48);
});
