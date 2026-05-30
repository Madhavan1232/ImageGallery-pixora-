const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const { signup, login, getMe, googleSignIn } = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

// Auth rate limiting: 5 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1',
});

router.post('/signup', authLimiter, asyncHandler(signup));
router.post('/login', authLimiter, asyncHandler(login));
router.post('/google', authLimiter, asyncHandler(googleSignIn));
router.get('/me', authMiddleware, asyncHandler(getMe));

module.exports = router;
