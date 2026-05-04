/**
 * @file Content filtering service. Processes YouTube video/channel elements,
 * detects their language and hides non-matching content.
 * @global
 */
window.FilterService = {
  /** @type {boolean} Enable debug logging */
  debug: false,
  /** @type {WeakSet<HTMLElement>} Track elements currently being processed */
  processingElements: new WeakSet(),

  log(...args) {
    // eslint-disable-next-line no-console
    if (this.debug) console.log('[YuLaF]', ...args);
  },

  /**
   * Filter all visible YouTube content based on language settings.
   * @param {Object} settings - Current filter settings
   * @param {boolean} settings.hideVideos - Whether to filter videos
   * @param {boolean} settings.hideChannels - Whether to filter channels
   */
  async filterContent(settings) {
    if (!settings) return;

    this.log('filterContent started', {
      selectedLanguages: window.LanguageService.selectedLanguages,
      hideVideos: settings.hideVideos,
      hideChannels: settings.hideChannels,
    });

    try {
      const tasks = [];

      if (settings.hideVideos) {
        tasks.push(this.filterElementType('video'));
      }

      if (settings.hideChannels) {
        tasks.push(this.filterElementType('channel'));
      }

      await Promise.all(tasks);
      this.log('filterContent completed');
    } catch (err) {
      this.log('filterContent error:', err);
    }
  },

  async filterElementType(type) {
    const elements = window.DOMService.getAllElements(type);
    this.log(`Processing ${elements.length} ${type}(s)`);
    await Promise.all(elements.map(el => this.processElement(el, type)));
  },

  /**
   * Process a single element: hide it, detect language, show if matching.
   * @param {HTMLElement} element - DOM element to process
   * @param {'video'|'channel'} type - Element type
   */
  async processElement(element, type) {
    // Skip if already being processed (prevents duplicate async processing)
    if (this.processingElements.has(element)) {
      return;
    }

    const currentLang = [...window.LanguageService.selectedLanguages].sort().join(',');
    const lastCheckedLang = element.getAttribute(DATA_ATTR.LANG);

    // Skip if already checked for same language combination
    if (element.hasAttribute(DATA_ATTR.CHECKED) && lastCheckedLang === currentLang) {
      return;
    }

    // Mark as processing with version tracking.
    // The version counter prevents stale async results from overwriting newer processing passes:
    // if a new pass starts before the previous one finishes, the old pass detects the version
    // mismatch and bails out, ensuring only the latest result applies.
    this.processingElements.add(element);
    const processingVersion = parseInt(element.getAttribute(DATA_ATTR.VERSION) || '0') + 1;
    element.setAttribute(DATA_ATTR.VERSION, String(processingVersion));

    element.setAttribute(DATA_ATTR.CHECKED, 'true');
    element.setAttribute(DATA_ATTR.LANG, currentLang);

    // Hide first
    window.DOMService.hideElement(element, type);

    try {
      let text = window.DOMService.extractText(element, type).trim();

      // If no text found, wait briefly and try again (YouTube elements load dynamically)
      if (!text) {
        await new Promise(r =>
          setTimeout(r, window.YT_FILTER_CONSTANTS?.TIMING?.TEXT_EXTRACT_RETRY || 200)
        );
        // Check if element was removed from DOM during wait
        if (!element.isConnected) return;
        text = window.DOMService.extractText(element, type).trim();
      }

      // Verify this is still the current processing pass
      if (parseInt(element.getAttribute(DATA_ATTR.VERSION) || '0') !== processingVersion) {
        return;
      }

      if (text) {
        // Check logging before async detection to avoid duplicates
        const logKey = text.substring(
          0,
          window.YT_FILTER_CONSTANTS?.DETECTION?.LOG_KEY_MAX_LENGTH || 60
        );
        if (!this._loggedTexts) this._loggedTexts = new Set();
        const maxLoggedTexts = window.YT_FILTER_CONSTANTS?.LIMITS?.LOGGED_TEXTS_MAX || 500;
        if (this._loggedTexts.size > maxLoggedTexts) {
          // FIFO eviction: remove oldest 20%
          const evictCount = Math.ceil(
            this._loggedTexts.size * (window.YT_FILTER_CONSTANTS?.CACHE?.EVICTION_RATIO || 0.2)
          );
          let removed = 0;
          for (const key of this._loggedTexts) {
            if (removed >= evictCount) break;
            this._loggedTexts.delete(key);
            removed++;
          }
        }
        const shouldLog = !this._loggedTexts.has(logKey);
        if (shouldLog) this._loggedTexts.add(logKey);

        const isTarget = await window.LanguageService.detectLanguage(text);

        // Check if element was removed from DOM or superseded during async detection
        if (!element.isConnected) return;
        if (parseInt(element.getAttribute(DATA_ATTR.VERSION) || '0') !== processingVersion) {
          return;
        }

        // Final safety check: if extension is OFF, always show
        if (window.YT_FILTER_INSTANCE && !window.YT_FILTER_INSTANCE.enabled) {
          window.DOMService.showElement(element);
          return;
        }

        if (shouldLog) {
          this.log(isTarget ? '✓ SHOW:' : '✗ HIDE:', logKey, {
            targetLangs: window.LanguageService.selectedLanguages,
          });
        }

        // Show if it matches target languages, otherwise keep it hidden (already hidden by hideElement call above)
        if (isTarget) {
          window.DOMService.showElement(element);
        }
      } else {
        // Still no text after wait - default to show to avoid hiding everything
        this.log('⚠ NO TEXT - showing element');
        window.DOMService.showElement(element);
      }
    } finally {
      // Remove from processing set when done
      this.processingElements.delete(element);
    }
  },

  /**
   * Process a newly added DOM node (from MutationObserver).
   * @param {HTMLElement} node - The newly added node
   * @param {Object} settings - Current filter settings
   */
  /** @private Check if an element is or is inside an ad */
  _isAd(el) {
    const adSelector = 'ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer';
    return el.matches(adSelector) || el.closest(adSelector);
  },

  /** @private Process a node as a given type, with error handling */
  _tryProcess(el, type) {
    this.processElement(el, type).catch(err =>
      console.warn(`[YuLaF] processElement error (${type}):`, err.message || err)
    );
  },

  /** @private Handle one element type within processNewNode */
  _processNodeType(node, selectors, type) {
    // If the node itself matches
    if (selectors.some(sel => node.matches(sel))) {
      this._tryProcess(node, type);
    }

    // Search for matching elements inside the node
    if (node.querySelectorAll) {
      node.querySelectorAll(selectors.join(',')).forEach(el => {
        if (!this._isAd(el)) {
          this._tryProcess(el, type);
        }
      });
    }
  },

  processNewNode(node, settings) {
    if (!node.matches || !settings) return;
    if (this._isAd(node)) return;

    const { video: videoSelectors, channel: channelSelectors } = window.YT_FILTER_CONFIG.selectors;

    if (settings.hideVideos) {
      this._processNodeType(node, videoSelectors, 'video');
    }
    if (settings.hideChannels) {
      this._processNodeType(node, channelSelectors, 'channel');
    }
  },
};
