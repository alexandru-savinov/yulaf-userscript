import { describe, it, expect, beforeEach } from 'vitest';
import { loadUserscript } from './_helpers/load.js';

const { LanguageService, Constants } = loadUserscript();

describe('LanguageService — caching layer', () => {
  beforeEach(() => {
    LanguageService.clearCache();
    LanguageService.selectedLanguages = [];
    LanguageService.strictMode = false;
    // Reset cacheConfig to defaults in case a prior test mutated it
    LanguageService.cacheConfig = {
      maxSize: Constants.CACHE.MAX_SIZE,
      ttl: Constants.CACHE.TTL,
      evictionRatio: Constants.CACHE.EVICTION_RATIO,
    };
  });

  describe('cache key normalisation', () => {
    it('normalises whitespace and case to produce the same key', () => {
      const k1 = LanguageService.createCacheKey('Hello World', ['en'], false);
      const k2 = LanguageService.createCacheKey('  hello   world  ', ['en'], false);
      expect(k1).toBe(k2);
    });

    it('strips ASCII punctuation but preserves apostrophes and hyphens', () => {
      const k1 = LanguageService.createCacheKey("don't-stop", ['en'], false);
      const k2 = LanguageService.createCacheKey("don't-stop!", ['en'], false);
      expect(k1).toBe(k2);
    });

    it('orders languages so different orderings hash to the same key', () => {
      const k1 = LanguageService.createCacheKey('hello world', ['en', 'ru'], false);
      const k2 = LanguageService.createCacheKey('hello world', ['ru', 'en'], false);
      expect(k1).toBe(k2);
    });

    it('strict and non-strict mode produce different keys', () => {
      const k1 = LanguageService.createCacheKey('hello world', ['en'], false);
      const k2 = LanguageService.createCacheKey('hello world', ['en'], true);
      expect(k1).not.toBe(k2);
    });
  });

  describe('cache hit/miss', () => {
    it('returns the same value reference on repeated hits', () => {
      const result = { detected: 'ru' };
      LanguageService.setCachedResult('k1', result);
      expect(LanguageService.getCachedResult('k1')).toBe(result);
      expect(LanguageService.getCachedResult('k1')).toBe(result);
    });

    it('returns undefined on miss and increments miss counter', () => {
      expect(LanguageService.getCachedResult('does-not-exist')).toBe(undefined);
      expect(LanguageService.cacheStats.misses).toBeGreaterThan(0);
    });

    it('increments hit counter on hit', () => {
      LanguageService.setCachedResult('k1', true);
      const before = LanguageService.cacheStats.hits;
      LanguageService.getCachedResult('k1');
      expect(LanguageService.cacheStats.hits).toBe(before + 1);
    });

    it('caches falsy result values (null, false) without treating them as misses', () => {
      LanguageService.setCachedResult('k-null', null);
      LanguageService.setCachedResult('k-false', false);
      expect(LanguageService.getCachedResult('k-null')).toBe(null);
      expect(LanguageService.getCachedResult('k-false')).toBe(false);
    });
  });

  describe('cache eviction at size cap', () => {
    it('evicts a fraction of oldest entries (FIFO) when over the cap', () => {
      LanguageService.cacheConfig.maxSize = 10;
      LanguageService.cacheConfig.evictionRatio = 0.2;

      for (let i = 0; i < 10; i++) {
        LanguageService.setCachedResult(`k${i}`, i);
      }
      expect(LanguageService.textCache.size).toBe(10);

      // Triggering one more insert when at-cap evicts ~20% (2 entries) before adding
      LanguageService.setCachedResult('k10', 10);
      expect(LanguageService.textCache.size).toBeLessThanOrEqual(10);
      expect(LanguageService.textCache.has('k10')).toBe(true);
      // Oldest two entries should be gone
      expect(LanguageService.textCache.has('k0')).toBe(false);
      expect(LanguageService.textCache.has('k1')).toBe(false);
      // Newer entries still present
      expect(LanguageService.textCache.has('k9')).toBe(true);
    });

    it('clearCache resets size and stats', () => {
      LanguageService.setCachedResult('k1', 1);
      LanguageService.setCachedResult('k2', 2);
      expect(LanguageService.textCache.size).toBe(2);
      LanguageService.clearCache();
      expect(LanguageService.textCache.size).toBe(0);
      expect(LanguageService.cacheStats.hits).toBe(0);
      expect(LanguageService.cacheStats.misses).toBe(0);
    });
  });

  describe('cache TTL expiry', () => {
    it('treats entries older than ttl as a miss and removes them', () => {
      LanguageService.cacheConfig.ttl = 1; // 1 ms
      LanguageService.setCachedResult('k1', 'old');
      // Force the entry to look ancient
      const entry = LanguageService.textCache.get('k1');
      entry.timestamp = Date.now() - 1000;
      expect(LanguageService.getCachedResult('k1')).toBe(undefined);
      expect(LanguageService.textCache.has('k1')).toBe(false);
    });
  });

  describe('setLanguages / setStrictMode', () => {
    it('clears the cache when selectedLanguages changes', () => {
      LanguageService.setCachedResult('k1', true);
      LanguageService.setLanguages(['en']);
      expect(LanguageService.textCache.size).toBe(0);
      expect(LanguageService.selectedLanguages).toEqual(['en']);
    });

    it('does NOT clear the cache when setLanguages is called with an equivalent list', () => {
      LanguageService.setLanguages(['en']);
      LanguageService.setCachedResult('k1', true);
      LanguageService.setLanguages(['en']);
      expect(LanguageService.textCache.size).toBe(1);
    });

    it('filters unknown language codes from the input', () => {
      LanguageService.setLanguages(['en', 'xx-bogus', 'ru']);
      expect(LanguageService.selectedLanguages).toEqual(['en', 'ru']);
    });

    it('clears cache when strictMode changes', () => {
      LanguageService.setCachedResult('k1', true);
      LanguageService.setStrictMode(true);
      expect(LanguageService.textCache.size).toBe(0);
      expect(LanguageService.strictMode).toBe(true);
    });
  });

  describe('detect() integrates with the detector and cache', () => {
    it('returns true (no filtering) when no languages selected', () => {
      LanguageService.setLanguages([]);
      expect(LanguageService.detect('Привет мир сегодня')).toBe(true);
    });

    it('caches the detector result and returns the cached value on a second call', () => {
      LanguageService.setLanguages(['ru']);
      const text = 'Привет мир сегодня';

      const r1 = LanguageService.detect(text);
      const hitsBefore = LanguageService.cacheStats.hits;
      const r2 = LanguageService.detect(text);
      expect(r1).toBe(r2);
      expect(LanguageService.cacheStats.hits).toBe(hitsBefore + 1);
    });

    it('returns null for empty/short input without caching', () => {
      LanguageService.setLanguages(['en']);
      expect(LanguageService.detect('')).toBe(null);
      expect(LanguageService.detect('a')).toBe(null);
      expect(LanguageService.textCache.size).toBe(0);
    });
  });
});
