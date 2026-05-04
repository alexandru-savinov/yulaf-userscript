// ==UserScript==
// @name         YuLaF — YouTube Language Filter
// @namespace    https://github.com/vakkaskarakurt/YuLaF-YouTube-Language-Filter
// @version      0.1.0
// @description  Hide YouTube videos whose titles are not in your selected languages. Safari/Userscripts port.
// @author       YuLaF contributors
// @match        https://*.youtube.com/*
// @match        https://m.youtube.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  const DEBUG = false;
  function log(...args) {
    if (DEBUG) {
      console.log('[YuLaF]', ...args);
    }
  }

  // ── Constants ──────────────────────────────────────────────────────────────
  const Constants = {
    VERSION: '0.1.0',

    TIMING: {
      FETCH_TIMEOUT: 5000,
      FILTER_DELAY: 100,
      URL_CHANGE_DELAY: 150,
      TITLE_RESTORE: 50,
      TEXT_EXTRACT_RETRY: 200,
      UI_FEEDBACK_DURATION: 2000,
      STOP_FILTER_CLEANUP_DELAY: 150,
      TOAST_DURATION: 2500,
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
      LOG_KEY_MAX_LENGTH: 60,
      EXCLUSION_RATIO_THRESHOLD: 0.5,
    },

    LIMITS: {
      LOGGED_TEXTS_MAX: 500,
      MAX_SELECTED_LANGUAGES: 30,
      MAX_LANGUAGE_CODE_LENGTH: 5,
    },

    DATA_ATTRIBUTES: {
      HIDDEN: 'data-language-filter-hidden',
      CHECKED: 'data-language-filter-checked',
      LANG: 'data-language-filter-lang',
      VERSION: 'data-filter-version',
      PROCESSED: 'data-yulaf-processed',
    },

    DEFAULTS: {
      enabled: true,
      strictMode: false,
      hideVideos: true,
      hideChannels: true,
      selectedLanguages: ['en'],
    },

    TOP_LANGUAGES: [
      'en', 'zh', 'es', 'hi', 'ar', 'pt', 'ru', 'ja', 'fr', 'de',
      'ko', 'it', 'id', 'tr',
    ],

    TOP_LANGUAGES_EXTENDED: [
      'en', 'zh', 'es', 'hi', 'ar', 'pt', 'ru', 'ja', 'fr', 'de',
      'ko', 'it', 'id', 'tr', 'fa', 'pl', 'nl', 'vi', 'th', 'uk',
    ],
  };

  const DATA_ATTR = Constants.DATA_ATTRIBUTES;

  // ── Config ─────────────────────────────────────────────────────────────────
  const Config = {
    selectors: {
      video: [
        'ytd-video-renderer',
        'ytd-compact-video-renderer',
        'ytd-grid-video-renderer',
        'ytd-rich-item-renderer',
        'ytd-reel-item-renderer',
        'ytd-shorts-lockup-view-model',
        'ytm-shorts-lockup-view-model-v2',
        'ytd-movie-renderer',
        'ytd-playlist-renderer',
        'ytd-radio-renderer',
        'ytd-rich-grid-media',
        'yt-lockup-view-model',
        'ytd-rich-section-renderer',
      ],
      channel: ['ytd-channel-renderer', 'ytd-channel-name'],
      title: [
        '#video-title',
        'a#video-title',
        'yt-formatted-string[id="video-title"]',
        '[title]',
        'h3 a[href*="/watch"]',
        'a[href*="/watch"] h3',
        'h3',
        'yt-formatted-string#video-title',
        '#video-title-link',
        'span[dir="auto"]',
        'a[href*="/shorts/"]',
        'a[href*="/playlist"] h3',
        '.ytd-video-meta-block #video-title',
      ],
      channelName: ['#channel-name a', '.ytd-channel-name a', '#text.ytd-channel-name'],
      description: [
        '.metadata-snippet-container',
        '#description-text',
        '.ytd-video-renderer #description-text',
      ],
    },

    detection: {
      threshold: Constants.DETECTION.CONFIDENCE_THRESHOLD,
      minLength: Constants.DETECTION.MIN_TEXT_LENGTH,
    },

    timing: {
      titleRestore: Constants.TIMING.TITLE_RESTORE,
      filterDelay: Constants.TIMING.FILTER_DELAY,
      urlChangeDelay: Constants.TIMING.URL_CHANGE_DELAY,
    },

    languages: {
      en: { code: 'en', name: 'English', nativeName: 'English', icon: '🇬🇧' },
      es: { code: 'es', name: 'Spanish', nativeName: 'Español', icon: '🇪🇸' },
      zh: { code: 'zh', name: 'Chinese', nativeName: '中文', icon: '🇨🇳' },
      hi: { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', icon: '🇮🇳' },
      ar: { code: 'ar', name: 'Arabic', nativeName: 'العربية', icon: '🇸🇦' },
      pt: { code: 'pt', name: 'Portuguese', nativeName: 'Português', icon: '🇵🇹' },
      bn: { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', icon: '🇧🇩' },
      ru: { code: 'ru', name: 'Russian', nativeName: 'Русский', icon: '🇷🇺' },
      ja: { code: 'ja', name: 'Japanese', nativeName: '日本語', icon: '🇯🇵' },
      fr: { code: 'fr', name: 'French', nativeName: 'Français', icon: '🇫🇷' },
      de: { code: 'de', name: 'German', nativeName: 'Deutsch', icon: '🇩🇪' },
      ko: { code: 'ko', name: 'Korean', nativeName: '한국어', icon: '🇰🇷' },
      it: { code: 'it', name: 'Italian', nativeName: 'Italiano', icon: '🇮🇹' },
      tr: { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', icon: '🇹🇷' },
      vi: { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', icon: '🇻🇳' },
      th: { code: 'th', name: 'Thai', nativeName: 'ไทย', icon: '🇹🇭' },
      pl: { code: 'pl', name: 'Polish', nativeName: 'Polski', icon: '🇵🇱' },
      nl: { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', icon: '🇳🇱' },
      sv: { code: 'sv', name: 'Swedish', nativeName: 'Svenska', icon: '🇸🇪' },
      da: { code: 'da', name: 'Danish', nativeName: 'Dansk', icon: '🇩🇰' },
      no: { code: 'no', name: 'Norwegian', nativeName: 'Norsk', icon: '🇳🇴' },
      fi: { code: 'fi', name: 'Finnish', nativeName: 'Suomi', icon: '🇫🇮' },
      cs: { code: 'cs', name: 'Czech', nativeName: 'Čeština', icon: '🇨🇿' },
      hu: { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', icon: '🇭🇺' },
      ro: { code: 'ro', name: 'Romanian', nativeName: 'Română', icon: '🇷🇴' },
      bg: { code: 'bg', name: 'Bulgarian', nativeName: 'Български', icon: '🇧🇬' },
      hr: { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski', icon: '🇭🇷' },
      sk: { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina', icon: '🇸🇰' },
      sl: { code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina', icon: '🇸🇮' },
      et: { code: 'et', name: 'Estonian', nativeName: 'Eesti', icon: '🇪🇪' },
      lv: { code: 'lv', name: 'Latvian', nativeName: 'Latviešu', icon: '🇱🇻' },
      lt: { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių', icon: '🇱🇹' },
      el: { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', icon: '🇬🇷' },
      id: { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', icon: '🇮🇩' },
      ms: { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', icon: '🇲🇾' },
      tl: { code: 'tl', name: 'Filipino', nativeName: 'Filipino', icon: '🇵🇭' },
      he: { code: 'he', name: 'Hebrew', nativeName: 'עברית', icon: '🇮🇱' },
      fa: { code: 'fa', name: 'Persian', nativeName: 'فارسی', icon: '🇮🇷' },
      ur: { code: 'ur', name: 'Urdu', nativeName: 'اردو', icon: '🇵🇰' },
      ta: { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', icon: '🇱🇰' },
      te: { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', icon: '🇮🇳' },
      ml: { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', icon: '🇮🇳' },
      kn: { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', icon: '🇮🇳' },
      gu: { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', icon: '🇮🇳' },
      pa: { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', icon: '🇮🇳' },
      sw: { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', icon: '🇰🇪' },
      af: { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans', icon: '🇿🇦' },
      am: { code: 'am', name: 'Amharic', nativeName: 'አማርኛ', icon: '🇪🇹' },
      ca: { code: 'ca', name: 'Catalan', nativeName: 'Català', icon: '🏳️' },
      eu: { code: 'eu', name: 'Basque', nativeName: 'Euskera', icon: '🏳️' },
      gl: { code: 'gl', name: 'Galician', nativeName: 'Galego', icon: '🏳️' },
      cy: { code: 'cy', name: 'Welsh', nativeName: 'Cymraeg', icon: '🏴' },
      ga: { code: 'ga', name: 'Irish', nativeName: 'Gaeilge', icon: '🇮🇪' },
      mt: { code: 'mt', name: 'Maltese', nativeName: 'Malti', icon: '🇲🇹' },
      is: { code: 'is', name: 'Icelandic', nativeName: 'Íslenska', icon: '🇮🇸' },
      mk: { code: 'mk', name: 'Macedonian', nativeName: 'Македонски', icon: '🇲🇰' },
      sq: { code: 'sq', name: 'Albanian', nativeName: 'Shqip', icon: '🇦🇱' },
      sr: { code: 'sr', name: 'Serbian', nativeName: 'Српски', icon: '🇷🇸' },
      bs: { code: 'bs', name: 'Bosnian', nativeName: 'Bosanski', icon: '🇧🇦' },
      uk: { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', icon: '🇺🇦' },
      be: { code: 'be', name: 'Belarusian', nativeName: 'Беларуская', icon: '🇧🇾' },
    },
  };

  // ── DOMService ─────────────────────────────────────────────────────────────
  const DOMService = {
    extractText(element, type) {
      let selectors = [];
      if (type === 'video') {
        selectors = [...Config.selectors.title, ...Config.selectors.description];
      } else if (type === 'channel') {
        selectors = Config.selectors.channelName;
      }

      const foundTexts = new Set();

      for (const selector of selectors) {
        const el = element.querySelector(selector);
        if (!el) continue;
        const content = (el.textContent || el.getAttribute('title') || '').trim();
        if (content && content.length >= 3 && !/^\d+[:.]\d+$/.test(content)) {
          foundTexts.add(content);
        }
      }

      return Array.from(foundTexts).join(' ');
    },

    hideElement(element, type) {
      element.style.display = 'none';
      element.setAttribute(DATA_ATTR.HIDDEN, type || 'video');
    },

    showElement(element) {
      element.style.display = '';
      element.style.visibility = '';
      element.style.opacity = '';
      element.removeAttribute(DATA_ATTR.HIDDEN);
    },

    isHidden(element) {
      return element.hasAttribute(DATA_ATTR.HIDDEN) || element.style.display === 'none';
    },

    showAllHiddenContent() {
      document.querySelectorAll(`[${DATA_ATTR.HIDDEN}]`).forEach((el) => this.showElement(el));
      document.querySelectorAll(`[${DATA_ATTR.CHECKED}]`).forEach((el) => {
        if (el.style.display === 'none') {
          this.showElement(el);
        }
        el.removeAttribute(DATA_ATTR.CHECKED);
        el.removeAttribute(DATA_ATTR.LANG);
      });
    },

    getAllElements(type = 'video') {
      const selectors = Config.selectors[type];
      if (!selectors) return [];
      const elements = document.querySelectorAll(selectors.join(','));
      return Array.from(elements).filter(
        (el) =>
          !el.matches('ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer') &&
          !el.closest('ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer')
      );
    },
  };

  // ── LanguageDetector ───────────────────────────────────────────────────────
  // Character-set based detection. Returns:
  //   true  → text matches at least one target language's script (after exclusions)
  //   false → text is in a non-Latin script that does not match any target
  //   null  → text is pure-Latin / too short / ambiguous (defer to trigram detector in Task 4)
  const LanguageDetector = {
    characterValidators: {
      // East Asian
      ja: /[぀-ゟ゠-ヿ一-龯]/,
      ko: /[가-힯ᄀ-ᇿ㄰-㆏]/,
      zh: /[一-龯]/,
      'zh-cn': /[一-龯]/,
      'zh-tw': /[一-龯]/,
      // Cyrillic
      ru: /[Ѐ-ӿ]/,
      uk: /[Ѐ-ӿ]/,
      bg: /[Ѐ-ӿ]/,
      sr: /[Ѐ-ӿ]/,
      mk: /[Ѐ-ӿ]/,
      be: /[Ѐ-ӿ]/,
      // Arabic scripts
      ar: /[؀-ۿݐ-ݿ]/,
      fa: /[؀-ۿݐ-ݿ]/,
      ur: /[؀-ۿݐ-ݿ]/,
      // Greek
      el: /[Ͱ-Ͽ]/,
      // Hebrew
      he: /[֐-׿]/,
      // Thai
      th: /[฀-๿]/,
      // Devanagari
      hi: /[ऀ-ॿ]/,
      ne: /[ऀ-ॿ]/,
      mr: /[ऀ-ॿ]/,
      // Dravidian
      ta: /[஀-௿]/,
      te: /[ఀ-౿]/,
      kn: /[ಀ-೿]/,
      ml: /[ഀ-ൿ]/,
      // Indic
      gu: /[઀-૿]/,
      bn: /[ঀ-৿]/,
      // Other scripts
      hy: /[԰-֏]/,
      ka: /[Ⴀ-ჿ]/,
      am: /[ሀ-፿]/,
    },

    exclusionPatterns: {
      tr: {
        excludedIf: 'en',
        patterns: [
          /\bthe\b/i, /\bwith\b/i, /\bfor\b/i, /\bwhat\b/i, /\bwhen\b/i,
          /\bhow\b/i, /\bthis\b/i, /\bthat\b/i, /\byou\b/i, /\byour\b/i,
          /\bare\b/i, /\bwas\b/i, /\bwere\b/i, /\bfrom\b/i, /\babout\b/i,
        ],
      },
      de: {
        excludedIf: 'en',
        patterns: [
          /\bthe\b/i, /\bwith\b/i, /\bthis\b/i, /\bthat\b/i,
          /\byou\b/i, /\byour\b/i, /\bwhat\b/i, /\bwhen\b/i,
        ],
      },
      ja: {
        excludedIf: 'ko',
        characterBased: true,
        patterns: [/[가-힯]/],
      },
      ko: {
        excludedIf: 'ja',
        characterBased: true,
        patterns: [/[぀-ゟ゠-ヿ]/],
      },
    },

    hasLanguageCharacters(text, langCode) {
      const v = this.characterValidators[langCode];
      if (!v) return true;
      return v.test(text);
    },

    _calcExclusionRatio(text, exclusions) {
      if (exclusions.characterBased) {
        const chars = text.replace(/\s/g, '');
        if (chars.length === 0) return 0;
        let matchCount = 0;
        for (const ch of chars) {
          if (exclusions.patterns.some((p) => p.test(ch))) matchCount++;
        }
        return matchCount / chars.length;
      }
      const words = text.split(/\s+/).filter((w) => w.length > 0);
      if (words.length === 0) return 0;
      let matchCount = 0;
      for (const word of words) {
        if (exclusions.patterns.some((p) => p.test(word))) matchCount++;
      }
      return matchCount / words.length;
    },

    detect(text, targetLanguages = []) {
      if (!text || text.length < Constants.DETECTION.MIN_TEXT_LENGTH) return null;

      const matchedTargets = [];
      for (const lang of targetLanguages) {
        const v = this.characterValidators[lang];
        if (!v || !v.test(text)) continue;
        const ex = this.exclusionPatterns[lang];
        if (ex && !targetLanguages.includes(ex.excludedIf)) {
          const ratio = this._calcExclusionRatio(text, ex);
          if (ratio > Constants.DETECTION.EXCLUSION_RATIO_THRESHOLD) continue;
        }
        matchedTargets.push(lang);
      }
      if (matchedTargets.length > 0) return true;

      for (const lang of Object.keys(this.characterValidators)) {
        if (this.characterValidators[lang].test(text)) return false;
      }

      const hasLatinTarget = targetLanguages.some((l) => !this.characterValidators[l]);
      return hasLatinTarget ? null : false;
    },
  };

  // ── LanguageService ────────────────────────────────────────────────────────
  // Cache: insertion-order Map. On overflow, evict EVICTION_RATIO of maxSize from the front (FIFO).
  const LanguageService = {
    selectedLanguages: [],
    strictMode: false,
    textCache: new Map(),
    cacheStats: { hits: 0, misses: 0 },
    cacheConfig: {
      maxSize: Constants.CACHE.MAX_SIZE,
      ttl: Constants.CACHE.TTL,
      evictionRatio: Constants.CACHE.EVICTION_RATIO,
    },

    setLanguages(langCodes) {
      const valid = Array.isArray(langCodes)
        ? [...new Set(langCodes.filter((code) => Config.languages[code]))]
        : [];
      const changed =
        valid.length !== this.selectedLanguages.length ||
        valid.some((code, i) => code !== this.selectedLanguages[i]);
      if (changed) {
        this.clearCache();
        this.selectedLanguages = valid;
      }
    },

    setStrictMode(enabled) {
      if (this.strictMode !== enabled) {
        this.clearCache();
        this.strictMode = enabled;
      }
    },

    normalizeText(text) {
      return text
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s-￿'-]/g, '');
    },

    createCacheKey(text, langs, strict) {
      const sorted = [...langs].sort().join(',');
      return `${this.normalizeText(text)}|${sorted}|${strict ? 'strict' : 'normal'}`;
    },

    getCachedResult(key) {
      const entry = this.textCache.get(key);
      if (!entry) {
        this.cacheStats.misses++;
        return undefined;
      }
      if (Date.now() - entry.timestamp > this.cacheConfig.ttl) {
        this.textCache.delete(key);
        this.cacheStats.misses++;
        return undefined;
      }
      this.cacheStats.hits++;
      return entry.result;
    },

    setCachedResult(key, result) {
      if (this.textCache.size >= this.cacheConfig.maxSize) {
        this._evictOldest();
      }
      this.textCache.set(key, { result, timestamp: Date.now() });
    },

    _evictOldest() {
      const evictCount = Math.max(
        1,
        Math.floor(this.cacheConfig.maxSize * this.cacheConfig.evictionRatio)
      );
      let removed = 0;
      for (const key of this.textCache.keys()) {
        if (removed >= evictCount) break;
        this.textCache.delete(key);
        removed++;
      }
    },

    clearCache() {
      this.textCache.clear();
      this.cacheStats = { hits: 0, misses: 0 };
    },

    getCacheStats() {
      const total = this.cacheStats.hits + this.cacheStats.misses;
      const hitRate = total > 0 ? ((this.cacheStats.hits / total) * 100).toFixed(1) : '0';
      return {
        size: this.textCache.size,
        hits: this.cacheStats.hits,
        misses: this.cacheStats.misses,
        total,
        hitRate: `${hitRate}%`,
      };
    },

    detect(text) {
      if (!text || text.length < Config.detection.minLength) return null;
      if (this.selectedLanguages.length === 0) return true;

      const key = this.createCacheKey(text, this.selectedLanguages, this.strictMode);
      const cached = this.getCachedResult(key);
      if (cached !== undefined) return cached;

      const result = LanguageDetector.detect(text, this.selectedLanguages);
      this.setCachedResult(key, result);
      return result;
    },
  };

  // ── FilterService (stub — Task 5) ──────────────────────────────────────────
  const FilterService = {
    process(el) {
      el.setAttribute(DATA_ATTR.PROCESSED, '1');
    },
  };

  // ── Controller — minimal wiring stub for Task 1 e2e round-trip ─────────────
  const Controller = {
    init() {
      const run = () => {
        for (const el of DOMService.getAllElements('video')) {
          FilterService.process(el);
        }
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run, { once: true });
      } else {
        run();
      }
      log('controller initialised');
    },
  };

  // Expose for in-page debugging
  if (typeof window !== 'undefined') {
    window.YuLaF = { version: Constants.VERSION, Config };
  }

  // Auto-start in real userscript runtime; stays inert when loaded as a CommonJS module for tests.
  if (typeof module === 'undefined' || !module.exports) {
    Controller.init();
  }

  // Build-time export shim — exposes internals to vitest. No-op in the userscript runtime
  // because Safari/Userscripts has no `module` binding.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      DOMService,
      LanguageDetector,
      LanguageService,
      FilterService,
      Controller,
      Config,
      Constants,
    };
  }
})();
