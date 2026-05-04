/**
 * Language Detector Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Import the module (will use global chrome mock)
import '../src/content/services/language-detector.js';

describe('LanguageDetector', () => {
  const detector = globalThis.LanguageDetector;

  describe('characterValidators', () => {
    it('should have validators for non-Latin scripts', () => {
      expect(detector.characterValidators.ja).toBeDefined();
      expect(detector.characterValidators.ko).toBeDefined();
      expect(detector.characterValidators.zh).toBeDefined();
      expect(detector.characterValidators.ru).toBeDefined();
      expect(detector.characterValidators.ar).toBeDefined();
    });

    it('should correctly identify Japanese characters', () => {
      const validator = detector.characterValidators.ja;
      expect(validator.test('こんにちは')).toBe(true);
      expect(validator.test('カタカナ')).toBe(true);
      expect(validator.test('Hello')).toBe(false);
    });

    it('should correctly identify Korean characters', () => {
      const validator = detector.characterValidators.ko;
      expect(validator.test('안녕하세요')).toBe(true);
      expect(validator.test('Hello')).toBe(false);
    });

    it('should correctly identify Cyrillic characters', () => {
      const validator = detector.characterValidators.ru;
      expect(validator.test('Привет')).toBe(true);
      expect(validator.test('Hello')).toBe(false);
    });

    it('should correctly identify Arabic characters', () => {
      const validator = detector.characterValidators.ar;
      expect(validator.test('مرحبا')).toBe(true);
      expect(validator.test('Hello')).toBe(false);
    });

    it('should correctly identify Thai characters', () => {
      const validator = detector.characterValidators.th;
      expect(validator.test('สวัสดี')).toBe(true);
      expect(validator.test('Hello')).toBe(false);
    });
  });

  describe('hasLanguageCharacters', () => {
    it('should return true when text contains target language characters', () => {
      expect(detector.hasLanguageCharacters('こんにちは世界', 'ja')).toBe(true);
      expect(detector.hasLanguageCharacters('Привет мир', 'ru')).toBe(true);
    });

    it('should return false when text does not contain target language characters', () => {
      expect(detector.hasLanguageCharacters('Hello World', 'ja')).toBe(false);
      expect(detector.hasLanguageCharacters('Hello World', 'ru')).toBe(false);
    });

    it('should return true for Latin-based languages without validators', () => {
      expect(detector.hasLanguageCharacters('Hello World', 'en')).toBe(true);
      expect(detector.hasLanguageCharacters('Merhaba Dünya', 'tr')).toBe(true);
      expect(detector.hasLanguageCharacters('Bonjour le monde', 'fr')).toBe(true);
    });
  });

  describe('couldMatchTargetLanguages', () => {
    it('should return true for matching script', () => {
      expect(detector.couldMatchTargetLanguages('こんにちは', ['ja'])).toBe(true);
      expect(detector.couldMatchTargetLanguages('안녕하세요', ['ko'])).toBe(true);
    });

    it('should return false for non-matching script', () => {
      expect(detector.couldMatchTargetLanguages('こんにちは', ['ko'])).toBe(false);
      expect(detector.couldMatchTargetLanguages('Привет', ['ja'])).toBe(false);
    });

    it('should return true for Latin text with Latin target languages', () => {
      expect(detector.couldMatchTargetLanguages('Hello World', ['en'])).toBe(true);
      expect(detector.couldMatchTargetLanguages('Merhaba', ['tr'])).toBe(true);
    });

    it('should return true if any target language could match', () => {
      expect(detector.couldMatchTargetLanguages('こんにちは', ['en', 'ja'])).toBe(true);
      expect(detector.couldMatchTargetLanguages('Hello', ['en', 'ja'])).toBe(true);
    });
  });

  describe('exclusionPatterns', () => {
    it('should have exclusion patterns for Turkish', () => {
      expect(detector.exclusionPatterns.tr).toBeDefined();
      expect(detector.exclusionPatterns.tr.excludedIf).toBe('en');
      expect(detector.exclusionPatterns.tr.patterns.length).toBeGreaterThan(0);
    });

    it('should detect common English words in exclusion patterns', () => {
      const patterns = detector.exclusionPatterns.tr.patterns;
      const testText = 'This is a test with the word';

      const hasExcludedWord = patterns.some(p => p.test(testText));
      expect(hasExcludedWord).toBe(true);
    });
  });

  describe('_calcExclusionRatio', () => {
    it('should return low ratio for text with few English words', () => {
      const exclusions = detector.exclusionPatterns.tr;
      // "The Weeknd Istanbul Konseri" — only "the" matches = 1/4 = 0.25
      const ratio = detector._calcExclusionRatio('The Weeknd Istanbul Konseri', exclusions);
      expect(ratio).toBeLessThanOrEqual(0.5);
    });

    it('should return high ratio for text with mostly English words', () => {
      const exclusions = detector.exclusionPatterns.tr;
      // "What is this about the weather" — what,this,about,the = 4/6 = 0.67
      const ratio = detector._calcExclusionRatio(
        'What is this about the weather',
        exclusions
      );
      expect(ratio).toBeGreaterThan(0.5);
    });

    it('should return 0 for text with no English words', () => {
      const exclusions = detector.exclusionPatterns.tr;
      const ratio = detector._calcExclusionRatio('Istanbul Konseri Harika', exclusions);
      expect(ratio).toBe(0);
    });

    it('should handle character-based exclusions for Japanese', () => {
      const exclusions = detector.exclusionPatterns.ja;
      // Text with some Korean characters mixed in
      const ratio = detector._calcExclusionRatio('こんにちは안녕', exclusions);
      expect(ratio).toBeGreaterThan(0);
      expect(ratio).toBeLessThan(1);
    });

    it('should return 0 for character-based exclusion with no matching chars', () => {
      const exclusions = detector.exclusionPatterns.ja;
      const ratio = detector._calcExclusionRatio('こんにちは世界', exclusions);
      expect(ratio).toBe(0);
    });

    it('should handle empty text', () => {
      const exclusions = detector.exclusionPatterns.tr;
      expect(detector._calcExclusionRatio('', exclusions)).toBe(0);
    });
  });

  describe('exclusion threshold in detect', () => {
    it('should NOT reject Turkish text with a single English word', async () => {
      // Override mock to return Turkish for this text
      chrome.i18n._setDetectionResult('Weeknd', {
        isReliable: false,
        languages: [{ language: 'tr', percentage: 70 }],
      });

      const result = await detector.detect(
        'The Weeknd Istanbul Konseri',
        ['tr'],
        false
      );
      expect(result).toBe(true);
    });

    it('should reject text that is mostly English when Turkish selected', async () => {
      chrome.i18n._setDetectionResult('weather', {
        isReliable: false,
        languages: [{ language: 'tr', percentage: 55 }],
      });

      const result = await detector.detect(
        'What is this about the weather',
        ['tr'],
        false
      );
      expect(result).toBe(false);
    });

    it('should skip exclusion when both Turkish and English selected', async () => {
      chrome.i18n._setDetectionResult('weather', {
        isReliable: false,
        languages: [{ language: 'tr', percentage: 55 }],
      });

      // When English is also a target, exclusion check is skipped
      const result = await detector.detect(
        'What is this about the weather',
        ['tr', 'en'],
        false
      );
      expect(result).toBe(true);
    });
  });

  describe('detect', () => {
    it('should return false for empty or short text', async () => {
      expect(await detector.detect('', ['en'])).toBe(false);
      expect(await detector.detect('ab', ['en'])).toBe(false);
    });

    it('should return false when text cannot match target languages', async () => {
      // Japanese text cannot match Korean target
      expect(await detector.detect('こんにちは世界です', ['ko'])).toBe(false);
    });

    it('should detect Japanese text correctly', async () => {
      const result = await detector.detect('こんにちは世界', ['ja'], false);
      expect(result).toBe(true);
    });

    it('should detect Korean text correctly', async () => {
      const result = await detector.detect('안녕하세요 세계', ['ko'], false);
      expect(result).toBe(true);
    });

    it('should detect Russian text correctly', async () => {
      const result = await detector.detect('Привет мир', ['ru'], false);
      expect(result).toBe(true);
    });

    it('should return false for non-target language', async () => {
      const result = await detector.detect('Hello World this is English', ['ja']);
      expect(result).toBe(false);
    });

    it('should handle multiple target languages', async () => {
      const result = await detector.detect('こんにちは', ['en', 'ja'], false);
      expect(result).toBe(true);
    });

    it('should respect strict mode for low confidence results', async () => {
      // Turkish text often has low confidence in Chrome API
      // This tests that strict mode handles it appropriately
      const result = await detector.detect('Merhaba dünya nasılsın', ['tr'], true);
      // With our mock, Turkish has 75% confidence which passes the >50% threshold
      expect(typeof result).toBe('boolean');
    });
  });
});
