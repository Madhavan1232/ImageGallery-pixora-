import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pixora_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global response error handler
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('pixora_token');
      localStorage.removeItem('pixora_user');
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────
export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// ── Images ────────────────────────────────────────────
export const imagesAPI = {
  getImages: (page = 1, perPage = 30) =>
    api.get('/images', { params: { page, per_page: perPage } }),

  getRandomizedImages: (page = 1, perPage = 60, seed = '', excludeIds = []) =>
    api.post('/images/randomized', {
      page,
      per_page: perPage,
      seed,
      excludeIds,   // sent as JSON array — no URL-length limit
    }),

  searchImages: (query, page = 1, perPage = 30) =>
    api.get('/images/search', { params: { q: query, page, per_page: perPage } }),

  getCategories: () => api.get('/images/categories'),
};

// ── User (likes/bookmarks) ────────────────────────────
export const userAPI = {
  getLikes: () => api.get('/user/likes'),
  getLikedImages: () => api.get('/user/likes/images'),
  toggleLike: (imageId, imageData) => api.post(`/user/likes/${imageId}`, { imageData }),
  getBookmarks: () => api.get('/user/bookmarks'),
  getBookmarkedImages: () => api.get('/user/bookmarks/images'),
  toggleBookmark: (imageId, imageData) =>
    api.post(`/user/bookmarks/${imageId}`, { imageData }),
  // Social
  getFollowers: () => api.get('/user/followers'),
  getFollowing: () => api.get('/user/following'),
  toggleFollow: (userId) => api.post(`/user/follow/${userId}`),
  // Comments & activity
  addComment: (imageId, text) => api.post(`/user/comments/${imageId}`, { text }),
  getComments: (imageId) => api.get(`/user/comments/${imageId}`),
  getActivities: () => api.get('/user/activities'),
};

// ── Support ────────────────────────────────────────────
export const supportAPI = {
  submitHelp: (data) => api.post('/support/help', data),
};

export default api;
