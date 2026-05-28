import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { imagesAPI, userAPI } from '../services/api';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const GalleryContext = createContext(null);

// ── Debounce helper ───────────────────────────────────────────────────────────
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Fisher-Yates shuffle ──────────────────────────────────────────────────────
function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ── Persistent seen-ID store (localStorage, capped at 300 IDs) ───────────────
// This prevents the same images from appearing across multiple refreshes.
const SEEN_STORAGE_KEY = 'pixora_seen_ids';
const SEEN_ID_CAP      = 300;

function loadSeenIds() {
  try {
    const raw = localStorage.getItem(SEEN_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSeenIds(set) {
  try {
    // Keep only the most recent SEEN_ID_CAP entries
    const arr = Array.from(set);
    const trimmed = arr.length > SEEN_ID_CAP ? arr.slice(arr.length - SEEN_ID_CAP) : arr;
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage quota exceeded — silently ignore
  }
}

// ── Random seed: always fresh on every page load ──────────────────────────────
// NOTE: we intentionally do NOT persist this in sessionStorage so every browser
// refresh triggers a completely new randomisation pass.
function generateFreshSeed() {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export function GalleryProvider({ children }) {
  const { user } = useAuth();

  const [images,  setImages]  = useState([]);
  const [page,    setPage]    = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true); // true by default → skeleton on first render
  const [error,   setError]   = useState(null);

  const loadingRef = useRef(false);

  // Per-session seen-ID tracking (global dedup across current scroll session)
  const sessionSeenIds = useRef(new Set());

  // Cross-refresh seen-ID tracking (loaded from localStorage once at mount)
  const crossRefreshSeenIds = useRef(loadSeenIds());

  // Fresh seed per page load — NEVER reuse across refreshes
  const randomSeed = useRef(generateFreshSeed()).current;

  // Track whether we're in randomised mode (no search active)
  const isRandomizedMode = useRef(false);

  const [searchQuery,   setSearchQuery]   = useState('');
  const debouncedSearch = useDebounce(searchQuery, 420);

  const [likes,     setLikes]     = useState(new Set());
  const [bookmarks, setBookmarks] = useState(new Set());

  // ── Load user likes/bookmarks when logged in ──────────────────────────────
  useEffect(() => {
    if (!user) {
      setLikes(new Set());
      setBookmarks(new Set());
      return;
    }
    Promise.all([
      userAPI.getLikes().catch(()     => ({ data: { likes:     [] } })),
      userAPI.getBookmarks().catch(() => ({ data: { bookmarks: [] } })),
    ]).then(([likesRes, bookmarksRes]) => {
      // Normalize IDs to strings to avoid type mismatches between
      // client image IDs (numbers) and stored like/bookmark IDs (strings).
      setLikes(new Set((likesRes.data.likes || []).map(String)));
      setBookmarks(new Set((bookmarksRes.data.bookmarks || []).map(String)));
    });
  }, [user]);

  // ── Core fetch for search results ─────────────────────────────────────────
  const fetchImages = useCallback(async (pg, query) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = query && query.trim()
        ? await imagesAPI.searchImages(query.trim(), pg, 30)
        : await imagesAPI.getImages(pg, 30);

      const responseData  = res.data || res;
      const imagesArray   = responseData.images || responseData.data?.images || [];

      const incoming = imagesArray.filter(img => {
        if (!img || !img.url) return false;
        if (pg !== 1 && sessionSeenIds.current.has(img.id)) return false;
        sessionSeenIds.current.add(img.id);
        return true;
      });

      setImages(prev => pg === 1 ? incoming : [...prev, ...incoming]);
      setHasMore(incoming.length >= 5);
    } catch (err) {
      console.error('Gallery fetch error:', err);
      if (pg === 1) {
        // Fallback images are available — don't show an error banner
        setImages(buildFallback(40));
        setHasMore(true);
        setError(null);
      } else {
        // Pagination failed with no new content — surface the error
        setError('Failed to load more images. Please try again.');
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  // ── Randomised fetch — the heart of the dynamic refresh feature ───────────
  const fetchRandomizedImages = useCallback(async (pg) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // Pass cross-refresh seen IDs so the backend can try to exclude them
      const excludeIds = Array.from(crossRefreshSeenIds.current).slice(-150);

      const res = await imagesAPI.getRandomizedImages(
        pg,
        pg === 1 ? 60 : 40, // larger initial load for instant wow factor
        randomSeed,
        excludeIds,
      );

      const responseData = res.data || res;
      const imagesArray  = responseData.images || responseData.data?.images || [];

      // Deduplicate within this scroll session
      const incoming = imagesArray.filter(img => {
        if (!img || !img.url)                        return false;
        if (sessionSeenIds.current.has(img.id))      return false;
        sessionSeenIds.current.add(img.id);
        // Also record in cross-refresh store
        crossRefreshSeenIds.current.add(img.id);
        return true;
      });

      // Full shuffle on the client side too — double randomness
      const shuffled = shuffleArray(incoming);

      // Persist cross-refresh seen IDs after each successful fetch
      saveSeenIds(crossRefreshSeenIds.current);

      setImages(prev => pg === 1 ? shuffled : [...prev, ...shuffled]);
      // hasMore: be generous — as long as we got something, keep scrolling
      setHasMore(incoming.length >= (pg === 1 ? 30 : 15));
    } catch (err) {
      console.error('Randomized gallery fetch error:', err);
      if (pg === 1) {
        // Show fallback images silently — no error banner needed
        setImages(shuffleArray(buildFallback(60)));
        setHasMore(true);
        setError(null);
      } else {
        // Pagination failure — tell the user
        setError('Failed to load more images. Please try again.');
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [randomSeed]);

  // ── Reset & trigger a fresh page-1 fetch ─────────────────────────────────
  const resetAndFetch = useCallback((query) => {
    sessionSeenIds.current.clear();
    loadingRef.current = false;
    setImages([]);
    setPage(1);
    setHasMore(true);
    setError(null);
    setLoading(true);

    if (query && query.trim()) {
      isRandomizedMode.current = false;
      fetchImages(1, query);
    } else {
      isRandomizedMode.current = true;
      fetchRandomizedImages(1);
    }
  }, [fetchImages, fetchRandomizedImages]);

  // ── Infinite scroll loadMore ──────────────────────────────────────────────
  const loadMore = useCallback(() => {
    if (!hasMore || loadingRef.current) return;
    const next = page + 1;
    setPage(next);

    if (isRandomizedMode.current) {
      fetchRandomizedImages(next);
    } else {
      fetchImages(next, debouncedSearch);
    }
  }, [hasMore, page, debouncedSearch, fetchImages, fetchRandomizedImages]);

  // ── Search handler ────────────────────────────────────────────────────────
  const handleSearch = useCallback((q) => {
    setSearchQuery(q);
  }, []);

  // ── React to debounced search query (includes initial load on mount) ──────
  useEffect(() => {
    resetAndFetch(debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // ── Likes ─────────────────────────────────────────────────────────────────
  const toggleLike = useCallback(async (imageId, imageData = null) => {
    if (!user) { toast.error('Sign in to like images'); return; }
    const id = String(imageId);
    setLikes(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    try {
      await userAPI.toggleLike(id, imageData);
    } catch {
      setLikes(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
      toast.error('Failed to update like');
    }
  }, [user]);

  // ── Bookmarks ─────────────────────────────────────────────────────────────
  const toggleBookmark = useCallback(async (imageId, imageData) => {
    if (!user) { toast.error('Sign in to bookmark images'); return; }
    const id = String(imageId);
    const wasBookmarked = bookmarks.has(id);
    setBookmarks(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    try {
      await userAPI.toggleBookmark(id, imageData);
      toast(wasBookmarked ? 'Removed from bookmarks' : 'Saved to bookmarks', {
        icon: wasBookmarked ? '🗑️' : '🔖',
      });
    } catch {
      setBookmarks(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
      toast.error('Failed to update bookmark');
    }
  }, [user, bookmarks]);

  return (
    <GalleryContext.Provider value={{
      images, loading, error, hasMore,
      searchQuery,
      likes, bookmarks,
      loadMore, handleSearch,
      toggleLike, toggleBookmark,
    }}>
      {children}
    </GalleryContext.Provider>
  );
}

export function useGallery() {
  const ctx = useContext(GalleryContext);
  if (!ctx) throw new Error('useGallery must be used within GalleryProvider');
  return ctx;
}

// ── Fallback image builder ────────────────────────────────────────────────────
function buildFallback(count) {
  const ids  = [10, 20, 30, 40, 50, 60, 70, 80, 100, 200, 300, 400, 500, 600, 700, 800,
                900, 1000, 1010, 1020, 1030, 1040, 1050, 1060, 1065, 1070, 1074, 1080,
                1082, 1083, 1084, 1085, 1086, 1090, 1093, 1095, 1097, 1098, 1099];
  const dims = [[1200, 800], [900, 1200], [1100, 700], [800, 1000], [1000, 1000], [1300, 900]];

  return Array.from({ length: count }, (_, i) => {
    const id  = ids[i % ids.length];
    const dim = dims[i % dims.length];
    return {
      id:          `fallback_${id}_${i}_${Math.random().toString(36).slice(2)}`,
      source:      'picsum',
      url:         `https://picsum.photos/id/${id}/${dim[0]}/${dim[1]}`,
      thumb:       `https://picsum.photos/id/${id}/400/300`,
      full:        `https://picsum.photos/id/${id}/${dim[0]}/${dim[1]}`,
      download:    `https://picsum.photos/id/${id}/${dim[0]}/${dim[1]}`,
      width:       dim[0],
      height:      dim[1],
      color:       '#1a1a1a',
      description: 'Beautiful photo',
      author:      'Pixora',
      likes:       Math.floor(Math.random() * 500),
      tags:        [],
    };
  });
}
