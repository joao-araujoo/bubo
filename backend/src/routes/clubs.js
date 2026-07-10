const express = require('express');
const { body, param } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const clubController = require('../controllers/clubController');

const router = express.Router();

const validateRequest = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
  }
  return next();
};

const mongoIdValidator = param('id').isMongoId().withMessage('Invalid reading club id');

router.use(authMiddleware);

router.get('/', clubController.listClubs);

router.post('/', [
  body('name').trim().isLength({ min: 3, max: 80 }).withMessage('Club name must be 3-80 characters'),
  body('description').optional().trim().isLength({ max: 600 }).withMessage('Description must have at most 600 characters'),
  body('bookId').isMongoId().withMessage('A valid book is required'),
  body('visibility').optional().isIn(['public', 'private']).withMessage('Visibility must be public or private'),
  body('startDate').optional({ checkFalsy: true }).isISO8601().withMessage('Start date must be valid'),
  body('targetDate').optional({ checkFalsy: true }).isISO8601().withMessage('Target date must be valid'),
  body('memberLimit').optional().isInt({ min: 2, max: 100 }).withMessage('Member limit must be between 2 and 100'),
  validateRequest
], clubController.createClub);

router.get('/:id', [mongoIdValidator, validateRequest], clubController.getClub);
router.post('/:id/join', [
  mongoIdValidator,
  body('inviteCode').optional().trim().isLength({ min: 6, max: 12 }).withMessage('Invitation code must be 6-12 characters'),
  validateRequest
], clubController.joinClub);
router.delete('/:id/leave', [mongoIdValidator, validateRequest], clubController.leaveClub);
router.patch('/:id/progress', [
  mongoIdValidator,
  body('currentPage').isInt({ min: 0 }).withMessage('Current page must be zero or greater'),
  validateRequest
], clubController.updateProgress);
router.post('/:id/discussions', [
  mongoIdValidator,
  body('body').trim().isLength({ min: 1, max: 2000 }).withMessage('Discussion must have 1-2000 characters'),
  body('insight').optional().trim().isLength({ max: 500 }).withMessage('Insight must have at most 500 characters'),
  body('pageFrom').optional({ checkFalsy: true }).isInt({ min: 0 }).withMessage('Initial page must be zero or greater'),
  body('pageTo').optional({ checkFalsy: true }).isInt({ min: 0 }).withMessage('Final page must be zero or greater'),
  validateRequest
], clubController.createDiscussion);

module.exports = router;
