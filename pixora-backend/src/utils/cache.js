/**
 * LRU Cache with memory limits and expiration
 * Prevents memory leaks on Azure F1 (165MB RAM)
 */

const MAX_CACHE_SIZE_MB = 20; // 20MB max for Azure F1
const CACHE_TTL_LONG = 15 * 60 * 1000; // 15 min for browse
const CACHE_TTL_SHORT = 5 * 60 * 1000; // 5 min for search

class LRUCache {
  constructor(maxSizeMB = MAX_CACHE_SIZE_MB) {
    this.cache = new Map();
    this.accessOrder = [];
    this.maxSizeBytes = maxSizeMB * 1024 * 1024;
    this.currentSizeBytes = 0;

    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      sets: 0,
    };
  }

  set(key, data, ttlMs = CACHE_TTL_LONG) {
    // Calculate size of data
    const sizeBytes = JSON.stringify(data).length;
    this.stats.sets++;

    // If new entry would exceed limit, evict LRU entries
    while (
      this.currentSizeBytes + sizeBytes > this.maxSizeBytes &&
      this.cache.size > 0
    ) {
      this.evictLRU();
    }

    // If entry exists, remove it from access order
    if (this.cache.has(key)) {
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
      this.currentSizeBytes -= JSON.stringify(
        this.cache.get(key).data
      ).length;
    }

    // Add new entry
    this.cache.set(key, {
      data,
      ttl: Date.now() + ttlMs,
      sizeBytes,
    });
    this.accessOrder.push(key);
    this.currentSizeBytes += sizeBytes;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.ttl) {
      this.cache.delete(key);
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
      this.currentSizeBytes -= entry.sizeBytes;
      this.stats.misses++;
      return null;
    }

    // Update access order (move to end = most recently used)
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    this.accessOrder.push(key);
    this.stats.hits++;
    return entry.data;
  }

  evictLRU() {
    const lruKey = this.accessOrder.shift();
    if (lruKey) {
      const entry = this.cache.get(lruKey);
      this.cache.delete(lruKey);
      this.currentSizeBytes -= entry.sizeBytes;
      this.stats.evictions++;

      console.log(
        `[Cache] LRU eviction: ${lruKey.substring(0, 40)}... ` +
        `(${(entry.sizeBytes / 1024).toFixed(1)}KB)`
      );
    }
  }

  clear() {
    this.cache.clear();
    this.accessOrder = [];
    this.currentSizeBytes = 0;
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(1) : 'N/A';
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      size: `${(this.currentSizeBytes / 1024 / 1024).toFixed(2)}MB`,
      entries: this.cache.size,
      maxSize: `${(this.maxSizeBytes / 1024 / 1024).toFixed(0)}MB`,
    };
  }
}

module.exports = { LRUCache, CACHE_TTL_LONG, CACHE_TTL_SHORT };
