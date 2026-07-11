const crypto = require('crypto');
const mongoose = require('mongoose');
const BookSearchCache = require('../../models/BookSearchCache');
const logger = require('../../utils/logger');

const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_MEMORY_TTL_MS = 15 * 60 * 1000;
const MAX_MEMORY_ENTRIES = 120;

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
  memoryCache.delete(key);
  memoryCache.set(key, {
    payload,
    expiresAt: Date.now() + ttlFromEnv('BOOK_SEARCH_MEMORY_CACHE_TTL_MS', DEFAULT_MEMORY_TTL_MS),
  });
  pruneMemory();
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
    return {
      books: cached.books || [],
      sourceStatus: cached.sourceStatus || {},
      partial: Boolean(cached.partial),
    };
  } catch (error) {
    logger.warn('book_search_cache_read_failed', { error });
    return null;
  }
};

const writeDatabase = async (key, query, payload) => {
  if (!canUseDatabase()) return;
  try {
    await BookSearchCache.findOneAndUpdate(
      { key },
      {
        $set: {
          query: String(query).trim(),
          books: payload.books || [],
          sourceStatus: payload.sourceStatus || {},
          partial: Boolean(payload.partial),
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
  if (memory) return { payload: memory, cache: 'memory' };

  const database = await readDatabase(key);
  if (database) {
    writeMemory(key, database);
    return { payload: database, cache: 'shared' };
  }

  return { payload: null, cache: 'miss' };
};

const setCachedBookSearch = async (query, payload) => {
  const key = cacheKeyFor(query);
  writeMemory(key, payload);
  await writeDatabase(key, query, payload);
};

const loadBookSearch = async (query, loader) => {
  const cached = await getCachedBookSearch(query);
  if (cached.payload) return cached;

  const key = cacheKeyFor(query);
  if (inFlight.has(key)) {
    const payload = await inFlight.get(key);
    return { payload, cache: 'coalesced' };
  }

  const request = Promise.resolve()
    .then(loader)
    .then(async (payload) => {
      await setCachedBookSearch(query, payload);
      return payload;
    })
    .finally(() => inFlight.delete(key));

  inFlight.set(key, request);
  const payload = await request;
  return { payload, cache: 'miss' };
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
  normalizeQuery,
  setCachedBookSearch,
};
