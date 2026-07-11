const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');
const readingSessionController = require('../controllers/readingSessionController');
const authMiddleware = require('../middleware/auth');

router.get('/search', authMiddleware, bookController.searchBooks);
router.post('/library', authMiddleware, bookController.addToLibrary);
router.get('/library', authMiddleware, bookController.getUserLibrary);
router.get('/library/:id', authMiddleware, readingSessionController.getBookDetail);
router.post('/library/:id/sessions', authMiddleware, readingSessionController.createReadingSession);
router.delete('/library/:id/sessions/:sessionId', authMiddleware, readingSessionController.deleteReadingSession);
router.patch('/library/:id', authMiddleware, bookController.updateBookStatus);
router.delete('/library/:id', authMiddleware, bookController.removeFromLibrary);

module.exports = router;
