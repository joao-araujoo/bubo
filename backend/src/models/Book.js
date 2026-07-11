const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  canonicalId: { type: String, unique: true, sparse: true, index: true },
  googleBooksId: { type: String, unique: true, sparse: true },
  openLibraryKey: { type: String, unique: true, sparse: true },
  title: { type: String, required: true, trim: true },
  subtitle: { type: String, default: '', trim: true },
  author: { type: String, default: 'Autor não informado', trim: true },
  coverImage: { type: String, default: '' },
  totalPages: { type: Number, default: 0, min: 0 },
  pagesSource: {
    type: String,
    enum: ['', 'google_books', 'open_library_median', 'manual'],
    default: '',
  },
  metadataConfidence: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'low',
  },
  metadataSources: [{
    type: String,
    enum: ['google_books', 'open_library', 'manual'],
  }],
  description: { type: String, default: '' },
  isbn: { type: String, default: '', index: true },
  publisher: { type: String, default: '' },
  publishedDate: { type: String, default: '' },
  language: { type: String, default: '' },
  categories: [{ type: String }],
  previewLink: { type: String, default: '' },
}, {
  timestamps: true,
});

bookSchema.index({ title: 1, author: 1 });

module.exports = mongoose.model('Book', bookSchema);
