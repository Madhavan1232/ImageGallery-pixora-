const express = require('express');
const router = express.Router();

const {
  getImages,
  getRandomizedImages,
  searchImages,
  getCategories,
  getHealthStatus,
} = require('../controllers/imagesController');
const { asyncHandler } = require('../utils/asyncHandler');
const { validateQuery } = require('../middleware/validate');

// Validation schemas
const imagesValidation = {
  page: { type: 'number', min: 1, max: 999 },
  per_page: { type: 'number', min: 1, max: 100 },
};

const searchValidation = {
  q: { type: 'string', required: true, maxLength: 200 },
  page: { type: 'number', min: 1, max: 999 },
  per_page: { type: 'number', min: 1, max: 100 },
};

// Routes
router.get(
  '/',
  validateQuery(imagesValidation),
  asyncHandler(getImages)
);

router.post(
  '/randomized',
  asyncHandler(async (req, res, next) => {
    const { page, per_page } = req.body;
    if (page !== undefined && (typeof page !== 'number' || page < 1 || page > 999)) {
      return res.status(400).json({ error: 'page must be between 1 and 999' });
    }
    if (per_page !== undefined && (typeof per_page !== 'number' || per_page < 1 || per_page > 100)) {
      return res.status(400).json({ error: 'per_page must be between 1 and 100' });
    }
    next();
  }),
  asyncHandler(getRandomizedImages)
);

router.get(
  '/search',
  validateQuery(searchValidation),
  asyncHandler(searchImages)
);

router.get('/categories', asyncHandler(getCategories));

// Admin endpoint: Check circuit breaker and cache status
router.get('/health/status', asyncHandler(getHealthStatus));

module.exports = router;
