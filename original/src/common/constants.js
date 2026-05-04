/**
 * @file Centralized constants for the YuLaF extension.
 * All URLs, IDs, and magic numbers should be defined here
 * to avoid duplication and simplify maintenance.
 */

// ─── Extension Identity ───────────────────────────────────────
window.YT_FILTER_CONSTANTS = {
  EXTENSION_ID: 'ejfoldoabjeidjdddhomeaojicaemdpm',

  // ─── URLs ─────────────────────────────────────────────────
  URLS: {
    YOUTUBE: 'https://www.youtube.com',
    CHROME_WEB_STORE:
      'https://chromewebstore.google.com/detail/yulaf-youtube-language-fi/ejfoldoabjeidjdddhomeaojicaemdpm',
    GITHUB_REPO: 'https://github.com/vakkaskarakurt/YuLaF-YouTube-Language-Filter',
    GITHUB_ISSUES: 'https://github.com/vakkaskarakurt/YuLaF-YouTube-Language-Filter/issues',
    SHIELDS_IO_BASE: 'https://img.shields.io/chrome-web-store',
    FLAG_CDN_BASE: 'https://flagcdn.com/24x18',
  },

  // ─── Share Platform URLs ──────────────────────────────────
  SHARE_URLS: {
    x: url => `https://twitter.com/intent/tweet?url=${url}`,
    reddit: url => `https://reddit.com/submit?url=${url}`,
    whatsapp: url => `https://wa.me/?text=${url}`,
    telegram: url => `https://t.me/share/url?url=${url}`,
  },

  // ─── Timing (ms) ─────────────────────────────────────────
  TIMING: {
    FETCH_TIMEOUT: 5000,
    FILTER_DELAY: 100,
    URL_CHANGE_DELAY: 150,
    TITLE_RESTORE: 50,
    TEXT_EXTRACT_RETRY: 200,
    UI_FEEDBACK_DURATION: 2000,
    STOP_FILTER_CLEANUP_DELAY: 150,
    POPUP_LOAD_DELAY: 100,
    NON_YT_LISTENER_DELAY: 100,
    TYPING_EFFECT_INTERVAL: 30,
    TOAST_DURATION: 2500,
    COPIED_FEEDBACK_DURATION: 2000,
  },

  // ─── Cache Configuration ──────────────────────────────────
  CACHE: {
    MAX_SIZE: 1000,
    TTL: 30 * 60 * 1000, // 30 minutes
    CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 minutes
    EVICTION_RATIO: 0.2, // Remove oldest 20%
  },

  // ─── Detection ────────────────────────────────────────────
  DETECTION: {
    CONFIDENCE_THRESHOLD: 0.7,
    MIN_TEXT_LENGTH: 3,
    STRICT_MODE_MIN_PERCENTAGE: 50,
    API_TIMEOUT: 3000,
    LOG_KEY_MAX_LENGTH: 60,
    EXCLUSION_RATIO_THRESHOLD: 0.5,
  },

  // ─── Limits ───────────────────────────────────────────────
  LIMITS: {
    LOGGED_TEXTS_MAX: 500,
    MAX_SELECTED_LANGUAGES: 30,
    MAX_LANGUAGE_CODE_LENGTH: 5,
  },

  // ─── Data Attributes ───────────────────────────────────────
  DATA_ATTRIBUTES: {
    HIDDEN: 'data-language-filter-hidden',
    CHECKED: 'data-language-filter-checked',
    LANG: 'data-language-filter-lang',
    VERSION: 'data-filter-version',
  },

  // ─── Badge Colors ─────────────────────────────────────────
  BADGE: {
    COLOR_ON: '#10B981',
    COLOR_OFF: '#6B7280',
    TEXT_COLOR: '#FFFFFF',
    FALLBACK_DARK: '#000000',
  },

  // ─── Internal Pages ───────────────────────────────────────
  PAGES: {
    WELCOME: 'src/pages/welcome/index.html',
    ADVANCED: 'src/pages/advanced/index.html',
    POPUP: 'src/pages/popup/index.html',
  },

  // ─── Default Settings ─────────────────────────────────────
  DEFAULTS: {
    enabled: true,
    strictMode: false,
    hideVideos: true,
    hideChannels: true,
    selectedLanguages: ['en'],
    sortBy: 'popularity',
  },

  // ─── Top Languages (by global speakers) ───────────────────
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

  TOP_LANGUAGES_EXTENDED: [
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
    'fa',
    'pl',
    'nl',
    'vi',
    'th',
    'uk',
  ],

  // ─── Country Code Mapping (language → flag) ───────────────
  COUNTRY_MAP: {
    en: 'gb',
    es: 'es',
    zh: 'cn',
    hi: 'in',
    ar: 'sa',
    pt: 'pt',
    bn: 'bd',
    ru: 'ru',
    ja: 'jp',
    fr: 'fr',
    de: 'de',
    ko: 'kr',
    it: 'it',
    tr: 'tr',
    vi: 'vn',
    th: 'th',
    pl: 'pl',
    nl: 'nl',
    sv: 'se',
    da: 'dk',
    no: 'no',
    fi: 'fi',
    cs: 'cz',
    hu: 'hu',
    ro: 'ro',
    bg: 'bg',
    hr: 'hr',
    sk: 'sk',
    sl: 'si',
    et: 'ee',
    lv: 'lv',
    lt: 'lt',
    el: 'gr',
    id: 'id',
    ms: 'my',
    tl: 'ph',
    he: 'il',
    fa: 'ir',
    ur: 'pk',
    ta: 'lk',
    te: 'in',
    ml: 'in',
    kn: 'in',
    gu: 'in',
    pa: 'in',
    sw: 'ke',
    af: 'za',
    am: 'et',
    ca: 'es',
    eu: 'es',
    gl: 'es',
    cy: 'gb-wls',
    ga: 'ie',
    mt: 'mt',
    is: 'is',
    mk: 'mk',
    sq: 'al',
    sr: 'rs',
    bs: 'ba',
    uk: 'ua',
    be: 'by',
  },
};
