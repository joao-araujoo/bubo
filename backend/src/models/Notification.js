const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['like', 'comment', 'follow'],
    required: true,
    index: true
  },
  activityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SocialActivity'
  },
  commentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SocialComment'
  },
  readAt: {
    type: Date,
    default: null,
    index: true
  }
}, {
  timestamps: true
});

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, readAt: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
