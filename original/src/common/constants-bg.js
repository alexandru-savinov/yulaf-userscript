/**
 * @file Constants for the background service worker (ES module).
 *
 * ⚠️  KEEP IN SYNC with src/common/constants.js
 *
 * Content scripts use `window.YT_FILTER_CONSTANTS` (non-module).
 * Service workers use these ES module exports.
 * Both define the same canonical values. When changing a value,
 * update BOTH files.
 */

// ─── Extension Identity ───────────────────────────────────────
export const EXTENSION_ID = 'ejfoldoabjeidjdddhomeaojicaemdpm';

// ─── URLs ─────────────────────────────────────────────────────
export const SHIELDS_IO_BASE = 'https://img.shields.io/chrome-web-store';

// ─── Badge Colors ─────────────────────────────────────────────
export const BADGE_COLOR_ON = '#10B981';
export const BADGE_COLOR_OFF = '#6B7280';
export const BADGE_TEXT_COLOR = '#FFFFFF';
export const BADGE_FALLBACK_DARK = '#000000';

// ─── Timing (ms) ─────────────────────────────────────────────
export const FETCH_TIMEOUT = 5000;
export const STATS_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

// ─── Internal Pages ──────────────────────────────────────────
export const WELCOME_PAGE = 'src/pages/welcome/index.html';

// ─── Default Settings ────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  enabled: true,
  strictMode: false,
  hideVideos: true,
  hideChannels: true,
  selectedLanguages: ['en'],
};
