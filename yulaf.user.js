// ==UserScript==
// @name         YuLaF — YouTube Language Filter
// @namespace    https://github.com/vakkaskarakurt/YuLaF-YouTube-Language-Filter
// @version      1.0.0
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
    VERSION: '1.0.0',

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
        // m.youtube.com (mobile web)
        'ytm-rich-item-renderer',
        'ytm-video-with-context-renderer',
        'ytm-compact-video-renderer',
        'ytm-shorts-lockup-view-model',
        'ytm-pivot-video-renderer',
        'ytm-item-section-renderer',
        'ytm-media-item',
      ],
      channel: ['ytd-channel-renderer', 'ytd-channel-name', 'ytm-channel-renderer'],
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
        // m.youtube.com (mobile web)
        '.media-item-headline',
        '.compact-media-item-headline',
        '.large-media-item-metadata h3',
        'h4.media-item-headline',
      ],
      channelName: ['#channel-name a', '.ytd-channel-name a', '#text.ytd-channel-name', '.media-item-byline'],
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

    // Hide via a CSS class with opacity + max-height transitions (less jarring
    // than `display:none`, and reversible mid-animation). The accompanying CSS
    // is injected once by `_ensureStyles` below.
    hideElement(element, type) {
      this._ensureStyles();
      element.classList.add('yulaf-hidden');
      element.setAttribute(DATA_ATTR.HIDDEN, type || 'video');
    },

    showElement(element) {
      element.classList.remove('yulaf-hidden');
      // Defensive cleanup: clear any inline styles older versions of the script
      // (or third-party code) may have left behind.
      if (element.style.display === 'none') element.style.display = '';
      element.style.visibility = '';
      element.style.opacity = '';
      element.removeAttribute(DATA_ATTR.HIDDEN);
    },

    isHidden(element) {
      return (
        element.hasAttribute(DATA_ATTR.HIDDEN) ||
        element.classList.contains('yulaf-hidden') ||
        element.style.display === 'none'
      );
    },

    showAllHiddenContent() {
      document.querySelectorAll(`[${DATA_ATTR.HIDDEN}]`).forEach((el) => this.showElement(el));
      document.querySelectorAll(`[${DATA_ATTR.CHECKED}]`).forEach((el) => {
        this.showElement(el);
        el.removeAttribute(DATA_ATTR.CHECKED);
        el.removeAttribute(DATA_ATTR.LANG);
      });
    },

    _stylesInjected: false,
    _hideCss:
      '.yulaf-hidden{opacity:0!important;max-height:0!important;margin:0!important;' +
      'padding-top:0!important;padding-bottom:0!important;overflow:hidden!important;' +
      'pointer-events:none!important;transition:opacity 200ms ease,max-height 200ms ease!important;}',
    _ensureStyles() {
      if (this._stylesInjected) return;
      if (typeof document === 'undefined') return;
      if (typeof GM_addStyle === 'function') {
        try { GM_addStyle(this._hideCss); this._stylesInjected = true; return; } catch (e) { log('GM_addStyle (hide css)', e); }
      }
      const style = document.createElement('style');
      style.setAttribute('data-yulaf-hide', '1');
      style.textContent = this._hideCss;
      (document.head || document.documentElement).appendChild(style);
      this._stylesInjected = true;
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

  // ── BEGIN trigram-tables ──
  // Trigram data derived from franc-min (MIT, https://github.com/wooorm/franc).
  // Regenerate with: node tools/build-trigrams.mjs
  const TRIGRAM_TABLES = {
    en: ["the"," th"," an","he ","nd ","ion","and"," to","to ","tio"," of","on ","of "," in","al ","ati","or ","ght","igh","rig"," ri","ne ","ent","one","ll ","is ","as ","ver","ed "," be","e r","in ","t t","all","eve","ht "," or","ery","s t","ty "," ev","e h","yon"," ha","ryo","e a","be ","his"," fr","ng ","d t","has"," sh","ing"," hi","sha"," pr"," co"," re","hal","nal","y a","s a","n t","ce ","men","ree","fre","e s","l b","nat","for","ts ","nt ","n a","ity","ry ","her","nce","ect","d i"," pe","pro","n o","cti"," fo","e e","ly ","es "," no","ona","ny ","any","er ","re ","f t","e o"," de","s o"," wi","ter","nte","e i","ons"," en"," ar","res","ers","y t","per","d f"," a "," on","ith","l a","e t","oci","soc","lit"," as"," se","dom","edo","eed","nti","s e","t o","oth","wit"," di","equ","t a","ted","st ","y o","int","e p"," ma"," so"," na","l o","e c","ch ","d a","enc","th ","are","ns ","ic "," un"," fu","tat","ial","cia"," ac","hts","nit","qua"," eq"," al","om ","e w","d o","f h","ali","ote","n e"," wh","r t","sta","ge ","thi","o a","tit","ual","an ","te ","ess"," ch","le ","ary","e f","by "," by","y i","tec","uni","o t","o o"," li","no "," la","s r"," su","inc","led","rot","con"," pu"," he","ere","imi","r a","ntr"," st"," ot","eli","age","dis","s d","tle","itl","hou","son","duc","edu"," wo","ate","ble","ces","at "," at"," fa","com","ive","o s","eme","o e","aw ","law","tra","und","pen","nde","unt","oun","n s","s f","f a","tho","ms "," is","act","cie","cat","uca"," ed","anc","wor","ral","t i"," me","o f","ily","pri","ren","ose","s c","en ","d n","l c","ful","rar","nta","nst"," ag","l p","min","din","sec","y e"," tr","rso","ich","hic","whi","cou","ern","uri","r o","tic","iti","igi","lig","rat","rth","t f","oms","rit","d r","ee ","e b","era","rou","se ","ay ","rs "," ho","abl","e u"],
    es: [" de","de ","os "," la"," a ","la "," y ","ón ","ión","es ","ere","rec","ien","o a","der","ció","cho","ech","en ","a p","ent","a l","aci","el ","na ","ona","e d"," co","as ","da "," to","al ","ene"," en","tod"," pe","e l"," el","ho ","nte"," su","per","a t","ad "," ti","ers","tie"," se","rso","son","e s"," pr","o d","oda","te ","cia","n d"," es","dad","ida"," in","ne ","est","ion","cio","s d","con","a e"," po","men"," li","n e","nci","res","su ","to ","tra"," re"," lo","tad"," na","los","a s"," o ","ia ","que"," pa","rá ","pro"," un","s y","ual","s e","lib","nac","do ","ra ","er ","a d","ue "," qu","e e","sta","nal","ar ","nes","ica","a c","ser","or ","ter","se ","por","cci","io ","del","l d","des","ado","les","one","a a","ndi"," so"," cu","s p","ale","s n","ame","par","ici","oci","una","ber","s t","rta","com"," di","dos","e a","imi","o s","e c","ert","las","o p","ant","dic","nto"," al","ara","ibe","enc","o e","s l","cas"," as","e p","ten","ali","o t","soc","y l","n c","nta","so ","tos","y a","ria","n t","die","a u"," fu","no ","l p","ial","qui","dis","s o","hos","gua","igu"," ig"," ca","sar","l t"," ma","l e","pre"," ac","tiv","s a","re ","nad","vid","era"," tr","ier","cua","n p","ta ","cla","ade","bre","s s","esa","ntr","ecc","a i"," le","lid","das","d d","ido","ari","ind","ada","nda","fun","mie","ca ","tic","eli","y d","nid","e i","odo","ios","o y","esp","iva","y e","mat","bli","r a","drá","tri","cti","tal","rim","ont","erá","us ","sus","end","pen","tor","ito","ond","ori","uie","lig","n a","ist","rac","lar","rse","tar","mo ","omo","ibr","n l","edi","med"," me","nio","a y","eda","isf","lo ","aso","l m","ias","ico","lic","ple","ste","act","tec","ote","rot","ele","ura"," ni","ie ","adi","u p","seg","s i","un ","und","a n","lqu","alq","o i","inc","sti"," si","n s","ern"],
    fr: [" de","es ","de ","ion","nt ","tio","et ","ne ","on "," et","ent","le ","oit","e d"," la","e p","la ","it "," à ","t d","roi","dro"," dr"," le","té ","e s","ati","te ","re "," to","s d","men","tou","e l","ns "," pe"," co","son","que"," au"," so","e a","onn","out"," un"," qu"," sa"," pr","ute","eme"," l’","t à"," a ","e e","con","des"," pa","ue ","ers","e c"," li","a d","per","ont","s e","t l","les","ts ","tre","s l","ant"," ou","cti","rso","ou ","ce ","ux ","à l","nne","ons","ité","en ","un "," en","er ","une","n d","sa ","lle"," in","nte","e t"," se","lib","res","a l","ire"," d’"," re","é d","nat","iqu","ur ","r l","t a","s s","aux","par","nal","a p","ans","dan","qui","t p"," dé","pro","s p","air"," ne"," fo","ert","s a","nce","au ","ui ","ect","du ","ond","ale","lit"," po","san"," ch","és "," na","us ","com","our","ali","tra"," ce","al ","e o","e n","rté","ber","ibe","tes","r d","e r","its"," di","êtr","pou","été","s c","à u","ell","int","fon","oci","soc","ut ","ter"," da","aut","ien","rai"," do","iss","s n"," ma","bli","ge ","est","s o"," du","ona","n p","pri","rs ","éga"," êt","ous","ens","ar ","age","s t"," su","cia","u d","cun","rat"," es","ir ","n c","e m"," ét","t ê","a c"," ac","ote","n t","ein"," tr","a s","ndi","e q","sur","ée ","ser","l n"," pl","anc","lig","t s","n e","s i","t e"," ég","ain","omm","act","ntr","tec","gal","ul "," nu"," vi","me ","nda","ind","soi","st "," te","pay","tat","era","il ","rel","n a","dis","n s","pré","peu","rit","é e","t é","bre","sen","ill","l’a","d’a"," mo","ass","lic","art"," pu","abl","nta","t c","rot"," on"," lo","ure","l’e","ava","ten","nul","ivi","t i","ess","ys ","ays"," fa","ine","eur","rés","cla","tés","oir","eut","e f","utr","doi","ibr","ais","ins","éra","’en","iét","l e","s é","nté"," ré","ssi"," as","nse","ces","é a"],
    de: ["en ","er ","der","ein"," un","nd ","und","ung","cht","ich"," de","sch","ng "," ge","ine","ech","gen","rec","che","ie "," re","eit"," au","ht ","die"," di"," ha","ch "," da","ver"," zu","lic","t d","in ","auf"," ei"," in"," be","hen","nde","n d","uf ","ede"," ve","it ","ten","n s","sei","at ","jed"," je"," se","and","rei","s r","den","ter","ne ","hat","t a","r h","zu ","das","ode"," od","as ","es "," an","fre","nge"," we","n u","run"," fr","ere","e u","lle","ner","nte","hei","ese"," so","rde","wer","ige"," al","ers","n g","hte","d d"," st","n j","lei","all","n a","nen","ege","ent","bei","g d","erd","t u","ren","nsc","chu"," gr","kei","ens","le ","ben","aft","haf","cha","tli","ges","e s"," si","men"," vo","lun","em ","r s","ion","te ","len","gru","gun","tig","unt","uch","spr","n e","ft ","ei ","e f"," wi"," sc","r d","n n","geh","r g","dar","sta","erk"," er","r e","sen","eic","gle"," gl","lie","e e","tz ","fen","n i","nie","f g","t w","des","chl","ite","ihe","eih","ies","ruc","st ","ist","n w","h a","n z","e a"," ni","ang","rf ","arf","gem","ale","ati","on ","he ","t s","ach"," na","end","n o","pru","ans","sse","ern","aat","taa","ehe","e d","hli","hre","int","tio","her","nsp","de ","mei"," ar","r a","ffe","e b","wie","erf","abe","hab","ndl","n v","sic","t i","han","ema","nat","ber","ied","geg","d s","nun","d f","ind"," me","gke","igk","ieß"," fa","igu","hul","r v","dig","rch","urc","dur"," du","utz","hut","tra","aus","alt","bes","str","ell","ste","ger","r o","esc","e g","rbe","arb","ohn","r b","mit","d g","r w","ntl","sow","n h","nne","etz","raf","dlu"," ih","lte","man","iem","erh","eru"," is","dem","lan","rt ","son","isc","eli","rel","n r","e i","rli","r i"," mi","e m","ild","bil"," bi","eme"," en","ins","für"," fü","gel","öff"," öf","owi","ill","wil","e v","ric","f e"],
    tr: [" ve"," ha","ve ","ir ","ler","hak"," he","her","in ","lar","r h","bir","ya ","er ","ak ","kkı","akk","eti"," ka"," bi","eya","an ","eri","iye","yet","ara","ek "," ol","de ","vey","ın ","ır ","nda","arı","esi","ını","dır"," ta","tle","e h","ası","etl","e k"," va","ı v","sın","ile","ne ","rke","erk","ard","ine"," sa","ınd","ini","k h","kın","ama","le ","tin","rdı","var","a v"," me","e m","na ","sin","ere","k v"," şa"," bu","lan","kes","dir","rin","dan"," ma","kı ","mak","şah","da "," te","mek"," ge","nı "," hi","nin","en ","n h"," se","lik","rle","ana","lma","e a","ı h","r ş","ill","si "," de","aya","zdi","izd","aiz","hai","ret","hiç","ına"," iş","e b"," ba","kla","et "," hü","rın","n k","ola","nma","e t"," ya","eme","riy","n v","e i","a h","li ","mil","eli","ket","ik ","kar","irl","hür","im ","evl","mes","e d","ahs","ma ","rak","ala","let","lle","un "," ed","rri","ürr","bu "," mi","i v","dil"," il"," eş","n i","la ","el ","mal"," mü"," ko","e g","se "," ki","mas","lek","mle","mem","n b","ili","e e","ser"," iç","n s","din"," di","es ","mel","eke","tir","şit","eşi","r b","akl","yla","n m","len"," ke","edi","oru","nde","re ","ele","ni ","tür","a k","eye","ık ","ken","uğu"," uy","eml","erd","ede","ame"," gö","e s","i m","tim","i b","rde","rşı","arş","a s","it ","t v","siy","ar ","rme","est","bes","rbe","erb","te ","alı"," an","ndi","end","hsı","unm","rı ","kor","nın"," ce","maz","mse","ims","kim","iç "," ay","a m","lam","ri ","sız","a b","ade","n t","nam","lme","ilm","k g","il ","tme","etm","r v","e v","n e","ğre","öğr"," öğ","al ","ıyl","olm","vle","şma","i s","ger","me "," da","ind","lem","i o","may","cak","çin","içi","nun","kan","ye ","e y","r t","az ","ç k","ece","sı ","eni"," mu","ulu","und","den","lun"," fa","şı ","ahi","l v","r a","san","kat"," so","enm"," ev","iş "],
    pt: ["de "," de"," se","ão ","os ","to ","em "," e ","do ","o d"," di","er ","ito","eit","ser","ent","ção"," a ","dir","ire","rei","o s","ade","dad","uma","as ","no ","e d"," to","nte"," co","o t","tod"," ou","men","que","s e","man"," pr"," in"," qu","es "," te","hum","odo","e a","da "," hu","ano","te ","al ","tem","o e","s d","ida","m d"," pe"," re","o a","ou ","r h","e s","cia","a e"," li","o p"," es","res"," do"," da"," à ","ual"," em"," su","açã","dos","a p","tra","est","ia ","con","pro","ar ","e p","is "," na","rá ","qua","a d"," pa","com","ais","o c","ame","erá"," po","uer","sta","ber","ter"," o ","ess","ra ","e e","das","o à","nto","nal","o o","a c","ido","rda","erd"," as","nci","sua","ona","des","ibe","lib","e t","ado","s n","ua ","s t","ue "," so","ica","ma ","lqu","alq","tos","m s","a l","per","ada","oci","soc","cio","a n","par","aci","s a","pre","ont","m o","ura","a s"," um","ion","e o","or ","e r","pel","nta","ntr","a i","io ","nac","ênc","str","ali","ria","nst"," tr","a q","int","o n","a o","ca ","ela","uçã","lid","e l"," at","sen","ese","r d","s p","egu","seg","vid","pri","sso","ém ","ime","tic","dis","raç","eci","ara"," ca","nid","tru","ões","ass","seu","por","a a","m p"," ex","so ","r i","eçã","teç","ote","rot"," le"," ma","ing","a t","ran","era","rio","l d","eli","ça ","sti"," ne","cid","ern","utr","out","r e","e c","tad","gua","igu"," ig"," os","s o","ruç","ins","çõe","ios"," fa","e n","sse"," no","re ","art","r p","rar","u p","inc","lei","cas","ico","uém","gué","ngu","nin"," ni","gur","la ","pen","nça","na ","içã","ião","cie","ist","sem","ta ","ele","e f","om ","tro"," ao","rel","m a","s s","tar","eda","ied","uni","e m","s i","a f","ias"," cu"," ac","r a","á a","rem","ei ","omo","rec","for","s f","esc","ant","à s"," vi","o q","ver","a u","nda","und","fun"],
    it: [" di","to "," in","ion","la "," de","di ","re ","e d","ne "," e ","zio","rit","a d","one","o d","ni ","le ","lla","itt","ess"," al","iri","dir","tto","ent","ell","i i","del","ndi","ere","ind","o a"," co","te ","tà ","ti ","a s","uo ","e e","gni","azi"," pr","idu","ivi","duo","vid","div","ogn"," og"," es","i e"," ha","all","ale","nte","e a","men","ser"," su"," ne","e l","za ","i d","per","a p","ha "," pe"," un","con","no ","sse","li ","e i"," o "," so"," li"," la","pro","ia ","o i","e p","o s","i s","in ","ato","o h","na ","e s","a l","e o","nza","ali","tti","o p","ta ","so ","ber","ibe","lib","o e","un "," a "," ri","ua ","il "," il","nto","pri","el "," po","una","are","ame"," qu","a c","ro ","oni","nel","e n"," ad","ual","gli","sua","ond"," re","a a","i c","ri ","o o","sta","ita","i o"," le","ad ","i a","ers","enz","ssi","à e","ità","gua","i p","e c","io "," pa","ter","soc","nal","ona","naz","ist","cia","rso","ver","a e","i r","tat","lle","sia"," si","rio","tra","che"," se","rtà","ert","anz","eri","tut","à d","he "," da","al ","ant","qua","on ","ari","o c"," st","oci","er ","dis","tri","si ","ed "," ed","ono"," tu","ei ","dei","uzi","com","att","a n","opr","rop","par","nes","i l","zza","ese","res","ien","son"," eg","n c","ont","nti","pos","int","ico","rà ","sun","ial","lit","sen","pre","tta","dev","nit","era","eve","ll ","l i"," l ","nda","ina","non"," no","o n","ria","str","d a","art","se ","ssu","ica","raz","ett","sci","gio","ati","egu"," na","i u","utt","ve "," ma","do ","e r","ssa","sa ","a f","n p","fon"," ch","d u","rim"," fo","a t"," sc","trà","otr","pot","n i"," cu","l p","ra ","ezz","a o","ini","sso","dic","ltr","uni","cie"," ra","i n","ruz","tru","ste"," is","der","l m","a r","pie","lia","est","dal","nta"," at","tal","ntr"," pu","nno","ann","ten","vit","a v"],
    nl: ["en ","an ","de "," de"," he","ing","cht"," en","der","van"," va","ng ","een","et ","ech"," ge"," ee","n e","rec"," re","n v","n d","nde","ver"," be","er ","ede","den"," op","het","n i"," te","lij","gen","zij"," zi","ht ","ijk","eli"," in","t o"," ve","op ","and","ten","ke ","ijn","e v","jn ","ied"," on","eft"," ie","sch","n z","n o","aan","ft ","eid","te ","oor"," we","ond","eef","ere","hee","id ","in ","rde","n w","t r","aar","rij","ord","wor","ens","of "," of","hei","n g"," vr"," vo"," aa","r h","hte"," wo","n h","al ","nd ","vri","e o","ren","le ","or ","n a","jke","lle","eni","n b","ij ","e e","g v"," st","ige","die","e g","men","nge","t h","e b"," za","e s","om ","t e","ati","wel","erk","sta","ers"," al"," om","n t","zal","dig"," me","ste","voo","ter","gin","re ","ege","ge ","g e","bes","nat"," na","eke","che","ig ","gel","nie","nst","e a","nig","est","e w","erw","r d","end","ona","d v","jhe","ijh","d e","ele"," di","ie "," do","del","n n","at ","it "," da","tie","e r","elk","ich","jk ","vol","ijd","tel","min","len","str","lin","n s","per","t d","han"," zo","hap","cha","wet"," to","ven"," ni","aat","ion","tio","taa","lke","eze","met","ard","waa","uit","sti","e n","doo","pen","eve","el ","toe","ale","ien","ach","st ","ns "," wa","eme","nin","e d","bij"," gr","n m","p v","esc","t w","ont","ite","man","ema"," ma","nal","g o","rin","hed","t a","t v","beg","all","ijs","wij","rwi","e h"," bi","gro","p d","rmi","erm","her","oon"," pe","eit","kin","t z","iet","iem","e i","gem","igi"," an","d o","r e","ete","e m","js "," hu","oep","g z","edi","arb","zen","tin","ron","daa","teg","g t","raf","tra","eri","soo","nsc","t b"," er","lan"," la","ern","ar ","lit","zon","d z","ze ","dez","eho","d m","tig","loo","mee","ger","ali","gev","ije","ezi","gez","nli","l v","tij","eer"," ar"],
  };
  // ── END trigram-tables ──

  // ── TrigramDetector ────────────────────────────────────────────────────────
  // Rank-distance language ID over trigram tables, modelled on franc's algorithm
  // (https://github.com/wooorm/franc). Returns `{ lang, confidence }` for a
  // confident match, otherwise `null`. Used as the fallback for pure-Latin text
  // where the character-set detector cannot decide.
  const TrigramDetector = {
    minLength: 10,
    minConfidence: 0.15,
    minMargin: 0.015,
    MAX_DIFFERENCE: 300,

    _langModels: null,

    _buildLangModels() {
      const models = {};
      for (const code of Object.keys(TRIGRAM_TABLES)) {
        const list = TRIGRAM_TABLES[code];
        const ranks = Object.create(null);
        for (let i = 0; i < list.length; i++) ranks[list[i]] = i;
        models[code] = ranks;
      }
      return models;
    },

    _trigramsOf(text) {
      const cleaned = ' ' + text
        .toLowerCase()
        .replace(/[ -@[-`{-¿\d]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() + ' ';
      if (cleaned.length < 3) return null;
      const counts = Object.create(null);
      for (let i = 0; i <= cleaned.length - 3; i++) {
        const tri = cleaned.slice(i, i + 3);
        counts[tri] = (counts[tri] || 0) + 1;
      }
      // Sort trigrams by frequency desc → each gets a rank index in `tuples`.
      const tuples = Object.keys(counts)
        .map((t) => [t, counts[t]])
        .sort((a, b) => b[1] - a[1]);
      return tuples.length ? tuples : null;
    },

    detect(text) {
      if (typeof text !== 'string') return null;
      const trimmed = text.trim();
      if (trimmed.length < this.minLength) return null;

      if (!this._langModels) this._langModels = this._buildLangModels();
      const langs = Object.keys(this._langModels);
      if (langs.length === 0) return null;

      const tuples = this._trigramsOf(trimmed);
      if (!tuples) return null;

      const max = this.MAX_DIFFERENCE;
      const distances = [];
      for (const code of langs) {
        const ranks = this._langModels[code];
        let dist = 0;
        for (let i = 0; i < tuples.length; i++) {
          const tri = tuples[i][0];
          if (tri in ranks) {
            const diff = i - ranks[tri];
            dist += diff < 0 ? -diff : diff;
          } else {
            dist += max;
          }
        }
        distances.push([code, dist]);
      }
      distances.sort((a, b) => a[1] - b[1]);
      // Convert to a [0, 1] confidence: 1 = identical ranking, 0 = max distance.
      const denom = tuples.length * max;
      const bestConf = denom > 0 ? 1 - distances[0][1] / denom : 0;
      const secondConf = denom > 0 ? 1 - distances[1][1] / denom : 0;
      if (bestConf < this.minConfidence) return null;
      if (bestConf - secondConf < this.minMargin) return null;
      return { lang: distances[0][0], confidence: bestConf };
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

      let result = LanguageDetector.detect(text, this.selectedLanguages);

      // Character-set detection returned `null` for Latin/short/ambiguous text.
      // Fall back to trigram detection when at least one selected language is
      // Latin-script (no character validator) AND the trigram detector covers it.
      if (result === null) {
        const latinTargets = this.selectedLanguages.filter(
          (l) => !LanguageDetector.characterValidators[l] && TRIGRAM_TABLES[l]
        );
        if (latinTargets.length > 0) {
          const tri = TrigramDetector.detect(text);
          if (tri) {
            result = latinTargets.includes(tri.lang) ? true : false;
          }
        }
      }

      this.setCachedResult(key, result);
      return result;
    },
  };

  // ── FilterService ──────────────────────────────────────────────────────────
  // Hides YouTube video/channel elements whose detected title language is not in
  // the selected set. Each element carries DATA_ATTR.CHECKED + DATA_ATTR.LANG so
  // we can skip already-processed nodes, plus DATA_ATTR.VERSION so a later pass
  // can supersede a still-pending earlier one.
  const FilterService = {
    processingElements: new WeakSet(),
    _loggedTexts: new Set(),
    _retryTimers: new WeakMap(),

    filterContent(settings) {
      if (!settings) return;
      if (settings.hideVideos) this._filterElementType('video', settings);
      if (settings.hideChannels) this._filterElementType('channel', settings);
    },

    _filterElementType(type, settings) {
      const elements = DOMService.getAllElements(type);
      for (const el of elements) this.processElement(el, type, settings);
    },

    processElement(element, type, settings) {
      if (this.processingElements.has(element)) return;

      const currentLang = [...LanguageService.selectedLanguages].sort().join(',');
      const lastCheckedLang = element.getAttribute(DATA_ATTR.LANG);
      if (element.hasAttribute(DATA_ATTR.CHECKED) && lastCheckedLang === currentLang) return;

      this.processingElements.add(element);
      const processingVersion =
        parseInt(element.getAttribute(DATA_ATTR.VERSION) || '0', 10) + 1;
      element.setAttribute(DATA_ATTR.VERSION, String(processingVersion));
      element.setAttribute(DATA_ATTR.CHECKED, 'true');
      element.setAttribute(DATA_ATTR.LANG, currentLang);
      element.setAttribute(DATA_ATTR.PROCESSED, '1');

      DOMService.hideElement(element, type);

      const text = DOMService.extractText(element, type).trim();

      if (!text) {
        // Title may not have streamed in yet — schedule one retry, then default to show.
        const prev = this._retryTimers.get(element);
        if (prev) clearTimeout(prev);
        const timer = setTimeout(() => {
          this._retryTimers.delete(element);
          this.processingElements.delete(element);
          if (!element.isConnected) return;
          if (parseInt(element.getAttribute(DATA_ATTR.VERSION) || '0', 10) !== processingVersion) {
            return;
          }
          const retryText = DOMService.extractText(element, type).trim();
          if (retryText) {
            this._applyDecision(element, type, retryText, settings, processingVersion);
          } else {
            // No text after retry — show to avoid hiding everything.
            DOMService.showElement(element);
          }
        }, Constants.TIMING.TEXT_EXTRACT_RETRY);
        this._retryTimers.set(element, timer);
        return;
      }

      try {
        this._applyDecision(element, type, text, settings, processingVersion);
      } finally {
        this.processingElements.delete(element);
      }
    },

    _applyDecision(element, type, text, settings, processingVersion) {
      if (parseInt(element.getAttribute(DATA_ATTR.VERSION) || '0', 10) !== processingVersion) {
        return;
      }
      // Bail if the controller has been disabled mid-flight.
      if (settings && settings.enabled === false) {
        DOMService.showElement(element);
        return;
      }

      const isTarget = LanguageService.detect(text);

      const logKey = text.substring(0, Constants.DETECTION.LOG_KEY_MAX_LENGTH);
      if (!this._loggedTexts.has(logKey)) {
        if (this._loggedTexts.size > Constants.LIMITS.LOGGED_TEXTS_MAX) {
          const evict = Math.ceil(this._loggedTexts.size * Constants.CACHE.EVICTION_RATIO);
          let removed = 0;
          for (const k of this._loggedTexts) {
            if (removed >= evict) break;
            this._loggedTexts.delete(k);
            removed++;
          }
        }
        this._loggedTexts.add(logKey);
        log(isTarget ? '✓ SHOW:' : '✗ HIDE:', logKey);
      }

      // detect() returns true|false|null. Show on true OR null (low-confidence default-show).
      if (isTarget !== false) {
        DOMService.showElement(element);
      }
    },

    _isAd(el) {
      const adSel = 'ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer';
      return el.matches(adSel) || el.closest(adSel);
    },

    _processNodeType(node, selectors, type, settings) {
      if (selectors.some((sel) => node.matches(sel))) {
        this.processElement(node, type, settings);
      }
      if (node.querySelectorAll) {
        node.querySelectorAll(selectors.join(',')).forEach((el) => {
          if (!this._isAd(el)) this.processElement(el, type, settings);
        });
      }
    },

    processNewNode(node, settings) {
      if (!node || !node.matches || !settings) return;
      if (this._isAd(node)) return;
      if (settings.hideVideos) this._processNodeType(node, Config.selectors.video, 'video', settings);
      if (settings.hideChannels) this._processNodeType(node, Config.selectors.channel, 'channel', settings);
    },
  };

  // ── SettingsService ────────────────────────────────────────────────────────
  // Persists user preferences via GM_getValue / GM_setValue. Falls back to
  // Constants.DEFAULTS when the GM bridge is missing (e.g. unit tests / vm).
  const SettingsService = {
    KEYS: ['enabled', 'strictMode', 'hideVideos', 'hideChannels', 'selectedLanguages'],
    _listeners: new Set(),

    _gmGet(key, fallback) {
      if (typeof GM_getValue === 'function') {
        try { return GM_getValue(key, fallback); } catch (e) { log('GM_getValue', e); }
      }
      return fallback;
    },

    _gmSet(key, value) {
      if (typeof GM_setValue === 'function') {
        try { GM_setValue(key, value); } catch (e) { log('GM_setValue', e); }
      }
    },

    load() {
      const d = Constants.DEFAULTS;
      const known = Object.keys(Config.languages);
      const rawLangs = this._gmGet('selectedLanguages', d.selectedLanguages);
      const langs = Array.isArray(rawLangs)
        ? rawLangs.filter((c) => known.includes(c))
        : [];
      return {
        enabled: this._gmGet('enabled', d.enabled) !== false,
        strictMode: this._gmGet('strictMode', d.strictMode) === true,
        hideVideos: this._gmGet('hideVideos', d.hideVideos) !== false,
        hideChannels: this._gmGet('hideChannels', d.hideChannels) !== false,
        selectedLanguages: langs.length > 0 ? langs : [...d.selectedLanguages],
      };
    },

    save(updates) {
      for (const k of Object.keys(updates)) {
        if (this.KEYS.includes(k)) this._gmSet(k, updates[k]);
      }
      for (const fn of this._listeners) {
        try { fn(updates); } catch (e) { log('settings listener', e); }
      }
    },

    subscribe(fn) {
      this._listeners.add(fn);
      return () => this._listeners.delete(fn);
    },
  };

  // ── SettingsUI ─────────────────────────────────────────────────────────────
  // Floating toggle button + collapsible settings panel. Touch targets ≥ 44×44.
  // Styles are injected via GM_addStyle and scoped under `.yulaf-` to avoid
  // colliding with YouTube's own classes.
  const SettingsUI = {
    root: null,
    toggleBtn: null,
    panel: null,
    _styled: false,
    _outsideHandler: null,

    _css: `
      .yulaf-root { all: initial; position: fixed; right: 12px; bottom: 12px;
        z-index: 2147483600; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .yulaf-toggle { all: unset; box-sizing: border-box; display: flex;
        align-items: center; justify-content: center; width: 48px; height: 48px;
        border-radius: 24px; background: #cc0000; color: #fff; font-size: 22px;
        cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.35); user-select: none;
        text-align: center; }
      .yulaf-toggle.yulaf-off { background: #555; }
      .yulaf-panel { display: none; position: absolute; right: 0; bottom: 60px;
        width: 320px; max-height: 70vh; overflow-y: auto; padding: 12px;
        background: #fff; color: #111; border-radius: 8px;
        box-shadow: 0 4px 18px rgba(0,0,0,0.3); }
      .yulaf-panel.yulaf-open { display: block; }
      .yulaf-row { display: flex; align-items: center; justify-content: space-between;
        margin: 6px 0; min-height: 44px; }
      .yulaf-row label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
      .yulaf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px; }
      .yulaf-lang { display: flex; align-items: center; gap: 6px; padding: 8px;
        min-height: 44px; border-radius: 6px; border: 1px solid #ddd; cursor: pointer;
        font-size: 14px; background: #fafafa; }
      .yulaf-lang.yulaf-selected { background: #e6f4ff; border-color: #1677ff; }
      .yulaf-lang input { margin: 0; }
      .yulaf-actions { display: flex; gap: 8px; margin-top: 10px; }
      .yulaf-btn { all: unset; flex: 1; text-align: center; padding: 10px;
        min-height: 44px; min-width: 44px; box-sizing: border-box;
        border-radius: 6px; background: #f0f0f0; color: #111; cursor: pointer;
        border: 1px solid #ccc; font-size: 14px; }
      .yulaf-btn:hover { background: #e3e3e3; }
      .yulaf-title { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
    `,

    mount(controller) {
      if (this.root) return;
      if (typeof document === 'undefined' || !document.body) return;
      // Drop any stale UI from a prior load (e.g. userscript reloaded into the page).
      const stale = document.querySelectorAll('[data-yulaf-ui]');
      stale.forEach((el) => el.parentNode && el.parentNode.removeChild(el));
      if (!this._styled) {
        if (typeof GM_addStyle === 'function') {
          try { GM_addStyle(this._css); } catch (e) { log('GM_addStyle', e); }
        } else {
          const style = document.createElement('style');
          style.textContent = this._css;
          (document.head || document.documentElement).appendChild(style);
        }
        this._styled = true;
      }

      const root = document.createElement('div');
      root.className = 'yulaf-root';
      root.setAttribute('data-yulaf-ui', '1');

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'yulaf-toggle';
      toggle.setAttribute('aria-label', 'YuLaF toggle');
      toggle.title = 'YuLaF';
      toggle.textContent = 'Y';
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this._togglePanel();
      });
      // Long-press / right-click — quick on/off without opening panel.
      toggle.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        controller.setEnabled(!controller.settings.enabled);
      });

      const panel = document.createElement('div');
      panel.className = 'yulaf-panel';
      panel.addEventListener('click', (e) => e.stopPropagation());

      root.appendChild(toggle);
      root.appendChild(panel);
      document.body.appendChild(root);

      this.root = root;
      this.toggleBtn = toggle;
      this.panel = panel;
      this._controller = controller;

      this._outsideHandler = (e) => {
        if (!this.panel || !this.panel.classList.contains('yulaf-open')) return;
        if (!this.root.contains(e.target)) this._closePanel();
      };
      document.addEventListener('click', this._outsideHandler);

      this.render(controller.settings);
    },

    _togglePanel() {
      if (!this.panel) return;
      if (this.panel.classList.contains('yulaf-open')) this._closePanel();
      else this._openPanel();
    },

    _openPanel() {
      this.render(this._controller.settings);
      this.panel.classList.add('yulaf-open');
    },

    _closePanel() {
      if (this.panel) this.panel.classList.remove('yulaf-open');
    },

    render(settings) {
      if (!this.toggleBtn) return;
      this.toggleBtn.classList.toggle('yulaf-off', !settings.enabled);
      this.toggleBtn.setAttribute('data-enabled', settings.enabled ? '1' : '0');
      if (!this.panel) return;

      const ctrl = this._controller;
      // YouTube enforces a Trusted Types CSP that forbids innerHTML; clear children manually.
      while (this.panel.firstChild) this.panel.removeChild(this.panel.firstChild);

      const enabledRow = document.createElement('div');
      enabledRow.className = 'yulaf-row';
      const enabledLabel = document.createElement('label');
      const enabledInput = document.createElement('input');
      enabledInput.type = 'checkbox';
      enabledInput.checked = settings.enabled;
      enabledInput.className = 'yulaf-enabled';
      enabledInput.addEventListener('change', () => ctrl.setEnabled(enabledInput.checked));
      enabledLabel.appendChild(enabledInput);
      enabledLabel.appendChild(document.createTextNode(' Filter enabled'));
      enabledRow.appendChild(enabledLabel);
      this.panel.appendChild(enabledRow);

      const strictRow = document.createElement('div');
      strictRow.className = 'yulaf-row';
      const strictLabel = document.createElement('label');
      const strictInput = document.createElement('input');
      strictInput.type = 'checkbox';
      strictInput.checked = settings.strictMode;
      strictInput.className = 'yulaf-strict';
      strictInput.addEventListener('change', () => ctrl.updateSettings({ strictMode: strictInput.checked }));
      strictLabel.appendChild(strictInput);
      strictLabel.appendChild(document.createTextNode(' Strict mode'));
      strictRow.appendChild(strictLabel);
      this.panel.appendChild(strictRow);

      const title = document.createElement('div');
      title.className = 'yulaf-title';
      title.textContent = 'Languages';
      this.panel.appendChild(title);

      const grid = document.createElement('div');
      grid.className = 'yulaf-grid';
      const known = Object.keys(Config.languages);
      const top = Constants.TOP_LANGUAGES_EXTENDED.filter((c) => known.includes(c));
      const rest = known.filter((c) => !top.includes(c)).sort();
      const selected = new Set(settings.selectedLanguages);
      for (const code of [...top, ...rest]) {
        const lang = Config.languages[code];
        const cell = document.createElement('label');
        cell.className = 'yulaf-lang' + (selected.has(code) ? ' yulaf-selected' : '');
        cell.setAttribute('data-lang', code);
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = selected.has(code);
        cb.addEventListener('change', () => {
          const next = new Set(this._controller.settings.selectedLanguages);
          if (cb.checked) next.add(code); else next.delete(code);
          ctrl.updateSettings({ selectedLanguages: [...next] });
        });
        cell.appendChild(cb);
        cell.appendChild(document.createTextNode(` ${lang.icon} ${lang.name}`));
        grid.appendChild(cell);
      }
      this.panel.appendChild(grid);

      const actions = document.createElement('div');
      actions.className = 'yulaf-actions';
      const showAll = document.createElement('button');
      showAll.type = 'button';
      showAll.className = 'yulaf-btn yulaf-show-all';
      showAll.textContent = 'Show all';
      showAll.addEventListener('click', () => ctrl.updateSettings({ selectedLanguages: [...known] }));
      const hideAll = document.createElement('button');
      hideAll.type = 'button';
      hideAll.className = 'yulaf-btn yulaf-hide-all';
      hideAll.textContent = 'Hide all';
      hideAll.addEventListener('click', () => ctrl.updateSettings({ selectedLanguages: [] }));
      actions.appendChild(showAll);
      actions.appendChild(hideAll);
      this.panel.appendChild(actions);
    },

    destroy() {
      if (this._outsideHandler) {
        document.removeEventListener('click', this._outsideHandler);
        this._outsideHandler = null;
      }
      if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
      this.root = this.toggleBtn = this.panel = null;
    },
  };

  // ── Controller ─────────────────────────────────────────────────────────────
  // MutationObserver-driven controller. Watches for new YouTube items, debounces
  // SPA URL changes (history.pushState/replaceState patching + popstate), and
  // triggers re-filter cycles. Settings are loaded via SettingsService and
  // written back through `updateSettings` / `setEnabled`.
  const Controller = {
    settings: null,
    observer: null,
    popstateHandler: null,
    originalPushState: null,
    originalReplaceState: null,
    filterTimeout: null,
    urlChangeTimer: null,
    lastUrl: '',
    filteringActive: false,

    init() {
      this.settings = SettingsService.load();
      LanguageService.setLanguages(this.settings.selectedLanguages);
      LanguageService.setStrictMode(this.settings.strictMode);
      this.lastUrl = typeof location !== 'undefined' ? window.location.href : '';

      if (this.settings.enabled) this.start();
      this._mountUI();
      log('controller initialised', this.settings);
    },

    _mountUI() {
      if (typeof document === 'undefined') return;
      const tryMount = () => SettingsUI.mount(this);
      if (document.body) tryMount();
      else if (typeof document.addEventListener === 'function') {
        document.addEventListener('DOMContentLoaded', tryMount, { once: true });
      }
    },

    updateSettings(updates) {
      if (!updates || !this.settings) return;
      Object.assign(this.settings, updates);
      if ('selectedLanguages' in updates) {
        LanguageService.setLanguages(this.settings.selectedLanguages);
      }
      if ('strictMode' in updates) {
        LanguageService.setStrictMode(this.settings.strictMode);
      }
      SettingsService.save(updates);
      SettingsUI.render(this.settings);
      if (this.settings.enabled) {
        this._clearMarkers();
        this._runFilterCycle();
      }
    },

    setEnabled(enabled) {
      if (!this.settings) return;
      const prev = this.settings.enabled;
      this.settings.enabled = !!enabled;
      SettingsService.save({ enabled: this.settings.enabled });
      SettingsUI.render(this.settings);
      if (this.settings.enabled && !prev) this.start();
      else if (!this.settings.enabled && prev) this.stop();
    },

    get enabled() {
      return !!(this.settings && this.settings.enabled);
    },

    start() {
      if (!this.enabled) return;
      if (!this.filteringActive) {
        this.filteringActive = true;
        this._patchHistory();
        if (document.body) {
          this._setupObservers();
        } else {
          document.addEventListener('DOMContentLoaded', () => this._setupObservers(), { once: true });
        }
      }
      this._runFilterCycle();
    },

    stop() {
      this.filteringActive = false;
      this._cleanupObservers();
      this._unpatchHistory();
      DOMService.showAllHiddenContent();
      LanguageService.clearCache();
    },

    _runFilterCycle() {
      if (this.filterTimeout) clearTimeout(this.filterTimeout);
      const run = () => {
        if (this.enabled) FilterService.filterContent(this.settings);
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run, { once: true });
      } else {
        this.filterTimeout = setTimeout(run, Config.timing.filterDelay);
      }
    },

    _setupObservers() {
      this._cleanupObservers();
      const target = document.body || document.documentElement;
      if (!target || typeof MutationObserver === 'undefined') return;

      this.observer = new MutationObserver((mutations) => {
        if (!this.enabled) return;

        if (window.location.href !== this.lastUrl) {
          this.lastUrl = window.location.href;
          this._clearMarkers();
          if (this.urlChangeTimer) clearTimeout(this.urlChangeTimer);
          this.urlChangeTimer = setTimeout(() => {
            this.urlChangeTimer = null;
            if (this.enabled && window.location.href === this.lastUrl) {
              FilterService.filterContent(this.settings);
            }
          }, Config.timing.urlChangeDelay);
          return;
        }

        for (const m of mutations) {
          for (const node of m.addedNodes || []) {
            if (node.nodeType === 1 /* ELEMENT_NODE */) {
              FilterService.processNewNode(node, this.settings);
            }
          }
        }
      });
      this.observer.observe(target, { childList: true, subtree: true });

      this.popstateHandler = () => {
        if (!this.enabled) return;
        this._clearMarkers();
        setTimeout(() => {
          if (this.enabled) FilterService.filterContent(this.settings);
        }, Config.timing.filterDelay);
      };
      window.addEventListener('popstate', this.popstateHandler);
    },

    _cleanupObservers() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      if (this.popstateHandler) {
        window.removeEventListener('popstate', this.popstateHandler);
        this.popstateHandler = null;
      }
    },

    _wrapHistoryMethod(name) {
      if (typeof window === 'undefined' || !window.history) return null;
      const original = window.history[name];
      const self = this;
      window.history[name] = function (...args) {
        const ret = original.apply(this, args);
        if (self.enabled) {
          self._clearMarkers();
          setTimeout(
            () => FilterService.filterContent(self.settings),
            Config.timing.filterDelay
          );
        }
        return ret;
      };
      return original;
    },

    _patchHistory() {
      if (this.originalPushState || typeof window === 'undefined' || !window.history) return;
      this.originalPushState = this._wrapHistoryMethod('pushState');
      this.originalReplaceState = this._wrapHistoryMethod('replaceState');
    },

    _unpatchHistory() {
      if (typeof window === 'undefined' || !window.history) return;
      if (this.originalPushState) {
        window.history.pushState = this.originalPushState;
        this.originalPushState = null;
      }
      if (this.originalReplaceState) {
        window.history.replaceState = this.originalReplaceState;
        this.originalReplaceState = null;
      }
    },

    _clearMarkers() {
      document.querySelectorAll(`[${DATA_ATTR.CHECKED}]`).forEach((el) => {
        el.removeAttribute(DATA_ATTR.CHECKED);
        el.removeAttribute(DATA_ATTR.LANG);
      });
      FilterService._loggedTexts.clear();
    },
  };

  // Expose for in-page debugging
  if (typeof window !== 'undefined') {
    window.YuLaF = {
      version: Constants.VERSION,
      Config,
      filter: Controller,
      settings: SettingsService,
      ui: SettingsUI,
    };
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
      TrigramDetector,
      TRIGRAM_TABLES,
      LanguageService,
      FilterService,
      Controller,
      Config,
      Constants,
      SettingsService,
      SettingsUI,
    };
  }
})();
