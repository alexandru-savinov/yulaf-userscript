/**
 * @file Language service with caching, normalization and detection.
 * Wraps LanguageDetector with a TTL cache to avoid repeated API calls.
 * @global
 */
window.LanguageService = {
  /** @type {string[]} Currently selected language codes */
  selectedLanguages: [],
  /** @type {boolean} Whether strict mode is enabled */
  strictMode: false,

  // 🔹 Cache & stats
  textCache: new Map(),
  cacheStats: { hits: 0, misses: 0 },

  cacheConfig: {
    maxSize: window.YT_FILTER_CONSTANTS?.CACHE?.MAX_SIZE || 1000,
    ttl: window.YT_FILTER_CONSTANTS?.CACHE?.TTL || 30 * 60 * 1000,
    cleanupInterval: window.YT_FILTER_CONSTANTS?.CACHE?.CLEANUP_INTERVAL || 5 * 60 * 1000,
  },

  init() {
    this.clearCache();
    this.startCacheCleanup();
  },

  setLanguages(langCodes) {
    const valid = Array.isArray(langCodes)
      ? [...new Set(langCodes.filter(code => window.YT_FILTER_CONFIG.languages[code]))]
      : [];

    if (
      valid.length !== this.selectedLanguages.length ||
      valid.some((code, i) => code !== this.selectedLanguages[i])
    ) {
      this.clearCache();
      this.selectedLanguages = valid;
    }
    return true;
  },

  setStrictMode(enabled) {
    if (this.strictMode !== enabled) {
      this.clearCache();
      this.strictMode = enabled;
    }
  },

  // 🔹 Normalization helpers
  normalizeText(text) {
    return text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ') // collapse multiple spaces
      .replace(/[^\w\s\u0080-\uFFFF'-]/g, ''); // strip special characters (preserve apostrophes and hyphens)
  },

  createCacheKey(text, langs, strict) {
    const sortedLangs = [...langs].sort().join(',');
    return `${this.normalizeText(text)}|${sortedLangs}|${strict ? 'strict' : 'normal'}`;
  },

  // 🔹 Cache ops
  getCachedResult(key) {
    const entry = this.textCache.get(key);
    if (!entry) {
      this.cacheStats.misses++;
      return null;
    }

    if (Date.now() - entry.timestamp > this.cacheConfig.ttl) {
      this.textCache.delete(key);
      this.cacheStats.misses++;
      return null;
    }

    this.cacheStats.hits++;
    return entry.result;
  },

  setCachedResult(key, result) {
    if (this.textCache.size >= this.cacheConfig.maxSize) {
      this.cleanupOldEntries();
    }
    this.textCache.set(key, { result, timestamp: Date.now() });
  },

  cleanupOldEntries() {
    const now = Date.now();

    // Remove expired entries
    for (const [key, val] of this.textCache.entries()) {
      if (now - val.timestamp > this.cacheConfig.ttl) {
        this.textCache.delete(key);
      }
    }

    // Still too large → evict oldest entries via FIFO (Map preserves insertion order)
    if (this.textCache.size >= this.cacheConfig.maxSize) {
      const evictCount = Math.floor(
        this.cacheConfig.maxSize * (window.YT_FILTER_CONSTANTS?.CACHE?.EVICTION_RATIO || 0.2)
      );
      let removed = 0;
      for (const key of this.textCache.keys()) {
        if (removed >= evictCount) break;
        this.textCache.delete(key);
        removed++;
      }
    }
  },

  startCacheCleanup() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = setInterval(
      () => this.cleanupOldEntries(),
      this.cacheConfig.cleanupInterval
    );
  },

  clearCache() {
    this.textCache.clear();
    this.cacheStats = { hits: 0, misses: 0 };
  },

  getCacheStats() {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = total > 0 ? ((this.cacheStats.hits / total) * 100).toFixed(1) : 0;

    return {
      size: this.textCache.size,
      hits: this.cacheStats.hits,
      misses: this.cacheStats.misses,
      total,
      hitRate: `${hitRate}%`,
    };
  },

  // Main language detection
  async detectLanguage(text) {
    if (!text || text.length < window.YT_FILTER_CONFIG.detection.minLength) return false;
    // No language selected = show all videos (no filtering)
    if (this.selectedLanguages.length === 0) return true;

    const key = this.createCacheKey(text, this.selectedLanguages, this.strictMode);

    const cached = this.getCachedResult(key);
    if (cached !== null) return cached;

    try {
      const result = await window.LanguageDetector.detect(
        text,
        this.selectedLanguages,
        this.strictMode
      );
      this.setCachedResult(key, result);
      return result;
    } catch (err) {
      console.warn('[YuLaF] Language detection failed:', err.message || err);
      this.setCachedResult(key, false);
      return false;
    }
  },
};

// Initialize on first load
if (typeof window !== 'undefined') {
  window.LanguageService.init();

  window.addEventListener('beforeunload', () => {
    if (window.LanguageService.cleanupTimer) clearInterval(window.LanguageService.cleanupTimer);
  });
}
