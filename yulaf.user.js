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
  };

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
      title: ['#video-title', 'a#video-title', 'h3 a[href*="/watch"]', 'h3'],
    },
  };

  // ── DOMService (stub — Task 2 will port the real one) ──────────────────────
  const DOMService = {
    getAllElements() {
      return Array.from(document.querySelectorAll(Config.selectors.video.join(',')));
    },
  };

  // ── LanguageDetector (stub — Task 3) ───────────────────────────────────────
  const LanguageDetector = {
    detect() {
      return null;
    },
  };

  // ── LanguageService (stub — Task 3) ────────────────────────────────────────
  const LanguageService = {
    detect(text) {
      return LanguageDetector.detect(text);
    },
  };

  // ── FilterService (stub — Task 5) ──────────────────────────────────────────
  const FilterService = {
    process(el) {
      el.setAttribute('data-yulaf-processed', '1');
    },
  };

  // ── Controller — minimal wiring stub for Task 1 e2e round-trip ─────────────
  const Controller = {
    init() {
      const run = () => {
        for (const el of DOMService.getAllElements()) {
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
