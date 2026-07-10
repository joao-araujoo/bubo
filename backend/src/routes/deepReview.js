const express = require('express');
const router = express.Router();
const deepReviewController = require('../controllers/deepReviewController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/status', deepReviewController.getCoachStatus);
router.get('/profile', deepReviewController.getCognitiveProfile);
router.post('/submit', deepReviewController.submitReview);
router.get('/history/:userBookId', deepReviewController.getReviewHistory);

module.exports = router;
