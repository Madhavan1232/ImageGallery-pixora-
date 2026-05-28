const {
  getLikes: fetchLikes,
  getLikedImages: fetchLikedImages,
  toggleLike: toggleLikeRecord,
  getBookmarks: fetchBookmarks,
  toggleBookmark: toggleBookmarkRecord,
  getBookmarkedImages: fetchBookmarkedImages,
  getFollowers: getFollowersDb,
  getFollowing: getFollowingDb,
  toggleFollow: toggleFollowDb,
  addComment: addCommentDb,
  getComments: getCommentsDb,
} = require('../utils/db');

async function getLikes(req, res) {
  try {
    const likes = await fetchLikes(req.user.id);
    res.json({ likes });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function toggleLike(req, res) {
  try {
    const { id } = req.params;
    const imageData = req.body.imageData || null;
    const result = await toggleLikeRecord(req.user.id, id, imageData);
    res.json({ ...result, imageId: id });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getLikedImages(req, res) {
  try {
    const { images, ids } = await fetchLikedImages(req.user.id);
    res.json({ images, ids });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getBookmarks(req, res) {
  try {
    const bookmarks = await fetchBookmarks(req.user.id);
    res.json({ bookmarks });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function toggleBookmark(req, res) {
  try {
    const { id } = req.params;
    // bookmarkData can include the full image object
    const imageData = req.body.imageData || null;
    const result = await toggleBookmarkRecord(req.user.id, id, imageData);
    res.json({ ...result, imageId: id });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getBookmarkedImages(req, res) {
  try {
    const { images, ids } = await fetchBookmarkedImages(req.user.id);
    res.json({ images, ids });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getFollowers(req, res) {
  try {
    const followers = await getFollowersDb(req.user.id);
    res.json({ followers });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}

async function getFollowing(req, res) {
  try {
    const following = await getFollowingDb(req.user.id);
    res.json({ following });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}

async function toggleFollow(req, res) {
  try {
    const targetId = req.params.id;
    const result = await toggleFollowDb(req.user.id, targetId);
    res.json(result);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}

async function addComment(req, res) {
  try {
    const { imageId } = req.params;
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Comment text required' });
    const comment = await addCommentDb(req.user.id, imageId, text);
    res.status(201).json(comment);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}

async function getComments(req, res) {
  try {
    const { imageId } = req.params;
    const comments = await getCommentsDb(imageId);
    res.json({ comments });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}

module.exports = {
  getLikes,
  getLikedImages,
  toggleLike,
  getBookmarks,
  toggleBookmark,
  getBookmarkedImages,
  getFollowers,
  getFollowing,
  toggleFollow,
  addComment,
  getComments,
};
