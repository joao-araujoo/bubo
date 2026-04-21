const express = require('express');
const router = express.Router();
const socialController = require('../controllers/socialController');
const authMiddleware = require('../middleware/auth');

router.get('/feed', authMiddleware, socialController.getFeed);
router.post('/activity', authMiddleware, socialController.createActivity);

module.exports = router;
