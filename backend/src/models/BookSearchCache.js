const mongoose = require('mongoose');

const bookSearchCacheSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  query: { type: String, required: true },
  books: { type: [mongoose.Schema.Types.Mixed], default: [] },
  sourceStatus: { type: mongoose.Schema.Types.Mixed, default: {} },
  partial: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, {
  timestamps: true,
  versionKey: false,
});

module.exports = mongoose.model('BookSearchCache', bookSearchCacheSchema);
