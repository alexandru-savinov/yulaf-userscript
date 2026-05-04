/**
 * Vitest Setup File
 * Runs before all tests
 */

import { vi, beforeEach, afterEach } from 'vitest';
import { chromeMock } from './mocks/chrome.js';

// Global chrome mock
globalThis.chrome = chromeMock;

// Global window mock extensions
globalThis.YT_FILTER_CONFIG = {
  timing: {
    filterDelay: 100,
    urlChangeDelay: 150,
    titleRestore: 50,
  },
  selectors: {
    video: [
      'ytd-video-renderer',
      'ytd-rich-item-renderer',
      'ytd-compact-video-renderer',
      'ytd-grid-video-renderer',
    ],
    channel: ['ytd-channel-renderer', 'ytd-channel-name'],
    title: ['#video-title', 'a#video-title', 'h3'],
    channelName: ['#channel-name a', '.ytd-channel-name a'],
    description: ['.metadata-snippet-container', '#description-text'],
  },
  detection: {
    threshold: 0.7,
    minLength: 3,
  },
  languages: {
    en: { code: 'en', name: 'English', nativeName: 'English', icon: '🇬🇧' },
    tr: { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', icon: '🇹🇷' },
    ja: { code: 'ja', name: 'Japanese', nativeName: '日本語', icon: '🇯🇵' },
    ko: { code: 'ko', name: 'Korean', nativeName: '한국어', icon: '🇰🇷' },
    zh: { code: 'zh', name: 'Chinese', nativeName: '中文', icon: '🇨🇳' },
    ru: { code: 'ru', name: 'Russian', nativeName: 'Русский', icon: '🇷🇺' },
    de: { code: 'de', name: 'German', nativeName: 'Deutsch', icon: '🇩🇪' },
    fr: { code: 'fr', name: 'French', nativeName: 'Français', icon: '🇫🇷' },
  },
};

// Global constants mock
globalThis.YT_FILTER_CONSTANTS = {
  TIMING: {
    STOP_FILTER_CLEANUP_DELAY: 150,
    TEXT_EXTRACT_RETRY: 200,
  },
  CACHE: {
    MAX_SIZE: 1000,
    TTL: 30 * 60 * 1000,
    CLEANUP_INTERVAL: 5 * 60 * 1000,
    EVICTION_RATIO: 0.2,
  },
  DETECTION: {
    CONFIDENCE_THRESHOLD: 0.7,
    MIN_TEXT_LENGTH: 3,
    STRICT_MODE_MIN_PERCENTAGE: 50,
    API_TIMEOUT: 3000,
    LOG_KEY_MAX_LENGTH: 60,
    EXCLUSION_RATIO_THRESHOLD: 0.5,
  },
  LIMITS: {
    LOGGED_TEXTS_MAX: 500,
  },
  DATA_ATTRIBUTES: {
    HIDDEN: 'data-language-filter-hidden',
    CHECKED: 'data-language-filter-checked',
    LANG: 'data-language-filter-lang',
    VERSION: 'data-filter-version',
  },
  URLS: {
    YOUTUBE: 'https://www.youtube.com',
    CHROME_WEB_STORE:
      'https://chromewebstore.google.com/detail/yulaf-youtube-language-fi/ejfoldoabjeidjdddhomeaojicaemdpm',
  },
  PAGES: {
    WELCOME: 'src/pages/welcome/index.html',
    ADVANCED: 'src/pages/advanced/index.html',
    POPUP: 'src/pages/popup/index.html',
  },
  DEFAULTS: {
    enabled: true,
    strictMode: false,
    hideVideos: true,
    hideChannels: true,
    selectedLanguages: ['en'],
    sortBy: 'popularity',
  },
  TOP_LANGUAGES: [
    'en',
    'zh',
    'es',
    'hi',
    'ar',
    'pt',
    'ru',
    'ja',
    'fr',
    'de',
    'ko',
    'it',
    'id',
    'tr',
  ],
};

// Expose DATA_ATTRIBUTES as top-level global (matches config.js)
globalThis.YT_FILTER_DATA_ATTR = globalThis.YT_FILTER_CONSTANTS.DATA_ATTRIBUTES;
// DATA_ATTR is declared as const in config.js and shared across all content scripts
globalThis.DATA_ATTR = globalThis.YT_FILTER_DATA_ATTR;

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  chromeMock.storage._reset();
  chromeMock.i18n._resetOverrides?.();
});

// Cleanup after each test
afterEach(() => {
  vi.restoreAllMocks();
});
