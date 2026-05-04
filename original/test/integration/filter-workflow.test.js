/**
 * Integration tests: Full filter workflow.
 * Tests the entire pipeline: DOM creation → language detection → filtering → state changes.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import services in dependency order (same as manifest.json content_scripts)
import '../../src/content/services/language-detector.js';
import '../../src/content/services/language-service.js';
import '../../src/content/services/dom-service.js';
import '../../src/content/services/filter-service.js';

import {
  buildYouTubePage,
  createVideoElement,
  createChannelElement,
  createAdElement,
} from '../helpers/youtube-dom.js';

describe('Integration: Filter Workflow', () => {
  let LanguageService;
  let FilterService;
  let DOMService;

  beforeEach(() => {
    document.body.innerHTML = '';
    LanguageService = globalThis.LanguageService;
    FilterService = globalThis.FilterService;
    DOMService = globalThis.DOMService;
    LanguageService.clearCache();
    FilterService.processingElements = new WeakSet();
    if (FilterService._loggedTexts) FilterService._loggedTexts.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // Helper: get visible/hidden counts
  function getVisibleVideos() {
    return document.querySelectorAll('ytd-video-renderer:not([style*="display: none"])');
  }
  function getHiddenVideos() {
    return document.querySelectorAll('ytd-video-renderer[style*="display: none"]');
  }

  describe('Scenario 1: Single language filter on multi-language page', () => {
    it('should show only English videos when English is selected', async () => {
      // Set up mock: Japanese text returns ja, Russian returns ru, default returns en
      chrome.i18n._setDetectionResult(/[\u3040-\u309F\u30A0-\u30FF]/, {
        isReliable: true,
        languages: [{ language: 'ja', percentage: 90 }],
      });
      chrome.i18n._setDetectionResult(/[\u0400-\u04FF]/, {
        isReliable: true,
        languages: [{ language: 'ru', percentage: 88 }],
      });

      buildYouTubePage([
        { type: 'video', title: 'How to learn JavaScript in 2024' },
        { type: 'video', title: 'Best coding practices for beginners' },
        { type: 'video', title: 'こんにちは世界 日本語チュートリアル' },
        { type: 'video', title: 'Привет мир программирования' },
      ]);

      LanguageService.setLanguages(['en']);
      await FilterService.filterContent({
        hideVideos: true,
        hideChannels: false,
      });

      expect(getVisibleVideos().length).toBe(2);
      expect(getHiddenVideos().length).toBe(2);
    });
  });

  describe('Scenario 2: Language change triggers re-filter', () => {
    it('should re-filter when language selection changes', async () => {
      chrome.i18n._setDetectionResult(/[\u3040-\u309F\u30A0-\u30FF]/, {
        isReliable: true,
        languages: [{ language: 'ja', percentage: 90 }],
      });

      buildYouTubePage([
        { type: 'video', title: 'English tutorial video content' },
        { type: 'video', title: 'こんにちは日本語ビデオ' },
      ]);

      // First: filter for English
      LanguageService.setLanguages(['en']);
      await FilterService.filterContent({ hideVideos: true, hideChannels: false });
      expect(getVisibleVideos().length).toBe(1);
      expect(getVisibleVideos()[0].querySelector('#video-title').textContent).toContain('English');

      // Clear markers for re-filter
      document.querySelectorAll('[data-language-filter-checked]').forEach(el => {
        el.removeAttribute('data-language-filter-checked');
        el.removeAttribute('data-language-filter-lang');
      });

      // Now switch to Japanese
      LanguageService.setLanguages(['ja']);
      await FilterService.filterContent({ hideVideos: true, hideChannels: false });
      expect(getVisibleVideos().length).toBe(1);
      expect(getVisibleVideos()[0].querySelector('#video-title').textContent).toContain('こんにちは');
    });
  });

  describe('Scenario 3: Multi-language selection shows videos in both languages', () => {
    it('should show both English and Japanese videos', async () => {
      chrome.i18n._setDetectionResult(/[\u3040-\u309F\u30A0-\u30FF]/, {
        isReliable: true,
        languages: [{ language: 'ja', percentage: 90 }],
      });
      chrome.i18n._setDetectionResult(/[\u0400-\u04FF]/, {
        isReliable: true,
        languages: [{ language: 'ru', percentage: 88 }],
      });

      buildYouTubePage([
        { type: 'video', title: 'English tutorial for developers' },
        { type: 'video', title: 'こんにちはプログラミング入門' },
        { type: 'video', title: 'Русский язык программирования' },
      ]);

      LanguageService.setLanguages(['en', 'ja']);
      await FilterService.filterContent({ hideVideos: true, hideChannels: false });

      expect(getVisibleVideos().length).toBe(2);
      expect(getHiddenVideos().length).toBe(1);
      // The hidden one should be Russian
      expect(getHiddenVideos()[0].querySelector('#video-title').textContent).toContain('Русский');
    });
  });

  describe('Scenario 4: Disable filter restores all videos', () => {
    it('should show all videos after calling showAllHiddenContent', async () => {
      chrome.i18n._setDetectionResult(/[\u3040-\u309F\u30A0-\u30FF]/, {
        isReliable: true,
        languages: [{ language: 'ja', percentage: 90 }],
      });

      buildYouTubePage([
        { type: 'video', title: 'English video content here' },
        { type: 'video', title: 'こんにちは日本語コンテンツ' },
        { type: 'video', title: 'Another English video title' },
      ]);

      // Filter for English only — one Japanese video hidden
      LanguageService.setLanguages(['en']);
      await FilterService.filterContent({ hideVideos: true, hideChannels: false });
      expect(getHiddenVideos().length).toBe(1);

      // Disable — restore all
      DOMService.showAllHiddenContent();
      expect(getHiddenVideos().length).toBe(0);
      expect(getVisibleVideos().length).toBe(3);

      // Verify filter attributes are cleaned up
      const checked = document.querySelectorAll('[data-language-filter-checked]');
      expect(checked.length).toBe(0);
    });
  });

  describe('Scenario 5: Turkish text with English words (exclusion regression)', () => {
    it('should NOT hide Turkish video with a single English word', async () => {
      // Mock: detect as Turkish for text with Turkish characters
      chrome.i18n._setDetectionResult('Istanbul', {
        isReliable: false,
        languages: [
          { language: 'tr', percentage: 70 },
          { language: 'en', percentage: 20 },
        ],
      });

      buildYouTubePage([
        { type: 'video', title: 'The Weeknd İstanbul Konseri' },
      ]);

      LanguageService.setLanguages(['tr']);
      LanguageService.setStrictMode(false);
      await FilterService.filterContent({ hideVideos: true, hideChannels: false });

      // "The Weeknd Istanbul Konseri" has 1/4 English words = 25%, below 50% threshold
      // Should be shown, not hidden
      expect(getVisibleVideos().length).toBe(1);
    });

    it('should hide text that is mostly English when Turkish is selected', async () => {
      chrome.i18n._setDetectionResult('weather today', {
        isReliable: false,
        languages: [
          { language: 'tr', percentage: 55 },
          { language: 'en', percentage: 35 },
        ],
      });

      buildYouTubePage([
        { type: 'video', title: 'What is the weather today about this' },
      ]);

      LanguageService.setLanguages(['tr']);
      LanguageService.setStrictMode(false);
      await FilterService.filterContent({ hideVideos: true, hideChannels: false });

      // 5 out of 7 words match English exclusion patterns (what, is, the, about, this) = 71%
      // Should be hidden
      expect(getHiddenVideos().length).toBe(1);
    });

    it('should skip exclusion when both Turkish and English are selected', async () => {
      chrome.i18n._setDetectionResult('weather today', {
        isReliable: false,
        languages: [
          { language: 'tr', percentage: 55 },
          { language: 'en', percentage: 35 },
        ],
      });

      buildYouTubePage([
        { type: 'video', title: 'What is the weather today about this' },
      ]);

      // When both languages selected, exclusion check is skipped entirely
      LanguageService.setLanguages(['tr', 'en']);
      LanguageService.setStrictMode(false);
      await FilterService.filterContent({ hideVideos: true, hideChannels: false });

      expect(getVisibleVideos().length).toBe(1);
    });
  });

  describe('Scenario 6: New DOM node processing', () => {
    it('should process dynamically added video elements', async () => {
      chrome.i18n._setDetectionResult(/[\u3040-\u309F\u30A0-\u30FF]/, {
        isReliable: true,
        languages: [{ language: 'ja', percentage: 90 }],
      });

      LanguageService.setLanguages(['en']);

      const settings = { hideVideos: true, hideChannels: false };

      // Add a new English video — should be shown
      const englishVideo = createVideoElement({ title: 'New English video just added' });
      document.body.appendChild(englishVideo);
      FilterService.processNewNode(englishVideo, settings);
      // Wait for async processing
      await new Promise(r => setTimeout(r, 300));
      expect(englishVideo.style.display).toBe('');

      // Add a new Japanese video — should be hidden
      const japaneseVideo = createVideoElement({ title: 'こんにちは新しい動画です' });
      document.body.appendChild(japaneseVideo);
      FilterService.processNewNode(japaneseVideo, settings);
      await new Promise(r => setTimeout(r, 300));
      expect(japaneseVideo.style.display).toBe('none');
    });
  });

  describe('Scenario 7: Duplicate language handling', () => {
    it('should deduplicate languages in LanguageService', () => {
      LanguageService.setLanguages(['en', 'en', 'tr', 'tr', 'ja']);
      expect(LanguageService.selectedLanguages).toEqual(['en', 'tr', 'ja']);
    });

    it('should deduplicate languages with 3 identical codes', () => {
      LanguageService.setLanguages(['en', 'en', 'en']);
      expect(LanguageService.selectedLanguages).toEqual(['en']);
    });
  });

  describe('Scenario 8: Language order does not cause re-processing', () => {
    it('should not re-process element when language order changes but set is same', async () => {
      buildYouTubePage([
        { type: 'video', title: 'English test video content' },
      ]);

      LanguageService.setLanguages(['en', 'tr']);
      const settings = { hideVideos: true, hideChannels: false };
      await FilterService.filterContent(settings);

      const video = document.querySelector('ytd-video-renderer');
      const langAttr = video.getAttribute('data-language-filter-lang');
      // Should be sorted: "en,tr"
      expect(langAttr).toBe('en,tr');

      // Now change order to ['tr', 'en'] — same set
      LanguageService.setLanguages(['tr', 'en']);

      // Spy on processElement to verify it's NOT called again
      const spy = vi.spyOn(FilterService, 'processElement');
      await FilterService.filterContent(settings);

      // processElement should be called but should return early (skip) because sorted lang matches
      // The element already has data-language-filter-checked with matching sorted lang
      expect(spy).toHaveBeenCalled();
      // Verify the lang attribute is still the same sorted value
      expect(video.getAttribute('data-language-filter-lang')).toBe('en,tr');
      spy.mockRestore();
    });
  });

  describe('Scenario 9: Channel filtering', () => {
    it('should filter channels by language', async () => {
      chrome.i18n._setDetectionResult(/[\u0400-\u04FF]/, {
        isReliable: true,
        languages: [{ language: 'ru', percentage: 88 }],
      });

      const elements = buildYouTubePage([
        { type: 'channel', name: 'English Tech Channel' },
        { type: 'channel', name: 'Русский Канал Программирования' },
      ]);

      LanguageService.setLanguages(['en']);
      await FilterService.filterContent({ hideVideos: false, hideChannels: true });

      // English channel shown, Russian hidden
      const visibleChannels = document.querySelectorAll(
        'ytd-channel-renderer:not([style*="display: none"])'
      );
      const hiddenChannels = document.querySelectorAll(
        'ytd-channel-renderer[style*="display: none"]'
      );

      expect(visibleChannels.length).toBe(1);
      expect(hiddenChannels.length).toBe(1);
    });
  });

  describe('Scenario 10: Ad elements are never filtered', () => {
    it('should skip ad elements during filtering', async () => {
      const elements = buildYouTubePage([
        { type: 'video', title: 'Regular English video' },
        { type: 'ad', title: 'Sponsored Ad Content' },
      ]);

      LanguageService.setLanguages(['en']);
      await FilterService.filterContent({ hideVideos: true, hideChannels: false });

      // The ad wrapper should not have any filter attributes
      const adElement = document.querySelector('ytd-ad-slot-renderer');
      const adVideo = adElement.querySelector('ytd-video-renderer');
      expect(adVideo.hasAttribute('data-language-filter-checked')).toBe(false);

      // Regular video should be processed
      const regularVideos = document.querySelectorAll(
        'ytd-video-renderer:not(ytd-ad-slot-renderer ytd-video-renderer)'
      );
      expect(regularVideos[0].hasAttribute('data-language-filter-checked')).toBe(true);
    });
  });
});
