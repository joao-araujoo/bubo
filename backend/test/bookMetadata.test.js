const test = require('node:test');
const assert = require('node:assert/strict');
const {
  confidenceFor,
  mergeBooks,
  normalizeGoogleBook,
  normalizeOpenLibraryBook,
  rankBooks,
  scoreBookRelevance,
} = require('../src/services/books/bookMetadata');

test('Google Books normalization prioritizes page count and high-resolution covers', () => {
  const book = normalizeGoogleBook({
    id: 'google-1',
    volumeInfo: {
      title: 'Duna',
      authors: ['Frank Herbert'],
      pageCount: 412,
      imageLinks: { thumbnail: 'http://example.com/cover?zoom=1' },
      industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780441172719' }],
    },
  });

  assert.equal(book.totalPages, 412);
  assert.equal(book.pagesSource, 'google_books');
  assert.match(book.coverImage, /^https:\/\//);
  assert.match(book.coverImage, /zoom=2/);
  assert.equal(book.canonicalId, 'isbn:9780441172719');
});

test('Open Library normalization uses edition median pages and large covers', () => {
  const book = normalizeOpenLibraryBook({
    key: '/works/OL123W',
    title: 'Dom Casmurro',
    author_name: ['Machado de Assis'],
    number_of_pages_median: 256,
    cover_i: 12345,
    isbn: ['9788535910663'],
  });

  assert.equal(book.totalPages, 256);
  assert.equal(book.pagesSource, 'open_library_median');
  assert.equal(book.openLibraryKey, 'OL123W');
  assert.match(book.coverImage, /-L\.jpg$/);
});

test('metadata merge fills missing pages without replacing a Google Books cover', () => {
  const primary = {
    title: 'Duna',
    author: 'Frank Herbert',
    coverImage: 'https://example.com/google.jpg',
    totalPages: 0,
    pagesSource: '',
    isbn: '9780441172719',
    metadataSources: ['google_books'],
    categories: [],
  };
  const incoming = {
    title: 'Duna',
    author: 'Frank Herbert',
    coverImage: 'https://example.com/open.jpg',
    totalPages: 412,
    pagesSource: 'open_library_median',
    isbn: '9780441172719',
    metadataSources: ['open_library'],
    categories: ['Ficção científica'],
  };

  const merged = mergeBooks(primary, incoming);
  assert.equal(merged.coverImage, primary.coverImage);
  assert.equal(merged.totalPages, 412);
  assert.equal(merged.pagesSource, 'open_library_median');
  assert.deepEqual(merged.metadataSources.sort(), ['google_books', 'open_library']);
});

test('confidence is high when core metadata and pages are present', () => {
  assert.equal(confidenceFor({
    isbn: '123',
    coverImage: 'https://example.com/cover.jpg',
    totalPages: 300,
    author: 'Autora',
    publisher: 'Editora',
  }), 'high');
});

test('exact title matches outrank technically complete but unrelated books', () => {
  const ranked = rankBooks([
    {
      title: 'Manual completo de literatura brasileira',
      author: 'Autora',
      coverImage: 'https://example.com/complete.jpg',
      totalPages: 600,
      isbn: '1111111111111',
      metadataSources: ['google_books'],
    },
    {
      title: 'Dom Casmurro',
      author: 'Machado de Assis',
      coverImage: '',
      totalPages: 0,
      isbn: '',
      metadataSources: ['open_library'],
    },
  ], 'Dom Casmurro');

  assert.equal(ranked[0].title, 'Dom Casmurro');
});

test('ISBN exact matches receive the strongest relevance score', () => {
  const exact = scoreBookRelevance({
    title: 'Duna',
    author: 'Frank Herbert',
    isbn: '9780441172719',
    metadataSources: ['open_library'],
  }, '978-0-441-17271-9');
  const other = scoreBookRelevance({
    title: 'Duna',
    author: 'Frank Herbert',
    isbn: '9780000000000',
    metadataSources: ['google_books'],
  }, '978-0-441-17271-9');

  assert.equal(exact, 1000);
  assert.ok(exact > other);
});
