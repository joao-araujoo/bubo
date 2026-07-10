const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const deepReviewRoutes = require('./routes/deepReview');
const socialRoutes = require('./routes/social');
const achievementRoutes = require('./routes/achievements');
const clubRoutes = require('./routes/clubs');

const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts, please try again later.' }
});

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize());
app.use('/api/', limiter);

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/deep-review', deepReviewRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/clubs', clubRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong', error: err.message });
});

module.exports = app;
