const express = require('express');
const router = express.Router();
const { getImages, getRandomizedImages, searchImages, getCategories } = require('../controllers/imagesController');

router.get('/', getImages);
router.post('/randomized', getRandomizedImages);
router.get('/search', searchImages);
router.get('/categories', getCategories);

module.exports = router;
