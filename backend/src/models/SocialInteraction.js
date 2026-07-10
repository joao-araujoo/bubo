const mongoose = require('mongoose');

const socialInteractionSchema = new mongoose.Schema({
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
  kind: {
    type: String,
    enum: ['like', 'save'],
    required: true,
    index: true
  }
}, {
  timestamps: true
});

socialInteractionSchema.index(
  { activityId: 1, userId: 1, kind: 1 },
  { unique: true }
);
socialInteractionSchema.index({ userId: 1, kind: 1, createdAt: -1 });

module.exports = mongoose.model('SocialInteraction', socialInteractionSchema);
