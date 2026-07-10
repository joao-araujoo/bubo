const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const SocialActivity = require('../models/SocialActivity');
const SocialComment = require('../models/SocialComment');
const SocialInteraction = require('../models/SocialInteraction');
const User = require('../models/User');
const UserFollow = require('../models/UserFollow');

const MAX_FEED_ITEMS = 50;
const MAX_COMMENTS = 100;
const MAX_NOTIFICATIONS = 40;

const asObjectId = (value) => new mongoose.Types.ObjectId(String(value));

const createNotification = async ({ recipientId, actorId, type, activityId, commentId }) => {
  if (String(recipientId) === String(actorId)) return null;

  return Notification.create({
    recipientId,
    actorId,
    type,
    activityId: activityId || undefined,
    commentId: commentId || undefined
  });
};

const serializeComment = (comment, currentUserId) => ({
  _id: comment._id,
  activityId: comment.activityId,
  userId: comment.userId?._id || comment.userId,
  username: comment.userId?.username || 'Leitor Bubo',
  avatar: comment.userId?.avatar || '',
  body: comment.body,
  createdAt: comment.createdAt,
  isOwn: String(comment.userId?._id || comment.userId) === String(currentUserId)
});

const serializeActivities = async (activities, currentUserId) => {
  if (!activities.length) return [];

  const activityIds = activities.map((activity) => asObjectId(activity._id));
  const authorIds = activities
    .map((activity) => activity.userId?._id || activity.userId)
    .filter(Boolean)
    .map(asObjectId);

  const [interactionCounts, commentCounts, viewerInteractions, followedAuthors] = await Promise.all([
    SocialInteraction.aggregate([
      { $match: { activityId: { $in: activityIds } } },
      { $group: { _id: { activityId: '$activityId', kind: '$kind' }, count: { $sum: 1 } } }
    ]),
    SocialComment.aggregate([
      { $match: { activityId: { $in: activityIds } } },
      { $group: { _id: '$activityId', count: { $sum: 1 } } }
    ]),
    SocialInteraction.find({
      activityId: { $in: activityIds },
      userId: currentUserId
    }).lean(),
    UserFollow.find({
      followerId: currentUserId,
      followingId: { $in: authorIds }
    }).lean()
  ]);

  const interactionCountMap = new Map();
  interactionCounts.forEach((item) => {
    interactionCountMap.set(`${item._id.activityId}:${item._id.kind}`, item.count);
  });

  const commentCountMap = new Map(
    commentCounts.map((item) => [String(item._id), item.count])
  );

  const viewerInteractionSet = new Set(
    viewerInteractions.map((item) => `${item.activityId}:${item.kind}`)
  );

  const followedAuthorSet = new Set(
    followedAuthors.map((item) => String(item.followingId))
  );

  return activities.map((activity) => {
    const activityId = String(activity._id);
    const authorId = activity.userId?._id || activity.userId;
    const serializedAuthorId = authorId ? String(authorId) : null;

    return {
      _id: activity._id,
      userId: serializedAuthorId,
      username: activity.userId?.username || 'Leitor Bubo',
      avatar: activity.userId?.avatar || '',
      message: activity.message,
      insight: activity.insight || '',
      cognitiveDepth: activity.cognitiveDepth || 0,
      type: activity.type,
      postType: activity.postType || 'free',
      bookTitle: activity.bookId?.title || '',
      bookAuthor: activity.bookId?.author || '',
      bookCover: activity.bookId?.coverImage || '',
      createdAt: activity.createdAt,
      likesCount: interactionCountMap.get(`${activityId}:like`) || 0,
      commentsCount: commentCountMap.get(activityId) || 0,
      isLiked: viewerInteractionSet.has(`${activityId}:like`),
      isSaved: viewerInteractionSet.has(`${activityId}:save`),
      isFollowing: serializedAuthorId ? followedAuthorSet.has(serializedAuthorId) : false,
      isOwn: serializedAuthorId === String(currentUserId)
    };
  });
};

exports.getFeed = async (req, res) => {
  try {
    const scope = req.query.scope === 'following' ? 'following' : 'all';
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), MAX_FEED_ITEMS);
    const query = {};

    if (scope === 'following') {
      const followed = await UserFollow.find({ followerId: req.user._id })
        .select('followingId')
        .lean();
      query.userId = {
        $in: [req.user._id, ...followed.map((item) => item.followingId)]
      };
    }

    const activities = await SocialActivity.find(query)
      .populate('userId', 'username avatar')
      .populate('bookId', 'title author coverImage')
      .sort({ createdAt: -1 })
      .limit(limit);

    const serialized = await serializeActivities(activities, req.user._id);
    res.json({ activities: serialized, scope });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get feed', error: err.message });
  }
};

exports.createActivity = async (req, res) => {
  const { type = 'post', postType = 'free', bookId, pages, cognitiveDepth, message, insight } = req.body;

  if (type !== 'post') {
    return res.status(400).json({ message: 'Only reader posts can be created from this endpoint' });
  }

  const normalizedMessage = String(message || '').trim();
  const normalizedInsight = String(insight || '').trim();

  if (!normalizedMessage) {
    return res.status(400).json({ message: 'Post content is required' });
  }

  try {
    const activity = await SocialActivity.create({
      userId: req.user._id,
      type: 'post',
      postType,
      bookId: bookId || undefined,
      pages: Number(pages) || 0,
      cognitiveDepth: Number(cognitiveDepth) || 0,
      message: normalizedMessage,
      insight: normalizedInsight
    });

    const populated = await SocialActivity.findById(activity._id)
      .populate('userId', 'username avatar')
      .populate('bookId', 'title author coverImage');
    const [serialized] = await serializeActivities([populated], req.user._id);

    res.status(201).json({ activity: serialized });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create activity', error: err.message });
  }
};

const toggleInteraction = async (req, res, kind) => {
  try {
    const activity = await SocialActivity.findById(req.params.activityId).select('userId');
    if (!activity) return res.status(404).json({ message: 'Activity not found' });

    const criteria = {
      activityId: activity._id,
      userId: req.user._id,
      kind
    };
    const existing = await SocialInteraction.findOne(criteria);
    let active;

    if (existing) {
      await existing.deleteOne();
      active = false;

      if (kind === 'like') {
        await Notification.deleteMany({
          recipientId: activity.userId,
          actorId: req.user._id,
          type: 'like',
          activityId: activity._id
        });
      }
    } else {
      await SocialInteraction.create(criteria);
      active = true;

      if (kind === 'like') {
        await createNotification({
          recipientId: activity.userId,
          actorId: req.user._id,
          type: 'like',
          activityId: activity._id
        });
      }
    }

    const count = await SocialInteraction.countDocuments({
      activityId: activity._id,
      kind
    });

    res.json({ active, count, kind });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Interaction already registered' });
    }
    res.status(500).json({ message: `Failed to update ${kind}`, error: err.message });
  }
};

exports.toggleLike = (req, res) => toggleInteraction(req, res, 'like');
exports.toggleSave = (req, res) => toggleInteraction(req, res, 'save');

exports.getComments = async (req, res) => {
  try {
    const activityExists = await SocialActivity.exists({ _id: req.params.activityId });
    if (!activityExists) return res.status(404).json({ message: 'Activity not found' });

    const comments = await SocialComment.find({ activityId: req.params.activityId })
      .populate('userId', 'username avatar')
      .sort({ createdAt: 1 })
      .limit(MAX_COMMENTS);

    res.json({
      comments: comments.map((comment) => serializeComment(comment, req.user._id))
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get comments', error: err.message });
  }
};

exports.createComment = async (req, res) => {
  const body = String(req.body.body || '').trim();
  if (!body) return res.status(400).json({ message: 'Comment content is required' });

  try {
    const activity = await SocialActivity.findById(req.params.activityId).select('userId');
    if (!activity) return res.status(404).json({ message: 'Activity not found' });

    const comment = await SocialComment.create({
      activityId: activity._id,
      userId: req.user._id,
      body
    });
    await comment.populate('userId', 'username avatar');

    await createNotification({
      recipientId: activity.userId,
      actorId: req.user._id,
      type: 'comment',
      activityId: activity._id,
      commentId: comment._id
    });

    res.status(201).json({ comment: serializeComment(comment, req.user._id) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create comment', error: err.message });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const comment = await SocialComment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    if (String(comment.userId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You can only remove your own comments' });
    }

    await Promise.all([
      comment.deleteOne(),
      Notification.deleteMany({ commentId: comment._id })
    ]);

    res.json({ deleted: true, commentId: comment._id, activityId: comment.activityId });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete comment', error: err.message });
  }
};

exports.toggleFollow = async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    if (String(targetUserId) === String(req.user._id)) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }

    const targetUser = await User.exists({ _id: targetUserId });
    if (!targetUser) return res.status(404).json({ message: 'Reader not found' });

    const criteria = {
      followerId: req.user._id,
      followingId: targetUserId
    };
    const existing = await UserFollow.findOne(criteria);
    let isFollowing;

    if (existing) {
      await existing.deleteOne();
      await Notification.deleteMany({
        recipientId: targetUserId,
        actorId: req.user._id,
        type: 'follow'
      });
      isFollowing = false;
    } else {
      await UserFollow.create(criteria);
      await createNotification({
        recipientId: targetUserId,
        actorId: req.user._id,
        type: 'follow'
      });
      isFollowing = true;
    }

    const followersCount = await UserFollow.countDocuments({ followingId: targetUserId });
    res.json({ isFollowing, followersCount, userId: targetUserId });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Follow relationship already exists' });
    }
    res.status(500).json({ message: 'Failed to update follow relationship', error: err.message });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ recipientId: req.user._id })
        .populate('actorId', 'username avatar')
        .populate('activityId', 'message')
        .sort({ createdAt: -1 })
        .limit(MAX_NOTIFICATIONS),
      Notification.countDocuments({ recipientId: req.user._id, readAt: null })
    ]);

    res.json({
      unreadCount,
      notifications: notifications.map((notification) => ({
        _id: notification._id,
        type: notification.type,
        actor: {
          _id: notification.actorId?._id,
          username: notification.actorId?.username || 'Leitor Bubo',
          avatar: notification.actorId?.avatar || ''
        },
        activityId: notification.activityId?._id || notification.activityId || null,
        activityMessage: notification.activityId?.message || '',
        commentId: notification.commentId || null,
        createdAt: notification.createdAt,
        isRead: Boolean(notification.readAt)
      }))
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get notifications', error: err.message });
  }
};

exports.markNotificationsRead = async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.filter(Boolean) : [];
    const criteria = { recipientId: req.user._id, readAt: null };
    if (ids.length > 0) criteria._id = { $in: ids };

    await Notification.updateMany(criteria, { $set: { readAt: new Date() } });
    const unreadCount = await Notification.countDocuments({
      recipientId: req.user._id,
      readAt: null
    });

    res.json({ unreadCount });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update notifications', error: err.message });
  }
};
