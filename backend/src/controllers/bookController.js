const axios = require('axios');
const Book = require('../models/Book');
const UserBook = require('../models/UserBook');
const SocialActivity = require('../models/SocialActivity');

const normalizeImageUrl = (url) => String(url || '').replace(/^http:\/\//i, 'https://');

exports.searchBooks = async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ message: 'Query is required' });

  try {
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=20${apiKey ? `&key=${apiKey}` : ''}`;
    const response = await axios.get(url, { timeout: 10000 });
    const items = response.data.items || [];

    const books = items.map((item) => {
      const info = item.volumeInfo || {};
      return {
        googleBooksId: item.id,
        title: info.title || 'Título não informado',
        author: (info.authors || ['Autor não informado']).join(', '),
        coverImage: normalizeImageUrl(info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || ''),
        totalPages: Number(info.pageCount) || 0,
        description: info.description || '',
        isbn: info.industryIdentifiers?.find((identifier) => identifier.type === 'ISBN_13')?.identifier
          || info.industryIdentifiers?.[0]?.identifier
          || ''
      };
    });

    res.json({ books });
  } catch (err) {
    res.status(502).json({ message: 'Failed to search books', error: err.message });
  }
};

exports.addToLibrary = async (req, res) => {
  const { googleBooksId, title, author, coverImage, totalPages, description, isbn, status } = req.body;

  if (!googleBooksId || !title) {
    return res.status(400).json({ message: 'Book identifier and title are required' });
  }

  try {
    let book = await Book.findOne({ googleBooksId });
    if (!book) {
      book = new Book({
        googleBooksId,
        title,
        author: author || 'Autor não informado',
        coverImage: normalizeImageUrl(coverImage),
        totalPages: Number(totalPages) || 0,
        description: description || '',
        isbn: isbn || ''
      });
      await book.save();
    }

    const existing = await UserBook.findOne({ userId: req.user._id, bookId: book._id });
    if (existing) return res.status(400).json({ message: 'Book already in library' });

    const userBook = new UserBook({
      userId: req.user._id,
      bookId: book._id,
      status: status || 'to-read'
    });
    await userBook.save();

    await SocialActivity.create({
      userId: req.user._id,
      type: 'book_added',
      bookId: book._id,
      message: `Adicionou “${book.title}” ao acervo.`
    });

    const populated = await UserBook.findById(userBook._id).populate('bookId');
    res.status(201).json({ userBook: populated });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add book', error: err.message });
  }
};

exports.getUserLibrary = async (req, res) => {
  try {
    const userBooks = await UserBook.find({ userId: req.user._id })
      .populate('bookId')
      .sort({ updatedAt: -1 });
    res.json({ userBooks });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get library', error: err.message });
  }
};

exports.updateBookStatus = async (req, res) => {
  const { id } = req.params;
  const { status, currentPage } = req.body;

  try {
    const existing = await UserBook.findOne({ _id: id, userId: req.user._id }).populate('bookId');
    if (!existing) return res.status(404).json({ message: 'UserBook not found' });

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
      { new: true, runValidators: true }
    ).populate('bookId');

    if (status === 'read' && existing.status !== 'read') {
      await SocialActivity.create({
        userId: req.user._id,
        type: 'book_completed',
        bookId: userBook.bookId?._id,
        pages: Number(userBook.bookId?.totalPages) || Number(userBook.currentPage) || 0,
        message: `Concluiu a leitura de “${userBook.bookId?.title || 'um livro'}”.`
      });
    }

    res.json({ userBook });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update book', error: err.message });
  }
};
