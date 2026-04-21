const mongoose = require('mongoose');

const deepReviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userBookId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserBook', required: true },
  pageFrom: { type: Number, required: true },
  pageTo: { type: Number, required: true },
  reviewText: { type: String, required: true },
  cognitiveDepth: { type: Number, default: 0, min: 0, max: 100 },
  status: { type: String, enum: ['approved', 'guiding'], default: 'guiding' },
  aiResponse: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DeepReview', deepReviewSchema);
