import { describe, it, expect } from 'vitest';
import { loadUserscript } from './_helpers/load.js';

const { LanguageDetector } = loadUserscript();

describe('LanguageDetector — character-set detection', () => {
  describe('script-family positives', () => {
    const cases = [
      ['ja', 'こんにちは世界、今日は'],
      ['ja', 'アニメのおすすめベスト'],
      ['ko', '안녕하세요 여러분 오늘'],
      ['zh', '今天天气真好我们一起'],
      ['ru', 'Привет мир, как дела сегодня'],
      ['uk', 'Привіт усім, як справи сьогодні'],
      ['bg', 'Здравейте всички приятели'],
      ['ar', 'مرحبا بالعالم اليوم جميل'],
      ['fa', 'سلام دوستان امروز روز خوبی است'],
      ['el', 'Καλημέρα σε όλους σήμερα'],
      ['he', 'שלום לכולם היום יום נפלא'],
      ['th', 'สวัสดีทุกคนวันนี้อากาศดี'],
      ['hi', 'नमस्ते दोस्तों आज कैसे हैं'],
      ['ta', 'வணக்கம் நண்பர்களே இன்று'],
      ['te', 'నమస్కారం అందరికీ ఈరోజు'],
      ['kn', 'ನಮಸ್ಕಾರ ಎಲ್ಲರಿಗೂ ಇಂದು'],
      ['ml', 'നമസ്കാരം എല്ലാവർക്കും ഇന്ന്'],
      ['gu', 'નમસ્તે મિત્રો આજે'],
      ['bn', 'সবাইকে স্বাগতম আজকে'],
      ['hy', 'Բարև ձեզ բարեկամներ'],
      ['ka', 'გამარჯობა ყველას დღეს'],
      ['am', 'ሰላም ሁላችሁ ዛሬ'],
    ];
    for (const [lang, text] of cases) {
      it(`positive: ${lang} text matches when ${lang} is the target`, () => {
        expect(LanguageDetector.detect(text, [lang])).toBe(true);
      });
    }
  });

  describe('script-family negatives (different script in target)', () => {
    const cases = [
      ['ja', 'Привет мир сегодня'],
      ['ko', '今天天气真好我们'],
      ['ru', 'こんにちは世界、今日は'],
      ['ar', 'Привет мир сегодня'],
      ['hi', 'Καλημέρα σε όλους'],
      ['th', 'こんにちは世界'],
    ];
    for (const [lang, text] of cases) {
      it(`negative: text from another script does not match target ${lang}`, () => {
        expect(LanguageDetector.detect(text, [lang])).toBe(false);
      });
    }
  });

  describe('Latin text → null (defer to trigram detector)', () => {
    it('returns null for Latin text when target is a Latin language', () => {
      expect(LanguageDetector.detect('Hello world from London', ['en'])).toBe(null);
    });

    it('returns null for Latin text with multiple Latin targets', () => {
      expect(LanguageDetector.detect('Hola mundo desde Madrid', ['en', 'es'])).toBe(null);
    });

    it('returns false for Latin text when all targets are non-Latin', () => {
      expect(LanguageDetector.detect('Hello world from London', ['ru', 'ja'])).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns null for empty string', () => {
      expect(LanguageDetector.detect('', ['en'])).toBe(null);
    });

    it('returns null for whitespace-only / too-short input', () => {
      expect(LanguageDetector.detect('  ', ['en'])).toBe(null);
      expect(LanguageDetector.detect('a', ['en'])).toBe(null);
    });

    it('returns false when targetLanguages is empty (no target to defer to)', () => {
      // No targets specified → cannot claim a match for anything
      expect(LanguageDetector.detect('Hello world from London', [])).toBe(false);
      expect(LanguageDetector.detect('Привет мир сегодня', [])).toBe(false);
    });

    it('handles mixed-script text where the target script is present', () => {
      // Hiragana + some Latin → ja still matches because hiragana characters are present
      expect(LanguageDetector.detect('Anime こんにちは fans', ['ja'])).toBe(true);
    });
  });

  describe('exclusion patterns', () => {
    it('CJK exclusion: ja text dominated by Hangul is rejected when ko is not in targets', () => {
      // Mostly Hangul with a single hiragana char — ja validator hits but exclusion ratio (hangul/total) > 0.5
      const text = '안녕하세요 여러분 오늘 こ';
      expect(LanguageDetector.detect(text, ['ja'])).toBe(false);
    });

    it('CJK exclusion: ja text with Hangul is NOT excluded if ko is also a target', () => {
      const text = '안녕하세요 여러분 오늘 こ';
      // ja matches, but exclusion is suppressed because ko is in targets; still, ja matches via hiragana char
      expect(LanguageDetector.detect(text, ['ja', 'ko'])).toBe(true);
    });

    it('CJK exclusion: ko text dominated by Hiragana is rejected when ja is not in targets', () => {
      const text = 'こんにちは世界今日は 안';
      expect(LanguageDetector.detect(text, ['ko'])).toBe(false);
    });

    it('hasLanguageCharacters returns true for languages without a validator', () => {
      expect(LanguageDetector.hasLanguageCharacters('Hello world', 'en')).toBe(true);
      expect(LanguageDetector.hasLanguageCharacters('Hello world', 'tr')).toBe(true);
    });

    it('hasLanguageCharacters returns true/false correctly for scripts with validators', () => {
      expect(LanguageDetector.hasLanguageCharacters('Привет', 'ru')).toBe(true);
      expect(LanguageDetector.hasLanguageCharacters('Hello', 'ru')).toBe(false);
    });
  });
});
