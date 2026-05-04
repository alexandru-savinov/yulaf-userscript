import { describe, it, expect } from 'vitest';
import { loadUserscript } from './_helpers/load.js';

const { TrigramDetector } = loadUserscript();

const SAMPLES = {
  en: [
    'Things to think about and learn together',
    'How to find the answer to that question',
    'The best way to learn something new every day',
  ],
  es: [
    'Como aprender espanol de la mejor manera',
    'Las mejores ideas para la cocina de casa',
    'La importancia de la educacion en la vida',
  ],
  fr: [
    'Les meilleures idees de la semaine pour vous',
    'Comment apprendre la grammaire et la conjugaison',
    'Une journee parfaite a la campagne avec des amis',
  ],
  de: [
    'Die schoenen Ideen und Tipps der Woche',
    'Wie ich richtig Deutsch lernen kann ohne Stress',
    'Das beste Rezept fuer einen Apfelkuchen',
  ],
  tr: [
    'Her gun bir bardak su icmek saglik icin onemli',
    'Bilgi ve haberleri her gun takip edebilirsiniz',
    'Hayatta basari icin calismak gerekiyor',
  ],
  pt: [
    'A construcao de uma casa e uma decisao importante',
    'As acoes do governo em relacao a economia',
  ],
  it: [
    'La storia di un viaggio in Italia con la famiglia',
    'Le ragioni di una decisione importante per tutti',
  ],
  nl: [
    'De beste manier om Nederlands te leren',
    'Het verhaal van een reis door Nederland',
    'Een goede dag begint met een lekker ontbijt',
  ],
};

describe('TrigramDetector — Latin language identification', () => {
  for (const [code, titles] of Object.entries(SAMPLES)) {
    describe(`detects ${code}`, () => {
      for (const title of titles) {
        it(`identifies "${title}" as ${code}`, () => {
          const result = TrigramDetector.detect(title);
          expect(result).not.toBeNull();
          expect(result.lang).toBe(code);
          expect(result.confidence).toBeGreaterThan(0);
          expect(result.confidence).toBeLessThanOrEqual(1);
        });
      }
    });
  }

  describe('edge cases', () => {
    it('returns null for empty string', () => {
      expect(TrigramDetector.detect('')).toBeNull();
    });

    it('returns null for whitespace-only', () => {
      expect(TrigramDetector.detect('     ')).toBeNull();
    });

    it('returns null for input shorter than minLength', () => {
      expect(TrigramDetector.detect('hi')).toBeNull();
      expect(TrigramDetector.detect('short')).toBeNull();
    });

    it('returns null for digits-only input', () => {
      expect(TrigramDetector.detect('1234567890')).toBeNull();
    });

    it('returns null for non-string input', () => {
      expect(TrigramDetector.detect(null)).toBeNull();
      expect(TrigramDetector.detect(undefined)).toBeNull();
      expect(TrigramDetector.detect(42)).toBeNull();
    });

    it('returns null for low-confidence ambiguous gibberish', () => {
      // Random consonant clusters with no real trigram coverage in any language.
      expect(TrigramDetector.detect('xkcd zzz qqq vvv mmm')).toBeNull();
    });
  });

  describe('result shape', () => {
    it('returns { lang, confidence } with confidence in [0, 1]', () => {
      const r = TrigramDetector.detect('The best way to learn something new every day');
      expect(r).toMatchObject({
        lang: expect.any(String),
        confidence: expect.any(Number),
      });
      expect(r.confidence).toBeGreaterThan(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    });
  });
});

describe('LanguageService — trigram fallback for Latin text', () => {
  // Reload the module so we get a fresh LanguageService with empty cache.
  const { LanguageService } = loadUserscript();

  it('hides English text when the user only allows Spanish', () => {
    LanguageService.clearCache();
    LanguageService.setLanguages(['es']);
    const result = LanguageService.detect('How to find the answer to that question');
    expect(result).toBe(false);
  });

  it('keeps English text when the user allows English', () => {
    LanguageService.clearCache();
    LanguageService.setLanguages(['en']);
    const result = LanguageService.detect('How to find the answer to that question');
    expect(result).toBe(true);
  });

  it('keeps French text when the user allows French', () => {
    LanguageService.clearCache();
    LanguageService.setLanguages(['fr']);
    const result = LanguageService.detect('Comment apprendre la grammaire et la conjugaison');
    expect(result).toBe(true);
  });
});
