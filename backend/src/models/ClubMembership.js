const mongoose = require('mongoose');

const clubMembershipSchema = new mongoose.Schema({
  clubId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReadingClub',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  role: {
    type: String,
    enum: ['owner', 'moderator', 'member'],
    default: 'member'
  },
  currentPage: {
    type: Number,
    default: 0,
    min: 0
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
  }
});

clubMembershipSchema.index({ clubId: 1, userId: 1 }, { unique: true });
clubMembershipSchema.index({ userId: 1, lastActiveAt: -1 });

module.exports = mongoose.model('ClubMembership', clubMembershipSchema);
