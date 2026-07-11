const express = require('express');
const router = express.Router();
const socialController = require('../controllers/socialController');
const recommendationController = require('../controllers/recommendationController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/feed', socialController.getFeed);
router.get('/recommendations/readers', recommendationController.getReaderRecommendations);
router.post('/activity', socialController.createActivity);
router.put('/activity/:activityId/like', socialController.toggleLike);
router.put('/activity/:activityId/save', socialController.toggleSave);
router.get('/activity/:activityId/comments', socialController.getComments);
router.post('/activity/:activityId/comments', socialController.createComment);
router.delete('/comments/:commentId', socialController.deleteComment);
router.put('/users/:userId/follow', socialController.toggleFollow);
router.get('/notifications', socialController.getNotifications);
router.post('/notifications/read', socialController.markNotificationsRead);

module.exports = router;
