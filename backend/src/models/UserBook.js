const mongoose = require('mongoose');

const deepReviewEmbedSchema = new mongoose.Schema({
  pageFrom: Number,
  pageTo: Number,
  reviewText: String,
  cognitiveDepth: { type: Number, default: 0 },
  status: { type: String, enum: ['approved', 'guiding'], default: 'guiding' },
  aiResponse: Object,
  createdAt: { type: Date, default: Date.now }
});

const userBookSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  status: { type: String, enum: ['reading', 'to-read', 'read', 'abandoned'], default: 'to-read' },
  currentPage: { type: Number, default: 0 },
  deepReviews: [deepReviewEmbedSchema],
  addedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

userBookSchema.index({ userId: 1, bookId: 1 }, { unique: true });

module.exports = mongoose.model('UserBook', userBookSchema);
