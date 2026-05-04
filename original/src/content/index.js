class YouTubeLanguageFilter {
  constructor() {
    this.filteringActive = false;
    const defaults = window.YT_FILTER_CONSTANTS?.DEFAULTS || {};
    this.settings = {
      enabled: defaults.enabled ?? true,
      strictMode: defaults.strictMode ?? false,
      hideVideos: defaults.hideVideos ?? true,
      hideChannels: defaults.hideChannels ?? true,
      selectedLanguages: defaults.selectedLanguages ?? ['en'],
    };
    this.observer = this.popstateHandler = null;
    this._lastUrl = location.href;
    this.originalPushState = this.originalReplaceState = null;
    this.filterTimeout = null;
    this._urlChangeTimer = null;
    this.init();
  }

  // Source of truth for external services
  get enabled() {
    return !!this.settings.enabled;
  }

  async init() {
    try {
      const stored = await chrome.storage.sync.get([
        'enabled',
        'strictMode',
        'hideVideos',
        'hideChannels',
        'selectedLanguages',
      ]);

      this.updateLocalSettings(stored);

      // Listen for ANY storage changes
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
      console.warn('[YuLaF] Init error:', err.message || err);
    }
  }

  updateLocalSettings(data) {
    if (data.enabled !== undefined) this.settings.enabled = !!data.enabled;
    if (data.strictMode !== undefined) this.settings.strictMode = !!data.strictMode;
    if (data.hideVideos !== undefined) this.settings.hideVideos = !!data.hideVideos;
    if (data.hideChannels !== undefined) this.settings.hideChannels = !!data.hideChannels;
    if (data.selectedLanguages !== undefined) {
      this.settings.selectedLanguages = [...new Set(data.selectedLanguages ?? ['en'])];
    }

    if (window.LanguageService) {
      window.LanguageService.setLanguages(this.settings.selectedLanguages);
      window.LanguageService.setStrictMode(this.settings.strictMode);
    }
  }

  _settingsEqual(a, b) {
    if (a.enabled !== b.enabled) return false;
    if (a.strictMode !== b.strictMode) return false;
    if (a.hideVideos !== b.hideVideos) return false;
    if (a.hideChannels !== b.hideChannels) return false;
    if (a.selectedLanguages.length !== b.selectedLanguages.length) return false;
    const sortedA = [...a.selectedLanguages].sort();
    const sortedB = [...b.selectedLanguages].sort();
    return sortedA.every((lang, i) => lang === sortedB[i]);
  }

  handleStateUpdate(updates) {
    const wasEnabled = this.enabled;
    const oldSettings = {
      ...this.settings,
      selectedLanguages: [...this.settings.selectedLanguages],
    };

    this.updateLocalSettings(updates);

    const isEnabled = this.enabled;
    const settingsChanged = !this._settingsEqual(oldSettings, this.settings);

    if (!wasEnabled && isEnabled) {
      // Extension enabled
      this.startFiltering();
    } else if (wasEnabled && !isEnabled) {
      // Extension disabled
      this.stopFiltering();
    } else if (isEnabled && settingsChanged) {
      // Extension was already on, settings changed
      const languageChanged = updates.selectedLanguages !== undefined;
      this.restartFiltering(languageChanged);
    }
    // If extension is disabled and settings change, do nothing.
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
    document.querySelectorAll(`[${DATA_ATTR.CHECKED}]`).forEach(el => {
      el.removeAttribute(DATA_ATTR.CHECKED);
      el.removeAttribute(DATA_ATTR.LANG);
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

    // Single unified MutationObserver for both DOM changes and URL change detection
    this.observer = new MutationObserver(mutations => {
      if (!this.enabled) return;

      // URL change detection (replaces separate urlObserver) with debounce
      if (location.href !== this._lastUrl) {
        this._lastUrl = location.href;
        this.clearMarkers();
        if (this._urlChangeTimer) clearTimeout(this._urlChangeTimer);
        this._urlChangeTimer = setTimeout(() => {
          this._urlChangeTimer = null;
          if (this.enabled && location.href === this._lastUrl) {
            window.FilterService?.filterContent?.(this.settings);
          }
        }, window.YT_FILTER_CONFIG.timing.urlChangeDelay);
        return; // Full re-filter will run, skip individual node processing
      }

      // Process new DOM nodes
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

  _wrapHistoryMethod(methodName) {
    const original = history[methodName];
    const self = this;
    history[methodName] = function (...args) {
      try {
        original.apply(this, args);
      } catch (err) {
        console.warn(`[YuLaF] ${methodName} failed:`, err.message || err);
        throw err;
      }
      try {
        if (self.enabled) {
          self.clearMarkers();
          setTimeout(
            () => window.FilterService?.filterContent?.(self.settings),
            window.YT_FILTER_CONFIG.timing.filterDelay
          );
        }
      } catch (err) {
        console.warn(`[YuLaF] ${methodName} filter callback failed:`, err.message || err);
      }
    };
    return original;
  }

  patchHistory() {
    if (this.originalPushState) return;
    this.originalPushState = this._wrapHistoryMethod('pushState');
    this.originalReplaceState = this._wrapHistoryMethod('replaceState');
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
    this.observer?.disconnect();
    this.observer = null;
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

    // Pass 1: Immediate cleanup
    window.DOMService?.showAllHiddenContent?.();

    // Pass 2: Delayed cleanup to catch any async processes that finished late
    setTimeout(() => {
      window.DOMService?.showAllHiddenContent?.();
    }, window.YT_FILTER_CONSTANTS?.TIMING?.STOP_FILTER_CLEANUP_DELAY || 150);

    if (window.LanguageService) {
      window.LanguageService.clearCache();
    }
  }

  toggle() {
    const newState = !this.enabled;
    chrome.storage.sync.set({ enabled: newState }).catch(err => {
      console.warn('[YuLaF] Toggle storage write failed:', err.message || err);
    });
    return newState;
  }
}

const filter = new YouTubeLanguageFilter();
window.YT_FILTER_INSTANCE = filter;

// Message listener (Only for READ ops)
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  // Verify sender is this extension
  if (sender.id !== chrome.runtime.id) return;
  try {
    switch (req.action) {
      case 'toggle':
        return sendResponse({ enabled: filter.toggle() });
      case 'getLanguages':
        return sendResponse({ languages: window.YT_FILTER_CONFIG?.languages || {} });
      case 'getCacheStats':
        return sendResponse({
          stats: window.LanguageService?.getCacheStats?.() || null,
          success: true,
        });
      case 'getStatus':
        return sendResponse({ enabled: filter.enabled, settings: filter.settings });
      case 'updateState':
        if (req.state) {
          // Whitelist allowed keys to prevent arbitrary storage writes
          const allowedKeys = [
            'enabled',
            'strictMode',
            'hideVideos',
            'hideChannels',
            'selectedLanguages',
            'sortBy',
          ];
          const safeState = {};
          for (const key of allowedKeys) {
            if (key in req.state) {
              if (key === 'selectedLanguages') {
                const langs = req.state.selectedLanguages;
                if (
                  Array.isArray(langs) &&
                  langs.length <=
                    (window.YT_FILTER_CONSTANTS?.LIMITS?.MAX_SELECTED_LANGUAGES || 30) &&
                  langs.every(
                    l =>
                      typeof l === 'string' &&
                      l.length <=
                        (window.YT_FILTER_CONSTANTS?.LIMITS?.MAX_LANGUAGE_CODE_LENGTH || 5)
                  )
                ) {
                  safeState.selectedLanguages = [...new Set(langs)];
                }
              } else if (key === 'sortBy') {
                const val = req.state[key];
                if (typeof val === 'string' && (val === 'popularity' || val === 'alphabetical')) {
                  safeState[key] = val;
                }
              } else {
                // Boolean fields: enabled, strictMode, hideVideos, hideChannels
                const val = req.state[key];
                if (typeof val === 'boolean') {
                  safeState[key] = val;
                }
              }
            }
          }
          if (Object.keys(safeState).length > 0) {
            chrome.storage.sync.set(safeState).catch(err => {
              console.warn('[YuLaF] Failed to save state:', err.message || err);
            });
          }
        }
        return sendResponse({ success: true });
      default:
        return sendResponse({ error: 'Unknown action' });
    }
  } catch (e) {
    return sendResponse({ error: e.message });
  }
});

// Keyboard shortcut fallback (Alt+Y / Ctrl+Y on Mac)
// chrome.commands suggested_key only applies on fresh install;
// this listener ensures the shortcut always works on YouTube pages.
// Uses window-level capture phase to fire before YouTube's own handlers.
(() => {
  let altYHandled = false;

  window.addEventListener(
    'keydown',
    e => {
      if (e.code === 'KeyY' && e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        altYHandled = true;
        filter.toggle();
      }
    },
    true
  );

  // Fallback: some browsers swallow Alt+key in keydown
  window.addEventListener(
    'keyup',
    e => {
      if (e.code === 'KeyY') {
        if (!altYHandled && e.altKey) {
          filter.toggle();
        }
        altYHandled = false;
      }
    },
    true
  );
})();
