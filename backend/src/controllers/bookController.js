const axios = require('axios');
const Book = require('../models/Book');
const UserBook = require('../models/UserBook');
const SocialActivity = require('../models/SocialActivity');

exports.searchBooks = async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ message: 'Query is required' });

  try {
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=10${apiKey ? `&key=${apiKey}` : ''}`;
    const response = await axios.get(url);
    const items = response.data.items || [];

    const books = items.map((item) => {
      const info = item.volumeInfo || {};
      return {
        googleBooksId: item.id,
        title: info.title || 'Unknown Title',
        author: (info.authors || ['Unknown Author']).join(', '),
        coverImage: info.imageLinks ? (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail || '') : '',
        totalPages: info.pageCount || 0,
        description: info.description || '',
        isbn: info.industryIdentifiers ? (info.industryIdentifiers[0]?.identifier || '') : ''
      };
    });

    res.json({ books });
  } catch (err) {
    res.status(500).json({ message: 'Failed to search books', error: err.message });
  }
};

exports.addToLibrary = async (req, res) => {
  const { googleBooksId, title, author, coverImage, totalPages, description, isbn, status } = req.body;
  try {
    let book = await Book.findOne({ googleBooksId });
    if (!book) {
      book = new Book({ googleBooksId, title, author, coverImage, totalPages, description, isbn });
      await book.save();
    }

    const existing = await UserBook.findOne({ userId: req.user._id, bookId: book._id });
    if (existing) return res.status(400).json({ message: 'Book already in library' });

    const userBook = new UserBook({ userId: req.user._id, bookId: book._id, status: status || 'to-read' });
    await userBook.save();

    await SocialActivity.create({
      userId: req.user._id,
      type: 'book_added',
      bookId: book._id,
      message: `added "${title}" to their library`
    });

    const populated = await UserBook.findById(userBook._id).populate('bookId');
    res.status(201).json({ userBook: populated });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add book', error: err.message });
  }
};

exports.getUserLibrary = async (req, res) => {
  try {
    const userBooks = await UserBook.find({ userId: req.user._id }).populate('bookId').sort({ updatedAt: -1 });
    res.json({ userBooks });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get library', error: err.message });
  }
};

exports.updateBookStatus = async (req, res) => {
  const { id } = req.params;
  const { status, currentPage } = req.body;
  try {
    const userBook = await UserBook.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { status, currentPage, updatedAt: Date.now() },
      { new: true }
    ).populate('bookId');

    if (!userBook) return res.status(404).json({ message: 'UserBook not found' });
    res.json({ userBook });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update book', error: err.message });
  }
};
