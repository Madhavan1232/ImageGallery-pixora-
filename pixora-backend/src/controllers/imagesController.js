const { retryAxiosRequest } = require('../utils/retryAxios');
const { RequestPool } = require('../utils/requestPool');
const { CircuitBreaker } = require('../utils/circuitBreaker');
const { LRUCache, CACHE_TTL_LONG, CACHE_TTL_SHORT } = require('../utils/cache');
const { updateRateLimitState } = require('../middleware/rateLimitTracker');
const { listImages } = require('../utils/db');

// ════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ════════════════════════════════════════════════════════════════════════════

// Request pooling - max 4 concurrent to not overwhelm Azure F1's single core
const apiPool = new RequestPool(4);

// Cache with 20MB limit for Azure F1 (165MB RAM)
const imageCache = new LRUCache(20);

// ════════════════════════════════════════════════════════════════════════════
// CIRCUIT BREAKERS - prevent cascading failures
// ════════════════════════════════════════════════════════════════════════════

let unsplashBreaker, pexelsBreaker, pixabayBreaker, picsumBreaker;

function initializeCircuitBreakers() {
  unsplashBreaker = new CircuitBreaker('Unsplash', fetchUnsplashImpl, {
    threshold: 5,
    timeout: 30000,
  });
  pexelsBreaker = new CircuitBreaker('Pexels', fetchPexelsImpl, {
    threshold: 5,
    timeout: 30000,
  });
  pixabayBreaker = new CircuitBreaker('Pixabay', fetchPixabayImpl, {
    threshold: 5,
    timeout: 30000,
  });
  picsumBreaker = new CircuitBreaker('Picsum', fetchPicsumImpl, {
    threshold: 5,
    timeout: 30000,
  });
}

// Initialize on module load
initializeCircuitBreakers();

const TIMEOUT_CONFIG = {
  external: 5000,
  database: 10000,
  search: 3000,
};

const MIN_WIDTH = 900;
  { id: 'all',          label: 'All',          query: '' },
  { id: 'nature',       label: 'Nature',       query: 'nature' },
  { id: 'architecture', label: 'Architecture', query: 'architecture' },
  { id: 'people',       label: 'People',       query: 'people' },
  { id: 'travel',       label: 'Travel',       query: 'travel' },
  { id: 'technology',   label: 'Technology',   query: 'technology' },
  { id: 'food',         label: 'Food',         query: 'food' },
  { id: 'abstract',     label: 'Abstract',     query: 'abstract' },
  { id: 'animals',      label: 'Animals',      query: 'animals' },
  { id: 'fashion',      label: 'Fashion',      query: 'fashion' },
  { id: 'city',         label: 'City',         query: 'city' },
  { id: 'minimal',      label: 'Minimal',      query: 'minimal' },
];

// ─── Normalizers ─────────────────────────────────────────────────────────────

function normalizeUnsplash(img) {
  return {
    id:            `unsplash_${img.id}`,
    source:        'unsplash',
    url:           img.urls?.regular || img.urls?.full,
    thumb:         img.urls?.small   || img.urls?.thumb,
    full:          img.urls?.full,
    download:      img.links?.download,
    width:         img.width,
    height:        img.height,
    color:         img.color || '#888888',
    description:   img.description || img.alt_description || 'Beautiful photo',
    author:        img.user?.name || 'Unknown',
    authorUsername: img.user?.username,
    authorProfile:  img.user?.links?.html,
    likes:         img.likes || 0,
    tags:          img.tags?.map(t => t.title) || [],
  };
}

function normalizePexels(img) {
  return {
    id:            `pexels_${img.id}`,
    source:        'pexels',
    url:           img.src?.large2x || img.src?.large || img.src?.original,
    thumb:         img.src?.medium  || img.src?.small,
    full:          img.src?.original,
    download:      img.src?.original,
    width:         img.width,
    height:        img.height,
    color:         img.avg_color || '#888888',
    description:   img.alt || `Photo by ${img.photographer}`,
    author:        img.photographer || 'Unknown',
    authorUsername: img.photographer_url ? img.photographer_url.split('/').pop() : null,
    authorProfile:  img.photographer_url,
    likes:         Math.floor(Math.random() * 1000) + 50,
    tags:          [],
  };
}

function normalizePixabay(img) {
  return {
    id:            `pixabay_${img.id}`,
    source:        'pixabay',
    url:           img.webformatURL   || img.largeImageURL,
    thumb:         img.previewURL     || img.webformatURL,
    full:          img.largeImageURL  || img.webformatURL,
    download:      img.largeImageURL  || img.webformatURL,
    width:         img.webformatWidth || img.imageWidth,
    height:        img.webformatHeight || img.imageHeight,
    color:         '#888888',
    description:   img.tags ? `${img.tags}` : 'Beautiful photo',
    author:        img.user || 'Pixabay',
    authorUsername: img.user,
    authorProfile:  `https://pixabay.com/users/${img.user}-${img.user_id}/`,
    likes:         img.likes || 0,
    tags:          img.tags ? img.tags.split(', ') : [],
  };
}

function normalizePicsum(img) {
  const id = img.id;
  const w  = img.width  || 1200;
  const h  = img.height || 800;
  return {
    id:            `picsum_${id}`,
    source:        'picsum',
    url:           `https://picsum.photos/id/${id}/${w}/${h}`,
    thumb:         `https://picsum.photos/id/${id}/400/300`,
    full:          `https://picsum.photos/id/${id}/${w}/${h}`,
    download:      `https://picsum.photos/id/${id}/${w}/${h}`,
    width:         w,
    height:        h,
    color:         '#888888',
    description:   img.author ? `Photo by ${img.author}` : 'Beautiful photo',
    author:        img.author || 'Picsum',
    authorUsername: img.author,
    authorProfile:  null,
    likes:         Math.floor(Math.random() * 500),
    tags:          [],
  };
}

// ─── HD filter helper ─────────────────────────────────────────────────────────
const MIN_WIDTH = 900;
function isHD(img) {
  return !img.width || img.width >= MIN_WIDTH;
}

// ─── Comprehensive aesthetic keyword pool ─────────────────────────────────────
// Curated into themed groups for diverse, fresh results on every refresh

const AESTHETIC_KEYWORDS = [
  'dark aesthetic wallpaper',
  'monochrome aesthetic',
  'minimal aesthetic',
  'dreamy landscape',
  'cinematic photography',
  'luxury interior',
  'cyberpunk aesthetic',
  'soft pastel aesthetic',
  'street aesthetic',
  'moody photography',
  'neon lighting',
  'aesthetic',
  'dark wallpaper',
  'neon',
  'luxury',
];

const ARTISTIC_KEYWORDS = [
  'anime aesthetic',
  'digital illustration',
  'cartoon art',
  '3D render',
  'digital art',
  'fantasy art',
  'abstract art',
  'surreal art',
  'concept art',
  'cartoons',
];

const PHOTOGRAPHY_KEYWORDS = [
  'landscape photography',
  'portrait photography',
  'architecture photography',
  'nature photography',
  'street photography',
  'travel photography',
  'abstract photography',
  'cinematic',
  'gaming',
  'minimal',
  'dreamy landscapes',
];

const ALL_KEYWORDS = [
  ...AESTHETIC_KEYWORDS,
  ...ARTISTIC_KEYWORDS,
  ...PHOTOGRAPHY_KEYWORDS,
];

// ─── Utility: shuffle (Fisher-Yates) ─────────────────────────────────────────
function shuffle(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ─── Utility: resolve settled promises ───────────────────────────────────────
function settled(results) {
  return results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);
}

// ─── Keyword selection ────────────────────────────────────────────────────────

// For non-randomized browse: cycle through keyword list by page
function getKeywordsForPage(page) {
  const startIdx = ((page - 1) * 3) % ALL_KEYWORDS.length;
  const keywords = [
    ALL_KEYWORDS[startIdx % ALL_KEYWORDS.length],
    ALL_KEYWORDS[(startIdx + 1) % ALL_KEYWORDS.length],
  ];
  if (page % 2 === 0) {
    keywords.push(ALL_KEYWORDS[(startIdx + 2) % ALL_KEYWORDS.length]);
  }
  return keywords;
}

/**
 * Pick `count` truly random keywords — ALWAYS uses Math.random(), ignoring seed.
 * The seed is only used to deterministically vary pagination pages so users see
 * consistent scroll continuation. Page 1 is always fully random.
 */
function pickRandomKeywords(count) {
  const pool = shuffle(ALL_KEYWORDS);
  return pool.slice(0, count);
}

/**
 * For pagination pages (>1): vary the keywords using seed+page combo so we don't
 * repeat the same page-1 keywords, but still deliver fresh batches.
 */
function pickPagedKeywords(count, seed, page) {
  // Use seed + page as an offset so each page gets a unique but reproducible slice
  const offset = (parseInt(seed.substring(0, 8), 36) + page * 7) % ALL_KEYWORDS.length;
  const rotated = [
    ...ALL_KEYWORDS.slice(offset),
    ...ALL_KEYWORDS.slice(0, offset),
  ];
  return rotated.slice(0, count);
}

// ─── Source fetchers ──────────────────────────────────────────────────────────

async function fetchUnsplash(query, page, perPage) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key || key === 'your_unsplash_access_key_here') return [];

  try {
    const r = await axios.get(`${process.env.UNSPLASH_BASE_URL}/search/photos`, {
      params: { query, page, per_page: Math.min(perPage, 30), order_by: 'relevant' },
      headers: { Authorization: `Client-ID ${key}` },
      timeout: 6000,
    });
    return (r.data.results || []).map(normalizeUnsplash).filter(isHD);
  } catch (e) {
    console.warn('Unsplash fetch failed:', e.message);
    return [];
  }
}

async function fetchPexels(query, page, perPage) {
  const key = process.env.PEXELS_API_KEY;
  if (!key || key === 'your_pexels_api_key_here') return [];

  try {
    const r = await axios.get('https://api.pexels.com/v1/search', {
      params: { query, page, per_page: Math.min(perPage, 80), size: 'large' },
      headers: { Authorization: key },
      timeout: 6000,
    });
    return (r.data.photos || []).map(normalizePexels).filter(isHD);
  } catch (e) {
    console.warn('Pexels fetch failed:', e.message);
    return [];
  }
}

async function fetchPixabay(query, page, perPage) {
  const key = process.env.PIXABAY_API_KEY;
  if (!key || key === 'your_pixabay_api_key_here') return [];

  try {
    const r = await axios.get('https://pixabay.com/api/', {
      params: {
        key,
        q:          query,
        page,
        per_page:   Math.min(perPage, 80),
        image_type: 'photo',
        safesearch: true,
        min_width:  MIN_WIDTH,
        order:      'popular',
      },
      timeout: 6000,
    });
    return (r.data.hits || []).map(normalizePixabay).filter(isHD);
  } catch (e) {
    console.warn('Pixabay fetch failed:', e.message);
    return [];
  }
}

async function fetchPicsum(page, perPage) {
  try {
    const r = await axios.get('https://picsum.photos/v2/list', {
      params: { page, limit: perPage },
      timeout: 6000,
    });
    return (r.data || []).map(normalizePicsum);
  } catch (e) {
    console.warn('Picsum fetch failed:', e.message);
    return [];
  }
}

// ─── Mix helpers ──────────────────────────────────────────────────────────────

/** Interleave multiple source arrays for even distribution, then full shuffle */
function interleave(...arrays) {
  const result = [];
  const maxLen = Math.max(...arrays.map(a => a.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const arr of arrays) {
      if (i < arr.length) result.push(arr[i]);
    }
  }
  return result;
}

/** Interleave + partial shuffle for organic-feeling mix */
function interleaveAndMix(...arrays) {
  const interleaved = interleave(...arrays);
  // Shuffle the tail 40% so the feed never looks patterned
  const splitAt = Math.floor(interleaved.length * 0.6);
  return [...interleaved.slice(0, splitAt), ...shuffle(interleaved.slice(splitAt))];
}

/** Deduplicate by id, preserving order */
function dedup(images) {
  const seen = new Set();
  return images.filter(img => {
    if (seen.has(img.id)) return false;
    seen.add(img.id);
    return true;
  });
}

// ─── Controllers ──────────────────────────────────────────────────────────────

async function getImages(req, res) {
  const page    = parseInt(req.query.page)     || 1;
  const perPage = parseInt(req.query.per_page) || 30;

  const cacheKey = `browse:${page}:${perPage}`;
  const cached   = cacheGet(cacheKey);
  if (cached) {
    console.log(`[cache hit] ${cacheKey}`);
    return res.json(cached);
  }

  const sharePerSource = Math.ceil(perPage / 3);
  const kw = getKeywordsForPage(page);

  const rawResults = await Promise.allSettled([
    fetchUnsplash(kw[0] || '', page, sharePerSource),
    fetchPexels  (kw[1] || kw[0] || '', page, sharePerSource),
    fetchPixabay (kw[2] || kw[0] || '', page, sharePerSource),
  ]);

  let images = interleaveAndMix(...rawResults.map(r => r.status === 'fulfilled' ? r.value : []));

  if (images.length === 0) images = await fetchPicsum(page, perPage);

  if (images.length === 0) {
    const startId = (page - 1) * perPage;
    images = Array.from({ length: Math.min(perPage, 30) }, (_, i) => {
      const id   = ((startId + i) % 1000) + 1;
      const dims = [[1200, 800], [900, 1200], [1100, 700], [800, 1000]][i % 4];
      return normalizePicsum({ id, width: dims[0], height: dims[1], author: 'Pixora' });
    });
  }

  // Inject uploaded images from our DB at the front of the feed
  try {
    const uploaded = await listImages({ page, perPage });
    // normalize uploaded images to the same shape expected by frontend
    const uploadedNormalized = uploaded.map(img => ({
      id: img.id,
      source: 'upload',
      url: img.url,
      thumb: img.thumb || img.url,
      full: img.full || img.url,
      width: img.width,
      height: img.height,
      description: img.description || '',
      author: null,
      likes: img.likes || 0,
      tags: img.tags || [],
    }));
    images = [...uploadedNormalized, ...images];
  } catch (e) {
    console.warn('Failed to load uploaded images:', e.message);
  }

  const payload = { images, page, total: 30000, source: 'multi' };
  cacheSet(cacheKey, payload);
  res.json(payload);
}

// ─── getRandomizedImages — the heart of dynamic refresh ───────────────────────
async function getRandomizedImages(req, res) {
  // Accepts POST body: { page, per_page, seed, excludeIds[] }
  const page       = parseInt(req.body.page)     || 1;
  const perPage    = parseInt(req.body.per_page) || 60;
  const randomSeed = req.body.seed || Math.random().toString(36).substring(2);
  const excludeIds = new Set(Array.isArray(req.body.excludeIds) ? req.body.excludeIds : []);

  // ── Pagination pages can use cache; page 1 NEVER caches (always fresh) ─────
  if (page > 1) {
    const cacheKey = `randomized:${randomSeed}:${page}:${perPage}`;
    const cached   = cacheGet(cacheKey);
    if (cached) {
      console.log(`[cache hit randomized] ${cacheKey}`);
      return res.json(cached);
    }
  }

  // ── Choose keywords ────────────────────────────────────────────────────────
  // Page 1: always fully random — each browser refresh gets different content
  // Page 2+: seed+page offset so scrolling continues with fresh but consistent batches
  const isFirstPage = page === 1;
  const kwCount     = isFirstPage ? 6 : 4; // More keywords on first load
  const keywords    = isFirstPage
    ? pickRandomKeywords(kwCount)
    : pickPagedKeywords(kwCount, randomSeed, page);

  console.log(`[randomized p${page}] keywords:`, keywords);

  // ── Fan out: multiple queries per source for richer diversity ─────────────
  // We fire N keyword queries per source and merge all results
  const perSourcePerQuery = Math.ceil(perPage / keywords.length);

  const fetchTasks = [];
  for (const kw of keywords) {
    // Stagger pages so we don't always get result-page-1 from every source
    const apiPage = isFirstPage ? 1 : Math.max(1, Math.floor(Math.random() * 3) + 1);
    fetchTasks.push(
      fetchUnsplash(kw, apiPage, perSourcePerQuery),
      fetchPexels  (kw, apiPage, perSourcePerQuery),
      fetchPixabay (kw, apiPage, perSourcePerQuery),
    );
  }

  const rawResults = await Promise.allSettled(fetchTasks);
  const allImages  = settled(rawResults); // flatMap of all fulfilled arrays

  // Deduplicate from the raw combined pool
  let images = dedup(allImages);

  // Filter out recently seen (passed by client)
  images = images.filter(img => !excludeIds.has(img.id));

  // Full shuffle for true randomness in the feed
  images = shuffle(images);

  // ── Fallback chain ─────────────────────────────────────────────────────────
  if (images.length === 0) {
    let picsum = await fetchPicsum(page, perPage);
    picsum = picsum.filter(img => !excludeIds.has(img.id));
    images = shuffle(picsum);
  }

  if (images.length === 0) {
    const seedNum = parseInt(randomSeed.substring(0, 8), 36) || 1;
    images = shuffle(
      Array.from({ length: Math.min(perPage, 60) }, (_, i) => {
        const id   = ((seedNum + i + (page - 1) * perPage) % 1000) + 1;
        const dims = [[1200, 800], [900, 1200], [1100, 700], [800, 1000], [1000, 600], [1300, 800]][i % 6];
        return normalizePicsum({ id, width: dims[0], height: dims[1], author: 'Pixora' });
      })
    );
  }

  // Slice to requested count
  const sliced = images.slice(0, perPage);

  const payload = {
    images: sliced,
    page,
    total:  100000,
    source: 'randomized',
    seed:   randomSeed,
    keywords,
  };

  if (page > 1) {
    cacheSet(`randomized:${randomSeed}:${page}:${perPage}`, payload);
  }

  res.json(payload);
}

// ─── searchImages ─────────────────────────────────────────────────────────────
async function searchImages(req, res) {
  const { q, page = 1, per_page = 30 } = req.query;
  if (!q) return res.status(400).json({ error: 'Search query required' });

  const pg = parseInt(page);
  const pp = parseInt(per_page);

  const cacheKey = `search:${q.toLowerCase()}:${pg}:${pp}`;
  const cached   = cacheGet(cacheKey);
  if (cached) {
    console.log(`[cache hit] ${cacheKey}`);
    return res.json(cached);
  }

  const sharePerSource = Math.ceil(pp / 3);

  const rawResults = await Promise.allSettled([
    fetchUnsplash(q, pg, sharePerSource),
    fetchPexels  (q, pg, sharePerSource),
    fetchPixabay (q, pg, sharePerSource),
  ]);

  let images = interleave(
    ...(rawResults.map(r => r.status === 'fulfilled' ? r.value : []))
  );

  if (images.length === 0) {
    const seed = q.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    images = Array.from({ length: Math.min(pp, 24) }, (_, i) => {
      const id   = ((seed + i + (pg - 1) * pp) % 1000) + 1;
      const dims = [[1200, 800], [900, 1200], [1000, 700], [800, 1000]][i % 4];
      return normalizePicsum({ id, width: dims[0], height: dims[1], author: 'Pixora Search' });
    });
  }

  const payload = { images, page: pg, total: 10000, source: 'multi' };
  cacheSet(cacheKey, payload);
  res.json(payload);
}

function getCategories(req, res) {
  res.json({ categories: CATEGORIES });
}

module.exports = { getImages, getRandomizedImages, searchImages, getCategories };
