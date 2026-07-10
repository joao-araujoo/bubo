const mongoose = require('mongoose');

const socialCommentSchema = new mongoose.Schema({
  activityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SocialActivity',
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
    maxlength: 1200
  }
}, {
  timestamps: true
});

socialCommentSchema.index({ activityId: 1, createdAt: 1 });
socialCommentSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('SocialComment', socialCommentSchema);
