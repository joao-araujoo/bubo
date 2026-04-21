const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  googleBooksId: { type: String, unique: true, sparse: true },
  title: { type: String, required: true },
  author: { type: String, default: 'Unknown Author' },
  coverImage: { type: String, default: '' },
  totalPages: { type: Number, default: 0 },
  description: { type: String, default: '' },
  isbn: { type: String, default: '' }
});

module.exports = mongoose.model('Book', bookSchema);
