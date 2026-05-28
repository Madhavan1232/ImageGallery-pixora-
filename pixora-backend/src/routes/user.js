const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  getLikes, getLikedImages, toggleLike,
  getBookmarks, toggleBookmark, getBookmarkedImages
} = require('../controllers/userController');

router.use(authMiddleware);

router.get('/likes', getLikes);
router.get('/likes/images', getLikedImages);
router.post('/likes/:id', toggleLike);

router.get('/bookmarks', getBookmarks);
router.get('/bookmarks/images', getBookmarkedImages);
router.post('/bookmarks/:id', toggleBookmark);

// Avatar upload removed per user request

// Follow / social
router.get('/followers', require('../controllers/userController').getFollowers);
router.get('/following', require('../controllers/userController').getFollowing);
router.post('/follow/:id', require('../controllers/userController').toggleFollow);

// Comments
router.post('/comments/:imageId', require('../controllers/userController').addComment);
router.get('/comments/:imageId', require('../controllers/userController').getComments);

module.exports = router;
