/**
 * Language Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Import dependencies first
import '../src/content/services/language-detector.js';
import '../src/content/services/language-service.js';

describe('LanguageService', () => {
  let service;

  beforeEach(() => {
    service = globalThis.LanguageService;
    service.clearCache();
    service.selectedLanguages = [];
    service.strictMode = false;

    // Add detection config to YT_FILTER_CONFIG
    globalThis.YT_FILTER_CONFIG.detection = {
      minLength: 3
    };
  });

  describe('setLanguages', () => {
    it('should set valid languages', () => {
      service.setLanguages(['en', 'tr']);
      expect(service.selectedLanguages).toEqual(['en', 'tr']);
    });

    it('should filter out invalid language codes', () => {
      service.setLanguages(['en', 'invalid', 'ja']);
      expect(service.selectedLanguages).toEqual(['en', 'ja']);
    });

    it('should return empty array for non-array input', () => {
      service.setLanguages('en');
      expect(service.selectedLanguages).toEqual([]);
    });

    it('should clear cache when languages change', () => {
      service.setCachedResult('test-key', true);
      expect(service.textCache.size).toBe(1);

      service.setLanguages(['en']);
      expect(service.textCache.size).toBe(0);
    });
  });

  describe('setStrictMode', () => {
    it('should update strict mode', () => {
      service.setStrictMode(true);
      expect(service.strictMode).toBe(true);
    });

    it('should clear cache when strict mode changes', () => {
      service.setCachedResult('test-key', true);
      expect(service.textCache.size).toBe(1);

      service.setStrictMode(true);
      expect(service.textCache.size).toBe(0);
    });

    it('should not clear cache if strict mode is the same', () => {
      service.strictMode = true;
      service.setCachedResult('test-key', true);

      service.setStrictMode(true);
      expect(service.textCache.size).toBe(1);
    });
  });

  describe('normalizeText', () => {
    it('should trim and lowercase text', () => {
      expect(service.normalizeText('  Hello World  ')).toBe('hello world');
    });

    it('should collapse multiple spaces', () => {
      expect(service.normalizeText('hello    world')).toBe('hello world');
    });

    it('should remove special characters but keep unicode', () => {
      expect(service.normalizeText('hello! world?')).toBe('hello world');
      expect(service.normalizeText('こんにちは')).toBe('こんにちは');
    });
  });

  describe('createCacheKey', () => {
    it('should create consistent cache keys', () => {
      const key1 = service.createCacheKey('Hello World', ['en', 'tr'], false);
      const key2 = service.createCacheKey('Hello World', ['tr', 'en'], false);

      // Languages should be sorted, so keys should be equal
      expect(key1).toBe(key2);
    });

    it('should differentiate strict and normal mode', () => {
      const strictKey = service.createCacheKey('Hello', ['en'], true);
      const normalKey = service.createCacheKey('Hello', ['en'], false);

      expect(strictKey).not.toBe(normalKey);
      expect(strictKey).toContain('strict');
      expect(normalKey).toContain('normal');
    });
  });

  describe('cache operations', () => {
    it('should cache and retrieve results', () => {
      service.setCachedResult('test-key', true);
      expect(service.getCachedResult('test-key')).toBe(true);
    });

    it('should track cache hits', () => {
      service.setCachedResult('test-key', true);
      service.getCachedResult('test-key');

      expect(service.cacheStats.hits).toBe(1);
    });

    it('should track cache misses', () => {
      service.getCachedResult('non-existent-key');

      expect(service.cacheStats.misses).toBe(1);
    });

    it('should return null for expired cache entries', () => {
      // Set a cached result with old timestamp
      service.textCache.set('old-key', {
        result: true,
        timestamp: Date.now() - (31 * 60 * 1000) // 31 minutes ago
      });

      expect(service.getCachedResult('old-key')).toBeNull();
    });

    it('should cleanup when max size is reached', () => {
      // Fill cache to max size
      for (let i = 0; i < service.cacheConfig.maxSize; i++) {
        service.setCachedResult(`key-${i}`, true);
      }

      // Add one more
      service.setCachedResult('overflow-key', true);

      // Should have cleaned up some entries
      expect(service.textCache.size).toBeLessThan(service.cacheConfig.maxSize);
    });
  });

  describe('getCacheStats', () => {
    it('should return correct statistics', () => {
      service.setCachedResult('key1', true);
      service.setCachedResult('key2', false);
      service.getCachedResult('key1'); // hit
      service.getCachedResult('key3'); // miss

      const stats = service.getCacheStats();

      expect(stats.size).toBe(2);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.total).toBe(2);
      expect(stats.hitRate).toBe('50.0%');
    });

    it('should return 0% hit rate when no requests', () => {
      const stats = service.getCacheStats();
      expect(stats.hitRate).toBe('0%');
    });
  });

  describe('detectLanguage', () => {
    beforeEach(() => {
      service.setLanguages(['en']);
    });

    it('should return false for empty text', async () => {
      expect(await service.detectLanguage('')).toBe(false);
    });

    it('should return false for short text', async () => {
      expect(await service.detectLanguage('ab')).toBe(false);
    });

    it('should return true when no languages are selected', async () => {
      service.selectedLanguages = [];
      expect(await service.detectLanguage('Hello World')).toBe(true);
    });

    it('should use cache for repeated calls', async () => {
      await service.detectLanguage('Hello World test');
      const statsAfterFirst = { ...service.cacheStats };

      await service.detectLanguage('Hello World test');
      const statsAfterSecond = service.cacheStats;

      expect(statsAfterSecond.hits).toBe(statsAfterFirst.hits + 1);
    });

    it('should detect matching language', async () => {
      service.setLanguages(['ja']);
      const result = await service.detectLanguage('こんにちは世界です');
      expect(result).toBe(true);
    });

    it('should reject non-matching language', async () => {
      service.setLanguages(['ja']);
      const result = await service.detectLanguage('Hello World this is English text');
      expect(result).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('should clear all cached entries', () => {
      service.setCachedResult('key1', true);
      service.setCachedResult('key2', false);

      service.clearCache();

      expect(service.textCache.size).toBe(0);
    });

    it('should reset cache statistics', () => {
      service.getCachedResult('miss');
      service.setCachedResult('key', true);
      service.getCachedResult('key');

      service.clearCache();

      expect(service.cacheStats.hits).toBe(0);
      expect(service.cacheStats.misses).toBe(0);
    });
  });
});
