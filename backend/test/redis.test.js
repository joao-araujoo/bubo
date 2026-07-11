const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const {
  createRedisManager,
  targetFromUrl,
} = require('../src/infrastructure/redis/redisManager');
const {
  LazyRedisStore,
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

const baseConfig = {
  redisEnabled: true,
  redisRequired: true,
  redisUrl: 'redis://reader:very-secret@cache.internal:6379/2',
  redisKeyPrefix: 'bubo:test',
  redisConnectTimeoutMs: 1000,
  redisCommandTimeoutMs: 1000,
};

test('redis target metadata never exposes credentials', () => {
  assert.deepEqual(targetFromUrl(baseConfig.redisUrl), {
    protocol: 'redis',
    host: 'cache.internal',
    port: 6379,
    database: 2,
  });
});

test('redis manager remains disabled without a configured url', async () => {
  const manager = createRedisManager();
  manager.configure({ redisEnabled: false, redisUrl: '' });
  const state = await manager.connect();

  assert.equal(state.enabled, false);
  assert.equal(state.ready, false);
  assert.equal(state.status, 'disabled');
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

  await manager.disconnect();
  assert.equal(manager.getState().ready, false);
});

test('optional redis degrades without preventing startup', async () => {
  const manager = createRedisManager({
    createClientImpl: () => new FakeRedisClient({ failConnect: true }),
    loggerImpl: { info() {}, warn() {} },
  });
  manager.configure({ ...baseConfig, redisRequired: false });

  const state = await manager.connect();
  assert.equal(state.ready, false);
  assert.equal(state.status, 'degraded');
  assert.equal(state.failures, 1);
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

test('rate-limit namespaces are deterministic and bounded', () => {
  assert.equal(sanitizeNamespace('Book Search / Public'), 'book-search-public');
  assert.equal(sanitizeNamespace('---'), 'default');
  assert.equal(sanitizeNamespace('A'.repeat(80)).length, 48);
});
