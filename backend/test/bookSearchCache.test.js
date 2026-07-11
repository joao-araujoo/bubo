const test = require('node:test');
const assert = require('node:assert/strict');
const {
  cacheKeyFor,
  clearMemoryBookSearchCache,
  loadBookSearch,
  normalizePayload,
  normalizeQuery,
} = require('../src/services/books/bookSearchCache');

test('book search cache normalizes equivalent queries to the same key', () => {
  assert.equal(normalizeQuery('  Dom   Casmurro  '), 'dom casmurro');
  assert.equal(cacheKeyFor('Dom Casmurro'), cacheKeyFor(' dom   casmurro '));
});

test('book search payload normalization requires a books array', () => {
  assert.equal(normalizePayload(null), null);
  assert.equal(normalizePayload({ sourceStatus: {} }), null);
  assert.deepEqual(normalizePayload({ books: [], partial: 1 }), {
    books: [],
    sourceStatus: {},
    partial: true,
  });
});

test('simultaneous identical searches are coalesced and then served from memory', async () => {
  clearMemoryBookSearchCache();
  let calls = 0;
  const loader = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 15));
    return {
      books: [{ title: 'Duna' }],
      sourceStatus: { google_books: 'available', open_library: 'available' },
      partial: false,
    };
  };

  const [first, second] = await Promise.all([
    loadBookSearch('Duna', loader),
    loadBookSearch('Duna', loader),
  ]);

  assert.equal(calls, 1);
  assert.equal(first.payload.books[0].title, 'Duna');
  assert.equal(second.payload.books[0].title, 'Duna');
  assert.ok(['miss', 'coalesced'].includes(first.cache));
  assert.ok(['miss', 'coalesced'].includes(second.cache));

  const third = await loadBookSearch('Duna', loader);
  assert.equal(calls, 1);
  assert.equal(third.cache, 'memory');
});

test('invalid loader payloads are rejected and never cached', async () => {
  clearMemoryBookSearchCache();
  let calls = 0;
  const loader = async () => {
    calls += 1;
    return null;
  };

  await assert.rejects(
    () => loadBookSearch('Resultado inválido', loader),
    (error) => error.code === 'BOOK_SEARCH_INVALID_PAYLOAD',
  );
  await assert.rejects(
    () => loadBookSearch('Resultado inválido', loader),
    (error) => error.code === 'BOOK_SEARCH_INVALID_PAYLOAD',
  );
  assert.equal(calls, 2, 'Invalid payloads must not populate memory cache');
});
