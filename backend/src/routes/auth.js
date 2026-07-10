const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

router.post('/register', [
  body('username').trim().isLength({ min: 3, max: 30 }).withMessage('O nome deve ter entre 3 e 30 caracteres.'),
  body('email').isEmail().normalizeEmail().withMessage('Informe um e-mail válido.'),
  body('password').isLength({ min: 6 }).withMessage('A senha deve ter pelo menos 6 caracteres.')
], authController.register);

router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Informe um e-mail válido.'),
  body('password').exists().withMessage('Informe sua senha.')
], authController.login);

router.get('/profile', authMiddleware, authController.getProfile);
router.patch('/profile', authMiddleware, [
  body('username').optional().trim().isLength({ min: 3, max: 30 }).withMessage('O nome deve ter entre 3 e 30 caracteres.'),
  body('avatar').optional({ checkFalsy: true }).isURL().withMessage('O avatar deve ser uma URL válida.'),
  body('bio').optional().trim().isLength({ max: 240 }).withMessage('A bio deve ter no máximo 240 caracteres.'),
  body('readingGoal').optional().isInt({ min: 1, max: 365 }).withMessage('A meta anual deve ficar entre 1 e 365 livros.'),
  body('onboardingCompleted').optional().isBoolean().withMessage('Estado de onboarding inválido.'),
  body('readingPreferences').optional().isObject().withMessage('Preferências de leitura inválidas.'),
  body('readingPreferences.primaryGoal')
    .optional()
    .isIn(['retain', 'reflect', 'consistency', 'community'])
    .withMessage('Objetivo principal inválido.'),
  body('readingPreferences.pace')
    .optional()
    .isIn(['casual', 'steady', 'intensive'])
    .withMessage('Ritmo de leitura inválido.'),
  body('readingPreferences.favoriteGenres')
    .optional()
    .isArray({ max: 6 })
    .withMessage('Escolha no máximo 6 gêneros.'),
  body('readingPreferences.favoriteGenres.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 40 })
    .withMessage('Gênero inválido.'),
  body('readingPreferences.weeklyReviewTarget')
    .optional()
    .isInt({ min: 1, max: 14 })
    .withMessage('A meta semanal deve ficar entre 1 e 14 reviews.')
], authController.updateProfile);
router.get('/dashboard', authMiddleware, authController.getDashboard);

module.exports = router;
