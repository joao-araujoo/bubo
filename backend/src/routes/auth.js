const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

router.post('/register', [
  body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], authController.register);

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], authController.login);

router.get('/profile', authMiddleware, authController.getProfile);
router.patch('/profile', authMiddleware, [
  body('username').optional().trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
  body('avatar').optional({ checkFalsy: true }).isURL().withMessage('Avatar must be a valid URL'),
  body('bio').optional().trim().isLength({ max: 240 }).withMessage('Bio must have at most 240 characters'),
  body('readingGoal').optional().isInt({ min: 1, max: 365 }).withMessage('Reading goal must be between 1 and 365')
], authController.updateProfile);
router.get('/dashboard', authMiddleware, authController.getDashboard);

module.exports = router;
