const mongoose = require('mongoose');

const deepReviewSchema = new mongoose.Schema({
  submissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeepReviewSubmission',
    default: null,
    index: true,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userBookId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserBook', required: true, index: true },
  pageFrom: { type: Number, required: true, min: 1 },
  pageTo: { type: Number, required: true, min: 1 },
  reviewText: { type: String, required: true, trim: true, maxlength: 12000 },
  cognitiveDepth: { type: Number, default: 0, min: 0, max: 100 },
  status: { type: String, enum: ['approved', 'guiding'], default: 'guiding', index: true },
  aiProvider: { type: String, enum: ['openai', 'gemini', 'seed'], required: true },
  aiModel: { type: String, default: '', trim: true, maxlength: 120 },
  evaluationVersion: { type: String, default: '1.0', trim: true, maxlength: 30 },
  wordCount: { type: Number, default: 0, min: 0 },
  aiResponse: { type: Object, default: {} },
  effectsAppliedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now, index: true },
});

deepReviewSchema.index(
  { submissionId: 1 },
  { unique: true, partialFilterExpression: { submissionId: { $type: 'objectId' } } },
);
deepReviewSchema.index({ userId: 1, createdAt: -1 });
deepReviewSchema.index({ userId: 1, userBookId: 1, createdAt: -1 });

module.exports = mongoose.model('DeepReview', deepReviewSchema);
