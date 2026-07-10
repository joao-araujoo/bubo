const mongoose = require('mongoose');

const readingClubSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 80
  },
  description: {
    type: String,
    default: '',
    trim: true,
    maxlength: 600
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true,
    index: true
  },
  visibility: {
    type: String,
    enum: ['public', 'private'],
    default: 'public',
    index: true
  },
  inviteCode: {
    type: String,
    trim: true,
    uppercase: true,
    unique: true,
    sparse: true,
    minlength: 6,
    maxlength: 12
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  targetDate: {
    type: Date
  },
  memberLimit: {
    type: Number,
    default: 30,
    min: 2,
    max: 100
  },
  isArchived: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true
});

readingClubSchema.index({ visibility: 1, isArchived: 1, createdAt: -1 });
readingClubSchema.index({ ownerId: 1, createdAt: -1 });

module.exports = mongoose.model('ReadingClub', readingClubSchema);
