const express = require('express');
const { body, param, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const clubController = require('../controllers/clubController');

const router = express.Router();

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: errors.array()[0].msg,
      code: 'CLUB_VALIDATION_FAILED',
      errors: errors.array(),
    });
  }
  return next();
};

const mongoIdValidator = param('id').isMongoId().withMessage('O identificador do clube é inválido.');

router.use(authMiddleware);

router.get('/', clubController.listClubs);

router.post('/', [
  body('name').trim().isLength({ min: 3, max: 80 }).withMessage('O nome do clube deve ter entre 3 e 80 caracteres.'),
  body('description').optional().trim().isLength({ max: 600 }).withMessage('A descrição deve ter no máximo 600 caracteres.'),
  body('bookId').isMongoId().withMessage('Selecione um livro válido do seu acervo.'),
  body('visibility').optional().isIn(['public', 'private']).withMessage('A visibilidade precisa ser pública ou privada.'),
  body('startDate').optional({ checkFalsy: true }).isISO8601().withMessage('A data de início é inválida.'),
  body('targetDate').optional({ checkFalsy: true }).isISO8601().withMessage('A data de conclusão é inválida.'),
  body('memberLimit').optional().isInt({ min: 2, max: 100 }).withMessage('O limite de membros deve ficar entre 2 e 100.'),
  validateRequest,
], clubController.createClub);

router.get('/:id', [mongoIdValidator, validateRequest], clubController.getClub);
router.post('/:id/join', [
  mongoIdValidator,
  body('inviteCode').optional().trim().isLength({ min: 6, max: 12 }).withMessage('O código de convite deve ter entre 6 e 12 caracteres.'),
  validateRequest,
], clubController.joinClub);
router.delete('/:id/leave', [mongoIdValidator, validateRequest], clubController.leaveClub);
router.patch('/:id/progress', [
  mongoIdValidator,
  body('currentPage').isInt({ min: 0 }).withMessage('A página atual precisa ser zero ou maior.'),
  validateRequest,
], clubController.updateProgress);
router.post('/:id/discussions', [
  mongoIdValidator,
  body('body').trim().isLength({ min: 1, max: 2000 }).withMessage('A contribuição deve ter entre 1 e 2000 caracteres.'),
  body('insight').optional().trim().isLength({ max: 500 }).withMessage('O insight deve ter no máximo 500 caracteres.'),
  body('pageFrom').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('A página inicial precisa ser maior que zero.'),
  body('pageTo').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('A página final precisa ser maior que zero.'),
  validateRequest,
], clubController.createDiscussion);

module.exports = router;
