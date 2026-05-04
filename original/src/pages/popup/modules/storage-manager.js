// Language data is loaded from config.js (window.YT_FILTER_CONFIG.languages)
// Config is now loaded via <script> tag in popup HTML, eliminating duplicates

export class StorageManager {
  constructor() {
    const defaults = window.YT_FILTER_CONSTANTS?.DEFAULTS || {};
    this.defaultState = {
      enabled: defaults.enabled ?? true,
      strictMode: defaults.strictMode ?? false,
      hideVideos: defaults.hideVideos ?? true,
      hideChannels: defaults.hideChannels ?? true,
      selectedLanguages: defaults.selectedLanguages ?? ['en'],
      sortBy: defaults.sortBy ?? 'popularity',
    };

    // Use shared language config (loaded via script tag in HTML)
    this.defaultLanguages = this._getLanguagesFromConfig();
  }

  _getLanguagesFromConfig() {
    if (typeof window !== 'undefined' && window.YT_FILTER_CONFIG?.languages) {
      return { ...window.YT_FILTER_CONFIG.languages };
    }
    // Empty fallback - config.js should always be loaded via HTML script tag
    return {};
  }

  async loadCurrentState(tab) {
    try {
      const stored = await chrome.storage.sync.get(Object.keys(this.defaultState));

      // Validate selectedLanguages against known language codes
      const knownLanguages = Object.keys(this.defaultLanguages);
      const rawLangs = stored.selectedLanguages ?? ['en'];
      if (knownLanguages.length === 0) {
        console.warn('[YuLaF] Language config not loaded, skipping validation');
      }
      const validatedLangs =
        knownLanguages.length > 0 && Array.isArray(rawLangs)
          ? rawLangs.filter(code => knownLanguages.includes(code))
          : rawLangs;

      const currentState = {
        enabled: stored.enabled !== false,
        strictMode: stored.strictMode !== false,
        hideVideos: stored.hideVideos !== false,
        hideChannels: stored.hideChannels !== false,
        selectedLanguages: validatedLangs.length > 0 ? validatedLangs : ['en'],
        sortBy: stored.sortBy || 'popularity',
      };

      // Fetch current state from content script
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });
        if (response?.enabled !== undefined) {
          currentState.enabled = response.enabled;
          if (response.settings) Object.assign(currentState, response.settings);
        }
      } catch (err) {
        console.warn('[YuLaF] Content script not ready, using storage values:', err.message || err);
      }

      return currentState;
    } catch (err) {
      console.warn('[YuLaF] Failed to load state:', err.message || err);
      return this.defaultState;
    }
  }

  async saveState(updates, tab, forceReload = false) {
    try {
      await chrome.storage.sync.set(updates);

      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'updateState',
          state: updates,
          forceReload,
        });
      } catch (err) {
        if (forceReload && err.message?.includes('Could not establish connection')) {
          chrome.tabs.reload(tab.id);
        }
      }

      return true;
    } catch (err) {
      console.warn('[YuLaF] Failed to save state:', err.message || err);
      return false;
    }
  }

  async loadLanguages(tab) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getLanguages' });
      if (response?.languages) return response.languages;
    } catch (err) {
      console.warn(
        '[YuLaF] Content script not available, using config languages:',
        err.message || err
      );
    }
    return this.defaultLanguages;
  }
}
