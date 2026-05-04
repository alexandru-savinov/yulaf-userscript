/**
 * Verifies that constants-bg.js (ES module for service worker)
 * stays in sync with constants.js (non-module for content scripts).
 *
 * MV3 forces this duplication: content scripts can't use ES modules,
 * service workers can't use window globals. This test catches drift.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  EXTENSION_ID,
  SHIELDS_IO_BASE,
  BADGE_COLOR_ON,
  BADGE_COLOR_OFF,
  BADGE_TEXT_COLOR,
  BADGE_FALLBACK_DARK,
  FETCH_TIMEOUT,
  WELCOME_PAGE,
  DEFAULT_SETTINGS,
} from '../src/common/constants-bg.js';

describe('constants-bg.js ↔ constants.js sync', () => {
  let C;

  beforeAll(() => {
    // Execute constants.js in a fresh context to get real values
    const code = readFileSync(resolve(__dirname, '../src/common/constants.js'), 'utf-8');
    const fakeSelf = {};
    const fn = new Function('window', code + '\nreturn window.YT_FILTER_CONSTANTS;');
    C = fn(fakeSelf);
  });

  it('EXTENSION_ID matches', () => {
    expect(EXTENSION_ID).toBe(C.EXTENSION_ID);
  });

  it('SHIELDS_IO_BASE matches', () => {
    expect(SHIELDS_IO_BASE).toBe(C.URLS.SHIELDS_IO_BASE);
  });

  it('badge colors match', () => {
    expect(BADGE_COLOR_ON).toBe(C.BADGE.COLOR_ON);
    expect(BADGE_COLOR_OFF).toBe(C.BADGE.COLOR_OFF);
    expect(BADGE_TEXT_COLOR).toBe(C.BADGE.TEXT_COLOR);
    expect(BADGE_FALLBACK_DARK).toBe(C.BADGE.FALLBACK_DARK);
  });

  it('FETCH_TIMEOUT matches', () => {
    expect(FETCH_TIMEOUT).toBe(C.TIMING.FETCH_TIMEOUT);
  });

  it('WELCOME_PAGE matches', () => {
    expect(WELCOME_PAGE).toBe(C.PAGES.WELCOME);
  });

  it('DEFAULT_SETTINGS matches (shared keys)', () => {
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      expect(DEFAULT_SETTINGS[key]).toStrictEqual(C.DEFAULTS[key]);
    }
  });
});
