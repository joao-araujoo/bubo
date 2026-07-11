const axios = require('axios');

const REQUEST_TIMEOUT_MS = 12000;

const normalizeImageUrl = (url) => String(url || '')
  .replace(/^http:\/\//i, 'https://')
  .replace(/([?&])zoom=1(?:&|$)/i, '$1zoom=2&')
  .replace(/&$/, '');

const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

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
  const isbn = getGoogleIsbn(info.industryIdentifiers);
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
  const isbn = doc.isbn?.find((value) => String(value).length === 13)
    || doc.isbn?.[0]
    || '';
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
  if (book.isbn) return `isbn:${book.isbn}`;
  return `title:${normalizeText(book.title)}|author:${normalizeText(book.author).split(' ').slice(0, 3).join(' ')}`;
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
    coverImage: firstNonEmpty(primary.coverImage, incoming.coverImage, ''),
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

const searchGoogleBooks = async (query, env = process.env) => {
  const apiKey = env.GOOGLE_BOOKS_API_KEY;
  const endpoint = 'https://www.googleapis.com/books/v1/volumes';
  const { data } = await axios.get(endpoint, {
    params: {
      q: query,
      maxResults: 30,
      printType: 'books',
      ...(apiKey ? { key: apiKey } : {}),
    },
    timeout: REQUEST_TIMEOUT_MS,
  });
  return (data.items || []).map(normalizeGoogleBook);
};

const searchOpenLibrary = async (query) => {
  const endpoint = 'https://openlibrary.org/search.json';
  const { data } = await axios.get(endpoint, {
    params: {
      q: query,
      limit: 30,
      fields: 'key,title,subtitle,author_name,cover_i,isbn,number_of_pages_median,first_publish_year,publisher,language,subject',
    },
    timeout: REQUEST_TIMEOUT_MS,
    headers: { 'User-Agent': 'Bubo/3.0 book-metadata-enrichment' },
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

  const books = [...mergedMap.values()]
    .sort((a, b) => {
      const confidenceRank = { high: 3, medium: 2, low: 1 };
      const byConfidence = confidenceRank[b.metadataConfidence] - confidenceRank[a.metadataConfidence];
      if (byConfidence) return byConfidence;
      const byPages = Number(Boolean(b.totalPages)) - Number(Boolean(a.totalPages));
      if (byPages) return byPages;
      return Number(Boolean(b.coverImage)) - Number(Boolean(a.coverImage));
    })
    .slice(0, 30);

  return {
    books,
    sourceStatus,
    partial: Object.values(sourceStatus).includes('unavailable'),
  };
};

module.exports = {
  confidenceFor,
  mergeBooks,
  normalizeGoogleBook,
  normalizeOpenLibraryBook,
  searchBookMetadata,
};
