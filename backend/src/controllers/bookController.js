const Book = require('../models/Book');
const UserBook = require('../models/UserBook');
const SocialActivity = require('../models/SocialActivity');
const { searchBookMetadata } = require('../services/books/bookMetadata');

const normalizeImageUrl = (url) => String(url || '').replace(/^http:\/\//i, 'https://');

const pageSourceRank = {
  '': 0,
  open_library_median: 1,
  google_books: 2,
  manual: 3,
};

const buildLookup = (payload) => {
  const conditions = [];
  if (payload.canonicalId) conditions.push({ canonicalId: payload.canonicalId });
  if (payload.googleBooksId) conditions.push({ googleBooksId: payload.googleBooksId });
  if (payload.openLibraryKey) conditions.push({ openLibraryKey: payload.openLibraryKey });
  if (payload.isbn) conditions.push({ isbn: payload.isbn });
  if (payload.title && payload.author) conditions.push({ title: payload.title, author: payload.author });
  return conditions;
};

const buildBookFields = (payload) => ({
  ...(payload.canonicalId ? { canonicalId: String(payload.canonicalId) } : {}),
  ...(payload.googleBooksId ? { googleBooksId: String(payload.googleBooksId) } : {}),
  ...(payload.openLibraryKey ? { openLibraryKey: String(payload.openLibraryKey) } : {}),
  title: String(payload.title || '').trim(),
  subtitle: String(payload.subtitle || '').trim(),
  author: String(payload.author || 'Autor não informado').trim(),
  coverImage: normalizeImageUrl(payload.coverImage),
  totalPages: Math.max(0, Number(payload.totalPages) || 0),
  pagesSource: String(payload.pagesSource || ''),
  metadataConfidence: ['low', 'medium', 'high'].includes(payload.metadataConfidence)
    ? payload.metadataConfidence
    : 'low',
  metadataSources: [...new Set((payload.metadataSources || []).filter((source) => ['google_books', 'open_library', 'manual'].includes(source)))],
  description: String(payload.description || ''),
  isbn: String(payload.isbn || ''),
  publisher: String(payload.publisher || ''),
  publishedDate: String(payload.publishedDate || ''),
  language: String(payload.language || ''),
  categories: Array.isArray(payload.categories) ? payload.categories.slice(0, 8).map(String) : [],
  previewLink: String(payload.previewLink || ''),
});

const enrichExistingBook = async (book, incoming) => {
  const updates = {};
  const existingRank = pageSourceRank[book.pagesSource || ''] || 0;
  const incomingRank = pageSourceRank[incoming.pagesSource || ''] || 0;

  if ((!book.coverImage || book.coverImage.includes('placeholder')) && incoming.coverImage) {
    updates.coverImage = incoming.coverImage;
  }
  if ((!book.totalPages && incoming.totalPages) || (incoming.totalPages && incomingRank > existingRank)) {
    updates.totalPages = incoming.totalPages;
    updates.pagesSource = incoming.pagesSource;
  }

  ['subtitle', 'description', 'isbn', 'publisher', 'publishedDate', 'language', 'previewLink', 'googleBooksId', 'openLibraryKey', 'canonicalId'].forEach((field) => {
    if (!book[field] && incoming[field]) updates[field] = incoming[field];
  });

  if ((!book.categories || book.categories.length === 0) && incoming.categories?.length) {
    updates.categories = incoming.categories;
  }

  const mergedSources = [...new Set([...(book.metadataSources || []), ...(incoming.metadataSources || [])])];
  if (mergedSources.length !== (book.metadataSources || []).length) updates.metadataSources = mergedSources;

  const confidenceRank = { low: 1, medium: 2, high: 3 };
  if ((confidenceRank[incoming.metadataConfidence] || 0) > (confidenceRank[book.metadataConfidence] || 0)) {
    updates.metadataConfidence = incoming.metadataConfidence;
  }

  if (Object.keys(updates).length === 0) return book;
  return Book.findByIdAndUpdate(book._id, { $set: updates }, { new: true, runValidators: true });
};

exports.searchBooks = async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ message: 'Informe um título, autor ou ISBN para buscar.', code: 'BOOK_QUERY_REQUIRED' });

  try {
    const result = await searchBookMetadata(q);
    res.json({
      books: result.books,
      meta: {
        query: q,
        sourceStatus: result.sourceStatus,
        partial: result.partial,
      },
    });
  } catch (err) {
    if (err.code === 'BOOK_SOURCES_UNAVAILABLE') {
      return res.status(503).json({
        message: err.message,
        code: err.code,
        sourceStatus: err.sourceStatus,
      });
    }
    res.status(502).json({
      message: 'Não foi possível consultar o catálogo agora. Tente novamente em alguns instantes.',
      code: 'BOOK_SEARCH_FAILED',
    });
  }
};

exports.addToLibrary = async (req, res) => {
  const payload = req.body || {};
  const status = payload.status || 'to-read';
  const hasIdentifier = payload.canonicalId || payload.googleBooksId || payload.openLibraryKey || payload.isbn;

  if (!hasIdentifier || !payload.title) {
    return res.status(400).json({
      message: 'O livro precisa ter um identificador de catálogo e um título.',
      code: 'BOOK_METADATA_INCOMPLETE',
    });
  }

  try {
    const incoming = buildBookFields(payload);
    const lookup = buildLookup(incoming);
    let book = lookup.length ? await Book.findOne({ $or: lookup }) : null;

    if (!book) {
      book = await Book.create(incoming);
    } else {
      book = await enrichExistingBook(book, incoming);
    }

    const existing = await UserBook.findOne({ userId: req.user._id, bookId: book._id });
    if (existing) {
      return res.status(409).json({
        message: 'Este livro já está no seu acervo.',
        code: 'BOOK_ALREADY_IN_LIBRARY',
      });
    }

    const userBook = await UserBook.create({
      userId: req.user._id,
      bookId: book._id,
      status,
    });

    await SocialActivity.create({
      userId: req.user._id,
      type: 'book_added',
      bookId: book._id,
      message: `Adicionou “${book.title}” ao acervo.`,
    });

    const populated = await UserBook.findById(userBook._id).populate('bookId');
    res.status(201).json({ userBook: populated });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        message: 'Este livro já existe no catálogo. Atualize a busca e tente adicioná-lo novamente.',
        code: 'BOOK_CATALOG_CONFLICT',
      });
    }
    res.status(500).json({
      message: 'Não foi possível adicionar o livro. Seus outros dados não foram alterados.',
      code: 'BOOK_ADD_FAILED',
    });
  }
};

exports.getUserLibrary = async (req, res) => {
  try {
    const userBooks = await UserBook.find({ userId: req.user._id })
      .populate('bookId')
      .sort({ updatedAt: -1 });
    res.json({ userBooks });
  } catch (err) {
    res.status(500).json({
      message: 'Não foi possível carregar seu acervo. Tente novamente sem recarregar a página.',
      code: 'LIBRARY_LOAD_FAILED',
    });
  }
};

exports.updateBookStatus = async (req, res) => {
  const { id } = req.params;
  const { status, currentPage } = req.body;

  try {
    const existing = await UserBook.findOne({ _id: id, userId: req.user._id }).populate('bookId');
    if (!existing) return res.status(404).json({ message: 'Livro não encontrado no seu acervo.', code: 'USER_BOOK_NOT_FOUND' });

    const updates = { updatedAt: Date.now() };
    if (status !== undefined) updates.status = status;
    if (currentPage !== undefined) {
      const totalPages = Number(existing.bookId?.totalPages) || 0;
      const normalizedPage = Math.max(0, Number(currentPage) || 0);
      updates.currentPage = totalPages > 0 ? Math.min(normalizedPage, totalPages) : normalizedPage;
    }
    if (status === 'read' && currentPage === undefined && existing.bookId?.totalPages) {
      updates.currentPage = existing.bookId.totalPages;
    }

    const userBook = await UserBook.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { $set: updates },
      { new: true, runValidators: true },
    ).populate('bookId');

    if (status === 'read' && existing.status !== 'read') {
      await SocialActivity.create({
        userId: req.user._id,
        type: 'book_completed',
        bookId: userBook.bookId?._id,
        pages: Number(userBook.bookId?.totalPages) || Number(userBook.currentPage) || 0,
        message: `Concluiu a leitura de “${userBook.bookId?.title || 'um livro'}”.`,
      });
    }

    res.json({ userBook });
  } catch (err) {
    res.status(500).json({
      message: 'Não foi possível atualizar este livro. O estado anterior foi preservado.',
      code: 'USER_BOOK_UPDATE_FAILED',
    });
  }
};
