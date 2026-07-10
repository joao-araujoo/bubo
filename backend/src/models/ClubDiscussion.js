const mongoose = require('mongoose');

const clubDiscussionSchema = new mongoose.Schema({
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
  body: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 2000
  },
  insight: {
    type: String,
    default: '',
    trim: true,
    maxlength: 500
  },
  pageFrom: {
    type: Number,
    min: 0
  },
  pageTo: {
    type: Number,
    min: 0
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

clubDiscussionSchema.index({ clubId: 1, createdAt: -1 });

module.exports = mongoose.model('ClubDiscussion', clubDiscussionSchema);
