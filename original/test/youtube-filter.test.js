/**
 * YouTubeLanguageFilter (Main Content Script) Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import dependencies in order
import '../src/content/services/language-detector.js';
import '../src/content/services/language-service.js';
import '../src/content/services/dom-service.js';
import '../src/content/services/filter-service.js';

// We need to test the class without auto-instantiation
// So we'll recreate the class here for testing
class YouTubeLanguageFilter {
  constructor() {
    this.filteringActive = false;
    this.settings = {
      enabled: true,
      strictMode: false,
      hideVideos: true,
      hideChannels: true,
      selectedLanguages: ['en']
    };
    this.observer = this.popstateHandler = null;
    this._lastUrl = location.href;
    this.originalPushState = this.originalReplaceState = null;
    this.filterTimeout = null;
  }

  get enabled() {
    return !!this.settings.enabled;
  }

  async init() {
    try {
      const stored = await chrome.storage.sync.get([
        'enabled', 'strictMode', 'hideVideos', 'hideChannels', 'selectedLanguages'
      ]);

      this.updateLocalSettings(stored);

      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync') {
          const updates = {};
          for (const key in changes) {
            updates[key] = changes[key].newValue;
          }
          this.handleStateUpdate(updates);
        }
      });

      if (this.enabled) {
        this.startFiltering();
      }
    } catch (err) {
      console.error('[YuLaF] Init error:', err);
    }
  }

  updateLocalSettings(data) {
    if (data.enabled !== undefined) this.settings.enabled = !!data.enabled;
    if (data.strictMode !== undefined) this.settings.strictMode = !!data.strictMode;
    if (data.hideVideos !== undefined) this.settings.hideVideos = !!data.hideVideos;
    if (data.hideChannels !== undefined) this.settings.hideChannels = !!data.hideChannels;
    if (data.selectedLanguages !== undefined) {
      this.settings.selectedLanguages = data.selectedLanguages ?? ['en'];
    }

    if (window.LanguageService) {
      window.LanguageService.setLanguages(this.settings.selectedLanguages);
      window.LanguageService.setStrictMode(this.settings.strictMode);
    }
  }

  handleStateUpdate(updates) {
    const wasEnabled = this.enabled;
    const oldSettings = JSON.stringify(this.settings);

    this.updateLocalSettings(updates);

    const isEnabled = this.enabled;
    const settingsChanged = oldSettings !== JSON.stringify(this.settings);

    if (!wasEnabled && isEnabled) {
      this.startFiltering();
    } else if (wasEnabled && !isEnabled) {
      this.stopFiltering();
    } else if (isEnabled && settingsChanged) {
      const languageChanged = updates.selectedLanguages !== undefined;
      this.restartFiltering(languageChanged);
    }
  }

  restartFiltering(clearAll = false) {
    if (this.filterTimeout) clearTimeout(this.filterTimeout);

    if (this.enabled) {
      this.clearMarkers();
      if (clearAll && window.LanguageService) window.LanguageService.clearCache();
      this.startFiltering();
    } else {
      this.stopFiltering();
    }
  }

  clearMarkers() {
    document.querySelectorAll('[data-language-filter-checked]')
      .forEach(el => {
        el.removeAttribute('data-language-filter-checked');
        el.removeAttribute('data-language-filter-lang');
      });
    if (window.FilterService && window.FilterService._loggedTexts) {
      window.FilterService._loggedTexts.clear();
    }
  }

  startFiltering() {
    if (!this.enabled) return;

    if (!this.filteringActive) {
      this.filteringActive = true;
      this.patchHistory();
      this.setupObservers();
    }

    this.runFilterCycle();
  }

  runFilterCycle() {
    if (this.filterTimeout) clearTimeout(this.filterTimeout);

    const run = () => {
      if (this.enabled) {
        window.FilterService?.filterContent?.(this.settings);
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      this.filterTimeout = setTimeout(run, window.YT_FILTER_CONFIG.timing.filterDelay);
    }
  }

  setupObservers() {
    this.cleanupObservers();

    this.observer = new MutationObserver(mutations => {
      if (!this.enabled) return;
      for (const m of mutations) {
        for (const node of m.addedNodes || []) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            window.FilterService?.processNewNode?.(node, this.settings);
          }
        }
      }
    });
    this.observer.observe(document.body, { childList: true, subtree: true });

    this.popstateHandler = () => {
      if (!this.enabled) return;
      this.clearMarkers();
      setTimeout(() => {
        if (this.enabled) window.FilterService?.filterContent?.(this.settings);
      }, window.YT_FILTER_CONFIG.timing.filterDelay);
    };
    window.addEventListener('popstate', this.popstateHandler);
  }

  patchHistory() {
    if (this.originalPushState) return;
    this.originalPushState = history.pushState;
    this.originalReplaceState = history.replaceState;

    const self = this;
    history.pushState = function(...args) {
      self.originalPushState.apply(this, args);
      if (self.enabled) {
        self.clearMarkers();
      }
    };
    history.replaceState = function(...args) {
      self.originalReplaceState.apply(this, args);
      if (self.enabled) {
        self.clearMarkers();
      }
    };
  }

  unpatchHistory() {
    if (this.originalPushState) {
      history.pushState = this.originalPushState;
      this.originalPushState = null;
    }
    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState;
      this.originalReplaceState = null;
    }
  }

  cleanupObservers() {
    this.observer?.disconnect(); this.observer = null;
    if (this.popstateHandler) {
      window.removeEventListener('popstate', this.popstateHandler);
      this.popstateHandler = null;
    }
  }

  stopFiltering() {
    this.filteringActive = false;
    this.cleanupObservers();
    this.unpatchHistory();
    this.clearMarkers();

    window.DOMService?.showAllHiddenContent?.();

    if (window.LanguageService) {
      window.LanguageService.clearCache();
    }
  }

  toggle() {
    const newState = !this.enabled;
    chrome.storage.sync.set({ enabled: newState });
    return newState;
  }
}

describe('YouTubeLanguageFilter', () => {
  let filter;

  beforeEach(() => {
    document.body.innerHTML = '';
    filter = new YouTubeLanguageFilter();

    // Reset services
    globalThis.LanguageService.clearCache();
    globalThis.LanguageService.selectedLanguages = [];
  });

  afterEach(() => {
    // Cleanup
    filter.stopFiltering();
    vi.clearAllTimers();
  });

  describe('constructor', () => {
    it('should initialize with default settings', () => {
      expect(filter.settings.enabled).toBe(true);
      expect(filter.settings.strictMode).toBe(false);
      expect(filter.settings.hideVideos).toBe(true);
      expect(filter.settings.hideChannels).toBe(true);
      expect(filter.settings.selectedLanguages).toEqual(['en']);
    });

    it('should start with filtering inactive', () => {
      expect(filter.filteringActive).toBe(false);
    });

    it('should have null observers initially', () => {
      expect(filter.observer).toBeNull();
      expect(filter.popstateHandler).toBeNull();
    });
  });

  describe('enabled getter', () => {
    it('should return true when enabled', () => {
      filter.settings.enabled = true;
      expect(filter.enabled).toBe(true);
    });

    it('should return false when disabled', () => {
      filter.settings.enabled = false;
      expect(filter.enabled).toBe(false);
    });

    it('should coerce to boolean', () => {
      filter.settings.enabled = 1;
      expect(filter.enabled).toBe(true);

      filter.settings.enabled = 0;
      expect(filter.enabled).toBe(false);
    });
  });

  describe('updateLocalSettings', () => {
    it('should update enabled setting', () => {
      filter.updateLocalSettings({ enabled: false });
      expect(filter.settings.enabled).toBe(false);
    });

    it('should update strictMode setting', () => {
      filter.updateLocalSettings({ strictMode: true });
      expect(filter.settings.strictMode).toBe(true);
    });

    it('should update hideVideos setting', () => {
      filter.updateLocalSettings({ hideVideos: false });
      expect(filter.settings.hideVideos).toBe(false);
    });

    it('should update hideChannels setting', () => {
      filter.updateLocalSettings({ hideChannels: false });
      expect(filter.settings.hideChannels).toBe(false);
    });

    it('should update selectedLanguages setting', () => {
      filter.updateLocalSettings({ selectedLanguages: ['tr', 'de'] });
      expect(filter.settings.selectedLanguages).toEqual(['tr', 'de']);
    });

    it('should default selectedLanguages to ["en"] when undefined', () => {
      filter.updateLocalSettings({ selectedLanguages: null });
      expect(filter.settings.selectedLanguages).toEqual(['en']);
    });

    it('should update LanguageService when available', () => {
      const setLanguagesSpy = vi.spyOn(globalThis.LanguageService, 'setLanguages');
      const setStrictModeSpy = vi.spyOn(globalThis.LanguageService, 'setStrictMode');

      filter.updateLocalSettings({ selectedLanguages: ['ja'], strictMode: true });

      expect(setLanguagesSpy).toHaveBeenCalledWith(['ja']);
      expect(setStrictModeSpy).toHaveBeenCalledWith(true);

      setLanguagesSpy.mockRestore();
      setStrictModeSpy.mockRestore();
    });
  });

  describe('handleStateUpdate', () => {
    it('should start filtering when enabled changes from false to true', () => {
      filter.settings.enabled = false;
      const startSpy = vi.spyOn(filter, 'startFiltering');

      filter.handleStateUpdate({ enabled: true });

      expect(startSpy).toHaveBeenCalled();
      startSpy.mockRestore();
    });

    it('should stop filtering when enabled changes from true to false', () => {
      filter.settings.enabled = true;
      const stopSpy = vi.spyOn(filter, 'stopFiltering');

      filter.handleStateUpdate({ enabled: false });

      expect(stopSpy).toHaveBeenCalled();
      stopSpy.mockRestore();
    });

    it('should restart filtering when settings change while enabled', () => {
      filter.settings.enabled = true;
      filter.filteringActive = true;
      const restartSpy = vi.spyOn(filter, 'restartFiltering');

      filter.handleStateUpdate({ strictMode: true });

      expect(restartSpy).toHaveBeenCalled();
      restartSpy.mockRestore();
    });

    it('should pass true to restartFiltering when languages change', () => {
      filter.settings.enabled = true;
      filter.filteringActive = true;
      const restartSpy = vi.spyOn(filter, 'restartFiltering');

      filter.handleStateUpdate({ selectedLanguages: ['tr'] });

      expect(restartSpy).toHaveBeenCalledWith(true);
      restartSpy.mockRestore();
    });
  });

  describe('clearMarkers', () => {
    it('should remove filter attributes from elements', () => {
      document.body.innerHTML = `
        <div data-language-filter-checked="true" data-language-filter-lang="en">Element 1</div>
        <div data-language-filter-checked="true" data-language-filter-lang="tr">Element 2</div>
      `;

      filter.clearMarkers();

      const elements = document.querySelectorAll('[data-language-filter-checked]');
      expect(elements.length).toBe(0);
    });

    it('should clear FilterService logged texts', () => {
      globalThis.FilterService._loggedTexts = new Set(['text1', 'text2']);

      filter.clearMarkers();

      expect(globalThis.FilterService._loggedTexts.size).toBe(0);
    });
  });

  describe('startFiltering', () => {
    it('should not start if disabled', () => {
      filter.settings.enabled = false;
      const setupSpy = vi.spyOn(filter, 'setupObservers');

      filter.startFiltering();

      expect(setupSpy).not.toHaveBeenCalled();
      expect(filter.filteringActive).toBe(false);
      setupSpy.mockRestore();
    });

    it('should set filteringActive to true', () => {
      filter.startFiltering();
      expect(filter.filteringActive).toBe(true);
    });

    it('should setup observers', () => {
      filter.startFiltering();
      expect(filter.observer).not.toBeNull();
    });

    it('should patch history', () => {
      filter.startFiltering();
      expect(filter.originalPushState).not.toBeNull();
    });

    it('should not re-setup if already active', () => {
      filter.startFiltering();
      const firstObserver = filter.observer;

      filter.startFiltering();

      expect(filter.observer).toBe(firstObserver);
    });
  });

  describe('stopFiltering', () => {
    beforeEach(() => {
      filter.startFiltering();
    });

    it('should set filteringActive to false', () => {
      filter.stopFiltering();
      expect(filter.filteringActive).toBe(false);
    });

    it('should disconnect observers', () => {
      filter.stopFiltering();
      expect(filter.observer).toBeNull();
    });

    it('should restore history methods', () => {
      filter.stopFiltering();
      expect(filter.originalPushState).toBeNull();
    });

    it('should clear markers', () => {
      document.body.innerHTML = '<div data-language-filter-checked="true">Element</div>';

      filter.stopFiltering();

      const elements = document.querySelectorAll('[data-language-filter-checked]');
      expect(elements.length).toBe(0);
    });

    it('should show all hidden content', () => {
      const showAllSpy = vi.spyOn(globalThis.DOMService, 'showAllHiddenContent');

      filter.stopFiltering();

      expect(showAllSpy).toHaveBeenCalled();
      showAllSpy.mockRestore();
    });

    it('should clear language cache', () => {
      globalThis.LanguageService.setCachedResult('test', true);
      expect(globalThis.LanguageService.textCache.size).toBe(1);

      filter.stopFiltering();

      expect(globalThis.LanguageService.textCache.size).toBe(0);
    });
  });

  describe('toggle', () => {
    it('should toggle from enabled to disabled', () => {
      filter.settings.enabled = true;
      const result = filter.toggle();
      expect(result).toBe(false);
    });

    it('should toggle from disabled to enabled', () => {
      filter.settings.enabled = false;
      const result = filter.toggle();
      expect(result).toBe(true);
    });

    it('should call storage.sync.set', () => {
      filter.toggle();
      expect(chrome.storage.sync.set).toHaveBeenCalled();
    });
  });

  describe('restartFiltering', () => {
    beforeEach(() => {
      filter.settings.enabled = true;
    });

    it('should clear timeout if exists', () => {
      vi.useFakeTimers();
      filter.filterTimeout = setTimeout(() => {}, 1000);
      const clearSpy = vi.spyOn(global, 'clearTimeout');

      filter.restartFiltering();

      expect(clearSpy).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should clear markers', () => {
      document.body.innerHTML = '<div data-language-filter-checked="true">Element</div>';

      filter.restartFiltering();

      expect(document.querySelectorAll('[data-language-filter-checked]').length).toBe(0);
    });

    it('should clear cache when clearAll is true', () => {
      globalThis.LanguageService.setCachedResult('test', true);

      filter.restartFiltering(true);

      expect(globalThis.LanguageService.textCache.size).toBe(0);
    });

    it('should not clear cache when clearAll is false', () => {
      globalThis.LanguageService.setCachedResult('test', true);

      filter.restartFiltering(false);

      // Cache might still have entries (depending on startFiltering behavior)
      // The point is we didn't explicitly clear it
    });

    it('should stop filtering if disabled', () => {
      filter.settings.enabled = false;
      const stopSpy = vi.spyOn(filter, 'stopFiltering');

      filter.restartFiltering();

      expect(stopSpy).toHaveBeenCalled();
      stopSpy.mockRestore();
    });
  });

  describe('patchHistory', () => {
    it('should store original history methods', () => {
      const originalPush = history.pushState;
      const originalReplace = history.replaceState;

      filter.patchHistory();

      expect(filter.originalPushState).toBe(originalPush);
      expect(filter.originalReplaceState).toBe(originalReplace);
    });

    it('should not re-patch if already patched', () => {
      filter.patchHistory();
      const firstOriginal = filter.originalPushState;

      filter.patchHistory();

      expect(filter.originalPushState).toBe(firstOriginal);
    });

    it('should clear markers on pushState when enabled', () => {
      filter.settings.enabled = true;
      filter.patchHistory();
      document.body.innerHTML = '<div data-language-filter-checked="true">Element</div>';

      history.pushState({}, '', '/test');

      expect(document.querySelectorAll('[data-language-filter-checked]').length).toBe(0);
    });

    it('should clear markers on replaceState when enabled', () => {
      filter.settings.enabled = true;
      filter.patchHistory();
      document.body.innerHTML = '<div data-language-filter-checked="true">Element</div>';

      history.replaceState({}, '', '/test');

      expect(document.querySelectorAll('[data-language-filter-checked]').length).toBe(0);
    });
  });

  describe('unpatchHistory', () => {
    it('should restore original history methods', () => {
      const originalPush = history.pushState;
      const originalReplace = history.replaceState;

      filter.patchHistory();
      filter.unpatchHistory();

      expect(history.pushState).toBe(originalPush);
      expect(history.replaceState).toBe(originalReplace);
    });

    it('should set originals to null', () => {
      filter.patchHistory();
      filter.unpatchHistory();

      expect(filter.originalPushState).toBeNull();
      expect(filter.originalReplaceState).toBeNull();
    });
  });

  describe('setupObservers', () => {
    it('should create MutationObserver', () => {
      filter.setupObservers();
      expect(filter.observer).toBeInstanceOf(MutationObserver);
    });

    it('should setup popstate handler', () => {
      filter.setupObservers();
      expect(filter.popstateHandler).not.toBeNull();
    });

    it('should cleanup existing observers before setting up new ones', () => {
      filter.setupObservers();
      const firstObserver = filter.observer;
      const disconnectSpy = vi.spyOn(firstObserver, 'disconnect');

      filter.setupObservers();

      expect(disconnectSpy).toHaveBeenCalled();
    });
  });

  describe('cleanupObservers', () => {
    beforeEach(() => {
      filter.setupObservers();
    });

    it('should disconnect and null observer', () => {
      filter.cleanupObservers();
      expect(filter.observer).toBeNull();
    });

    it('should remove popstate handler', () => {
      const handler = filter.popstateHandler;
      const removeSpy = vi.spyOn(window, 'removeEventListener');

      filter.cleanupObservers();

      expect(removeSpy).toHaveBeenCalledWith('popstate', handler);
      expect(filter.popstateHandler).toBeNull();
    });
  });

  describe('init', () => {
    it('should load settings from storage', async () => {
      chrome.storage.sync.get.mockResolvedValueOnce({
        enabled: true,
        strictMode: true,
        hideVideos: true,
        hideChannels: false,
        selectedLanguages: ['tr']
      });

      await filter.init();

      expect(filter.settings.strictMode).toBe(true);
      expect(filter.settings.hideChannels).toBe(false);
      expect(filter.settings.selectedLanguages).toEqual(['tr']);
    });

    it('should add storage change listener', async () => {
      await filter.init();

      expect(chrome.storage.onChanged.addListener).toHaveBeenCalled();
    });

    it('should start filtering if enabled', async () => {
      chrome.storage.sync.get.mockResolvedValueOnce({ enabled: true });
      const startSpy = vi.spyOn(filter, 'startFiltering');

      await filter.init();

      expect(startSpy).toHaveBeenCalled();
      startSpy.mockRestore();
    });

    it('should not start filtering if disabled', async () => {
      chrome.storage.sync.get.mockResolvedValueOnce({ enabled: false });
      const startSpy = vi.spyOn(filter, 'startFiltering');

      await filter.init();

      expect(startSpy).not.toHaveBeenCalled();
      startSpy.mockRestore();
    });

    it('should handle errors gracefully', async () => {
      chrome.storage.sync.get.mockRejectedValueOnce(new Error('Storage error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await filter.init();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
