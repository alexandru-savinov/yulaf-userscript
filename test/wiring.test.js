import { describe, it, expect } from 'vitest';
import { loadUserscript } from './_helpers/load.js';

const yulaf = loadUserscript();

describe('module.exports shim', () => {
  it('exposes the expected internals to vitest', () => {
    expect(yulaf).toBeDefined();
    for (const name of [
      'DOMService',
      'LanguageDetector',
      'LanguageService',
      'FilterService',
      'Controller',
      'Config',
      'Constants',
    ]) {
      expect(yulaf, `missing export: ${name}`).toHaveProperty(name);
    }
  });

  it('Constants.VERSION is a non-empty string', () => {
    expect(typeof yulaf.Constants.VERSION).toBe('string');
    expect(yulaf.Constants.VERSION.length).toBeGreaterThan(0);
  });

  it('Config.selectors.video is non-empty', () => {
    expect(Array.isArray(yulaf.Config.selectors.video)).toBe(true);
    expect(yulaf.Config.selectors.video.length).toBeGreaterThan(0);
  });
});
