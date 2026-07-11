const crypto = require('crypto');
const mongoose = require('mongoose');
const BookSearchCache = require('../../models/BookSearchCache');
const {
  getRedisJson,
  getRedisState,
  setRedisJson,
} = require('../../infrastructure/redis/redisManager');
const logger = require('../../utils/logger');

const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_MEMORY_TTL_MS = 15 * 60 * 1000;
const DEFAULT_REDIS_TTL_MS = 60 * 60 * 1000;
const MAX_MEMORY_ENTRIES = 120;
const REDIS_SCOPE = 'book-search';

const memoryCache = new Map();
const inFlight = new Map();

const normalizeQuery = (query) => String(query || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, ' ');

const cacheKeyFor = (query) => crypto
  .createHash('sha256')
  .update(normalizeQuery(query))
  .digest('hex');

const ttlFromEnv = (name, fallback) => {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizePayload = (payload) => {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.books)) return null;
  return {
    books: payload.books,
    sourceStatus: payload.sourceStatus && typeof payload.sourceStatus === 'object'
      ? payload.sourceStatus
      : {},
    partial: Boolean(payload.partial),
  };
};

const invalidPayloadError = () => {
  const error = new Error('Book search returned an invalid cache payload');
  error.code = 'BOOK_SEARCH_INVALID_PAYLOAD';
  return error;
};

const pruneMemory = () => {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt <= now) memoryCache.delete(key);
  }

  while (memoryCache.size > MAX_MEMORY_ENTRIES) {
    const oldestKey = memoryCache.keys().next().value;
    memoryCache.delete(oldestKey);
  }
};

const readMemory = (key) => {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }

  memoryCache.delete(key);
  memoryCache.set(key, entry);
  return entry.payload;
};

const writeMemory = (key, payload) => {
  if (!payload) return;
  memoryCache.delete(key);
  memoryCache.set(key, {
    payload,
    expiresAt: Date.now() + ttlFromEnv('BOOK_SEARCH_MEMORY_CACHE_TTL_MS', DEFAULT_MEMORY_TTL_MS),
  });
  pruneMemory();
};

const readRedis = async (key) => {
  if (!getRedisState().ready) return null;
  try {
    return normalizePayload(await getRedisJson(REDIS_SCOPE, key));
  } catch (error) {
    logger.warn('book_search_redis_cache_read_failed', { error });
    return null;
  }
};

const writeRedis = async (key, payload) => {
  if (!payload || !getRedisState().ready) return;
  try {
    await setRedisJson(
      REDIS_SCOPE,
      key,
      payload,
      ttlFromEnv('REDIS_CACHE_TTL_MS', DEFAULT_REDIS_TTL_MS),
    );
  } catch (error) {
    logger.warn('book_search_redis_cache_write_failed', { error });
  }
};

const canUseDatabase = () => mongoose.connection.readyState === 1;

const readDatabase = async (key) => {
  if (!canUseDatabase()) return null;
  try {
    const cached = await BookSearchCache.findOne({
      key,
      expiresAt: { $gt: new Date() },
    }).lean();

    if (!cached) return null;
    return normalizePayload(cached);
  } catch (error) {
    logger.warn('book_search_cache_read_failed', { error });
    return null;
  }
};

const writeDatabase = async (key, query, payload) => {
  if (!payload || !canUseDatabase()) return;
  try {
    await BookSearchCache.findOneAndUpdate(
      { key },
      {
        $set: {
          query: String(query).trim(),
          books: payload.books,
          sourceStatus: payload.sourceStatus,
          partial: payload.partial,
          expiresAt: new Date(Date.now() + ttlFromEnv('BOOK_SEARCH_CACHE_TTL_MS', DEFAULT_TTL_MS)),
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    logger.warn('book_search_cache_write_failed', { error });
  }
};

const getCachedBookSearch = async (query) => {
  const key = cacheKeyFor(query);
  const memory = readMemory(key);
  if (memory) return { payload: memory, cache: 'memory', layer: 'memory' };

  const redis = await readRedis(key);
  if (redis) {
    writeMemory(key, redis);
    return { payload: redis, cache: 'shared', layer: 'redis' };
  }

  const database = await readDatabase(key);
  if (database) {
    writeMemory(key, database);
    await writeRedis(key, database);
    return { payload: database, cache: 'shared', layer: 'database' };
  }

  return { payload: null, cache: 'miss', layer: 'none' };
};

const setCachedBookSearch = async (query, payload) => {
  const normalized = normalizePayload(payload);
  if (!normalized) throw invalidPayloadError();

  const key = cacheKeyFor(query);
  writeMemory(key, normalized);
  await Promise.all([
    writeRedis(key, normalized),
    writeDatabase(key, query, normalized),
  ]);
  return normalized;
};

const loadBookSearch = async (query, loader) => {
  const cached = await getCachedBookSearch(query);
  if (cached.payload) return cached;

  const key = cacheKeyFor(query);
  if (inFlight.has(key)) {
    const payload = await inFlight.get(key);
    return { payload, cache: 'coalesced', layer: 'memory' };
  }

  const request = Promise.resolve()
    .then(loader)
    .then((payload) => setCachedBookSearch(query, payload))
    .finally(() => inFlight.delete(key));

  inFlight.set(key, request);
  const payload = await request;
  return { payload, cache: 'miss', layer: 'source' };
};

const clearMemoryBookSearchCache = () => {
  memoryCache.clear();
  inFlight.clear();
};

module.exports = {
  cacheKeyFor,
  clearMemoryBookSearchCache,
  getCachedBookSearch,
  loadBookSearch,
  normalizePayload,
  normalizeQuery,
  setCachedBookSearch,
};
