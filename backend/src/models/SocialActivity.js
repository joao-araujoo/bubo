const mongoose = require('mongoose');

const socialActivitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['review_approved', 'book_completed', 'achievement_unlocked', 'book_added'], required: true },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  pages: { type: Number, default: 0 },
  cognitiveDepth: { type: Number, default: 0 },
  message: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SocialActivity', socialActivitySchema);
