const mongoose = require('mongoose');

const deepReviewEmbedSchema = new mongoose.Schema({
  submissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeepReviewSubmission', default: null },
  reviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeepReview', default: null },
  pageFrom: Number,
  pageTo: Number,
  reviewText: String,
  cognitiveDepth: { type: Number, default: 0 },
  status: { type: String, enum: ['approved', 'guiding'], default: 'guiding' },
  aiResponse: Object,
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const userBookSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  status: { type: String, enum: ['reading', 'to-read', 'read', 'abandoned'], default: 'to-read' },
  currentPage: { type: Number, default: 0, min: 0 },
  totalPagesOverride: { type: Number, default: 0, min: 0 },
  deepReviewCount: { type: Number, default: 0, min: 0 },
  deepReviews: { type: [deepReviewEmbedSchema], default: [], select: false },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  addedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

userBookSchema.index({ userId: 1, bookId: 1 }, { unique: true });
userBookSchema.index({ userId: 1, status: 1, updatedAt: -1 });
userBookSchema.index({ userId: 1, updatedAt: -1 });

userBookSchema.post('findOneAndDelete', async (document) => {
  if (!document) return;
  const ReadingSession = mongoose.models.ReadingSession;
  if (ReadingSession) await ReadingSession.deleteMany({ userBookId: document._id });
});

module.exports = mongoose.model('UserBook', userBookSchema);
