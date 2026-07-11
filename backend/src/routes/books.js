const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');
const authMiddleware = require('../middleware/auth');

router.get('/search', authMiddleware, bookController.searchBooks);
router.post('/library', authMiddleware, bookController.addToLibrary);
router.get('/library', authMiddleware, bookController.getUserLibrary);
router.patch('/library/:id', authMiddleware, bookController.updateBookStatus);
router.delete('/library/:id', authMiddleware, bookController.removeFromLibrary);

module.exports = router;
