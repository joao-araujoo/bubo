const express = require('express');
const router = express.Router();
const achievementController = require('../controllers/achievementController');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, achievementController.getUserAchievements);

module.exports = router;
