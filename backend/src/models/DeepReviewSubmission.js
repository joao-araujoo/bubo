const mongoose = require('mongoose');

const deepReviewSubmissionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userBookId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserBook', required: true, index: true },
  idempotencyKey: { type: String, required: true, trim: true, maxlength: 160 },
  fingerprint: { type: String, required: true, trim: true, maxlength: 64 },
  pageFrom: { type: Number, required: true, min: 1 },
  pageTo: { type: Number, required: true, min: 1 },
  reviewText: { type: String, required: true, trim: true, maxlength: 12000 },
  status: {
    type: String,
    enum: ['queued', 'processing', 'completed', 'failed'],
    default: 'queued',
    index: true,
  },
  executionMode: { type: String, enum: ['sync', 'async'], required: true },
  queueJobId: { type: String, default: '', trim: true, maxlength: 160 },
  attempts: { type: Number, default: 0, min: 0 },
  maxAttempts: { type: Number, default: 1, min: 1, max: 10 },
  resultReviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeepReview', default: null },
  resultState: { type: String, enum: ['APPROVED', 'GUIDING', null], default: null },
  lastErrorCode: { type: String, default: '', trim: true, maxlength: 100 },
  lastErrorMessage: { type: String, default: '', trim: true, maxlength: 1000 },
  retryable: { type: Boolean, default: true },
  processingToken: { type: String, default: '', trim: true, maxlength: 100 },
  leaseExpiresAt: { type: Date, default: null, index: true },
  queuedAt: { type: Date, default: Date.now },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  failedAt: { type: Date, default: null },
}, {
  timestamps: true,
  minimize: false,
});

deepReviewSubmissionSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
deepReviewSubmissionSchema.index({ status: 1, queuedAt: 1 });
deepReviewSubmissionSchema.index({ userId: 1, createdAt: -1 });
deepReviewSubmissionSchema.index({ userId: 1, userBookId: 1, createdAt: -1 });

module.exports = mongoose.model('DeepReviewSubmission', deepReviewSubmissionSchema);
