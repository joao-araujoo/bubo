const axios = require('axios');

const REQUEST_TIMEOUT_MS = 9000;
const MAX_RESULTS_PER_SOURCE = 24;
const MAX_FINAL_RESULTS = 24;

const normalizeImageUrl = (url) => String(url || '')
  .replace(/^http:\/\//i, 'https://')
  .replace(/([?&])zoom=1(?=&|$)/i, '$1zoom=2')
  .replace(/([?&])edge=curl(?=&|$)/i, '$1edge=none');

const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const normalizeIsbn = (value) => String(value || '').replace(/[^0-9Xx]/g, '').toUpperCase();

const isIsbnQuery = (query) => {
  const normalized = normalizeIsbn(query);
  return normalized.length === 10 || normalized.length === 13;
};

const firstNonEmpty = (...values) => values.find((value) => {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== '';
});

const getGoogleCover = (imageLinks = {}) => normalizeImageUrl(
  imageLinks.extraLarge
  || imageLinks.large
  || imageLinks.medium
  || imageLinks.small
  || imageLinks.thumbnail
  || imageLinks.smallThumbnail,
);

const getGoogleIsbn = (identifiers = []) => identifiers.find((item) => item.type === 'ISBN_13')?.identifier
  || identifiers.find((item) => item.type === 'ISBN_10')?.identifier
  || identifiers[0]?.identifier
  || '';

const normalizeGoogleBook = (item) => {
  const info = item.volumeInfo || {};
  const isbn = normalizeIsbn(getGoogleIsbn(info.industryIdentifiers));
  const totalPages = Number(info.pageCount) || 0;

  return {
    canonicalId: isbn ? `isbn:${isbn}` : `google:${item.id}`,
    googleBooksId: item.id,
    openLibraryKey: '',
    title: info.title || 'Título não informado',
    subtitle: info.subtitle || '',
    author: (info.authors || ['Autor não informado']).join(', '),
    coverImage: getGoogleCover(info.imageLinks),
    totalPages,
    pagesSource: totalPages ? 'google_books' : '',
    description: info.description || '',
    isbn,
    publisher: info.publisher || '',
    publishedDate: info.publishedDate || '',
    language: info.language || '',
    categories: (info.categories || []).slice(0, 8),
    previewLink: info.previewLink || '',
    metadataSources: ['google_books'],
  };
};

const normalizeOpenLibraryBook = (doc) => {
  const isbn = normalizeIsbn(
    doc.isbn?.find((value) => normalizeIsbn(value).length === 13)
    || doc.isbn?.[0]
    || '',
  );
  const totalPages = Number(doc.number_of_pages_median) || 0;
  const openLibraryKey = String(doc.key || '').replace(/^\/works\//, '');

  return {
    canonicalId: isbn ? `isbn:${isbn}` : `openlibrary:${openLibraryKey}`,
    googleBooksId: '',
    openLibraryKey,
    title: doc.title || 'Título não informado',
    subtitle: doc.subtitle || '',
    author: (doc.author_name || ['Autor não informado']).slice(0, 4).join(', '),
    coverImage: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : '',
    totalPages,
    pagesSource: totalPages ? 'open_library_median' : '',
    description: '',
    isbn,
    publisher: doc.publisher?.[0] || '',
    publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : '',
    language: doc.language?.[0] || '',
    categories: (doc.subject || []).slice(0, 8),
    previewLink: openLibraryKey ? `https://openlibrary.org/works/${openLibraryKey}` : '',
    metadataSources: ['open_library'],
  };
};

const mergeKey = (book) => {
  const title = normalizeText(book.title);
  const author = normalizeText(book.author).split(' ').slice(0, 4).join(' ');
  if (title && author && author !== 'autor nao informado') return `work:${title}|${author}`;
  if (book.isbn) return `isbn:${normalizeIsbn(book.isbn)}`;
  return `catalog:${book.googleBooksId || book.openLibraryKey || title}`;
};

const confidenceFor = (book) => {
  const signals = [
    Boolean(book.isbn),
    Boolean(book.coverImage),
    Number(book.totalPages) > 0,
    Boolean(book.author && book.author !== 'Autor não informado'),
    Boolean(book.publisher || book.publishedDate),
  ].filter(Boolean).length;
  if (signals >= 4 && book.totalPages > 0) return 'high';
  if (signals >= 2) return 'medium';
  return 'low';
};

const sourceRank = (book) => {
  if (book.metadataSources?.includes('google_books')) return 3;
  if (book.metadataSources?.includes('open_library')) return 2;
  return 1;
};

const shouldUseIncomingCover = (primary, incoming) => {
  if (!incoming.coverImage) return false;
  if (!primary.coverImage) return true;
  return sourceRank(incoming) > sourceRank(primary);
};

const mergeBooks = (primary, incoming) => {
  const primaryPages = Number(primary.totalPages) || 0;
  const incomingPages = Number(incoming.totalPages) || 0;
  const useIncomingPages = !primaryPages && incomingPages > 0;

  const merged = {
    ...primary,
    canonicalId: firstNonEmpty(primary.canonicalId, incoming.canonicalId),
    googleBooksId: firstNonEmpty(primary.googleBooksId, incoming.googleBooksId, ''),
    openLibraryKey: firstNonEmpty(primary.openLibraryKey, incoming.openLibraryKey, ''),
    title: firstNonEmpty(primary.title, incoming.title, 'Título não informado'),
    subtitle: firstNonEmpty(primary.subtitle, incoming.subtitle, ''),
    author: firstNonEmpty(primary.author, incoming.author, 'Autor não informado'),
    coverImage: shouldUseIncomingCover(primary, incoming) ? incoming.coverImage : firstNonEmpty(primary.coverImage, incoming.coverImage, ''),
    totalPages: useIncomingPages ? incomingPages : primaryPages,
    pagesSource: useIncomingPages ? incoming.pagesSource : primary.pagesSource,
    description: firstNonEmpty(primary.description, incoming.description, ''),
    isbn: firstNonEmpty(primary.isbn, incoming.isbn, ''),
    publisher: firstNonEmpty(primary.publisher, incoming.publisher, ''),
    publishedDate: firstNonEmpty(primary.publishedDate, incoming.publishedDate, ''),
    language: firstNonEmpty(primary.language, incoming.language, ''),
    categories: [...new Set([...(primary.categories || []), ...(incoming.categories || [])])].slice(0, 8),
    previewLink: firstNonEmpty(primary.previewLink, incoming.previewLink, ''),
    metadataSources: [...new Set([...(primary.metadataSources || []), ...(incoming.metadataSources || [])])],
  };

  merged.metadataConfidence = confidenceFor(merged);
  return merged;
};

const scoreBookRelevance = (book, query) => {
  const normalizedQuery = normalizeText(query);
  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  const title = normalizeText(book.title);
  const subtitle = normalizeText(book.subtitle);
  const author = normalizeText(book.author);
  const searchable = `${title} ${subtitle} ${author}`;
  const isbnQuery = normalizeIsbn(query);

  if (isIsbnQuery(query) && normalizeIsbn(book.isbn) === isbnQuery) return 1000;

  let score = 0;
  if (title === normalizedQuery) score += 220;
  else if (title.startsWith(normalizedQuery)) score += 150;
  else if (title.includes(normalizedQuery)) score += 100;

  const matchedTitleTokens = queryTokens.filter((token) => title.includes(token)).length;
  const matchedAllTokens = queryTokens.filter((token) => searchable.includes(token)).length;
  score += matchedTitleTokens * 24;
  score += matchedAllTokens * 8;
  if (queryTokens.length > 0 && matchedTitleTokens === queryTokens.length) score += 70;
  if (queryTokens.length > 0 && matchedAllTokens === queryTokens.length) score += 25;

  if (book.metadataSources?.includes('google_books')) score += 18;
  if (book.coverImage) score += 12;
  if (book.totalPages) score += 6;
  if (book.isbn) score += 4;
  if (book.language === 'pt') score += 5;
  if (!book.title || book.title === 'Título não informado') score -= 200;
  if (!book.author || book.author === 'Autor não informado') score -= 8;

  return score;
};

const rankBooks = (books, query) => books
  .filter((book) => book.title && book.title !== 'Título não informado')
  .map((book) => ({ book, score: scoreBookRelevance(book, query) }))
  .filter(({ score }) => score > 0 || isIsbnQuery(query))
  .sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const bySource = sourceRank(b.book) - sourceRank(a.book);
    if (bySource) return bySource;
    const byCover = Number(Boolean(b.book.coverImage)) - Number(Boolean(a.book.coverImage));
    if (byCover) return byCover;
    return Number(Boolean(b.book.totalPages)) - Number(Boolean(a.book.totalPages));
  })
  .map(({ book }) => book)
  .slice(0, MAX_FINAL_RESULTS);

const requestGoogleBooks = async (query, apiKey) => {
  const endpoint = 'https://www.googleapis.com/books/v1/volumes';
  const q = isIsbnQuery(query) ? `isbn:${normalizeIsbn(query)}` : query;
  const { data } = await axios.get(endpoint, {
    params: {
      q,
      maxResults: MAX_RESULTS_PER_SOURCE,
      printType: 'books',
      orderBy: 'relevance',
      ...(apiKey ? { key: apiKey } : {}),
    },
    timeout: REQUEST_TIMEOUT_MS,
    headers: { Accept: 'application/json' },
  });
  return (data.items || []).map(normalizeGoogleBook);
};

const searchGoogleBooks = async (query, env = process.env) => {
  const apiKey = String(env.GOOGLE_BOOKS_API_KEY || '').trim();
  try {
    return await requestGoogleBooks(query, apiKey);
  } catch (error) {
    const status = error.response?.status;
    if (apiKey && [400, 401, 403, 429].includes(status)) {
      return requestGoogleBooks(query, '');
    }
    throw error;
  }
};

const searchOpenLibrary = async (query) => {
  const endpoint = 'https://openlibrary.org/search.json';
  const params = isIsbnQuery(query)
    ? { isbn: normalizeIsbn(query) }
    : { q: query };

  const { data } = await axios.get(endpoint, {
    params: {
      ...params,
      limit: MAX_RESULTS_PER_SOURCE,
      fields: 'key,title,subtitle,author_name,cover_i,isbn,number_of_pages_median,first_publish_year,publisher,language,subject',
    },
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Bubo/3.1 book-discovery support@bubo.app',
    },
  });
  return (data.docs || []).map(normalizeOpenLibraryBook);
};

const searchBookMetadata = async (query, env = process.env) => {
  const [googleResult, openLibraryResult] = await Promise.allSettled([
    searchGoogleBooks(query, env),
    searchOpenLibrary(query),
  ]);

  const sourceStatus = {
    google_books: googleResult.status === 'fulfilled' ? 'available' : 'unavailable',
    open_library: openLibraryResult.status === 'fulfilled' ? 'available' : 'unavailable',
  };

  if (googleResult.status === 'rejected' && openLibraryResult.status === 'rejected') {
    const error = new Error('As fontes de livros estão temporariamente indisponíveis. Tente novamente em alguns instantes.');
    error.code = 'BOOK_SOURCES_UNAVAILABLE';
    error.sourceStatus = sourceStatus;
    throw error;
  }

  const ordered = [
    ...(googleResult.status === 'fulfilled' ? googleResult.value : []),
    ...(openLibraryResult.status === 'fulfilled' ? openLibraryResult.value : []),
  ];
  const mergedMap = new Map();

  ordered.forEach((book) => {
    const key = mergeKey(book);
    const current = mergedMap.get(key);
    mergedMap.set(key, current ? mergeBooks(current, book) : { ...book, metadataConfidence: confidenceFor(book) });
  });

  return {
    books: rankBooks([...mergedMap.values()], query),
    sourceStatus,
    partial: Object.values(sourceStatus).includes('unavailable'),
  };
};

module.exports = {
  confidenceFor,
  isIsbnQuery,
  mergeBooks,
  normalizeGoogleBook,
  normalizeOpenLibraryBook,
  rankBooks,
  scoreBookRelevance,
  searchBookMetadata,
};
