const mongoose = require('mongoose');

const readingSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userBookId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserBook', required: true, index: true },
  pageFrom: { type: Number, required: true, min: 1 },
  pageTo: { type: Number, required: true, min: 1 },
  pagesRead: { type: Number, required: true, min: 1 },
  durationMinutes: { type: Number, default: 0, min: 0, max: 1440 },
  focus: {
    type: String,
    enum: ['not-informed', 'low', 'medium', 'high'],
    default: 'not-informed',
  },
  note: { type: String, default: '', trim: true, maxlength: 2000 },
  readAt: { type: Date, default: Date.now, index: true },
}, {
  timestamps: true,
});

readingSessionSchema.index({ userId: 1, userBookId: 1, readAt: -1 });
readingSessionSchema.index({ userId: 1, readAt: -1 });

module.exports = mongoose.model('ReadingSession', readingSessionSchema);
