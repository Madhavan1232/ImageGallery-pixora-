const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const { submitHelpRequest } = require('../controllers/supportController');
const { asyncHandler } = require('../utils/asyncHandler');

// ✅ Strict rate limit for support: 5 requests per 1 hour per IP
const supportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: {
    error: 'Too many support requests. Please try again in an hour.',
    retryAfter: 3600,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Don't rate-limit local requests
    return req.ip === '127.0.0.1' || req.ip === '::1';
  },
});

router.post('/help', supportLimiter, asyncHandler(submitHelpRequest));

module.exports = router;
