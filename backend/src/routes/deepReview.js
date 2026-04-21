const express = require('express');
const router = express.Router();
const deepReviewController = require('../controllers/deepReviewController');
const authMiddleware = require('../middleware/auth');

router.post('/submit', authMiddleware, deepReviewController.submitReview);
router.get('/history/:userBookId', authMiddleware, deepReviewController.getReviewHistory);

module.exports = router;
