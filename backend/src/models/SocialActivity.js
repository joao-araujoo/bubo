const mongoose = require('mongoose');

const socialActivitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['review_approved', 'book_completed', 'achievement_unlocked', 'book_added', 'post'],
    required: true
  },
  postType: {
    type: String,
    enum: ['free', 'review', 'challenge'],
    default: 'free'
  },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  pages: { type: Number, default: 0 },
  cognitiveDepth: { type: Number, default: 0 },
  message: { type: String, default: '', trim: true, maxlength: 2000 },
  insight: { type: String, default: '', trim: true, maxlength: 500 },
  createdAt: { type: Date, default: Date.now }
});

socialActivitySchema.index({ createdAt: -1 });
socialActivitySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('SocialActivity', socialActivitySchema);
