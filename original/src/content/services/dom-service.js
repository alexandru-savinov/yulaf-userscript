/**
 * @file DOM manipulation service for hiding/showing YouTube elements.
 * @global
 */
window.DOMService = {
  /**
   * Extract visible text from a YouTube element (video or channel).
   * @param {HTMLElement} element - The DOM element to extract text from
   * @param {'video'|'channel'} type - Element type
   * @returns {string} Combined text content
   */
  extractText(element, type) {
    let selectors = [];
    if (type === 'video') {
      // For videos, combine title and description for better context
      selectors = [
        ...window.YT_FILTER_CONFIG.selectors.title,
        ...window.YT_FILTER_CONFIG.selectors.description,
      ];
    } else if (type === 'channel') {
      selectors = window.YT_FILTER_CONFIG.selectors.channelName;
    }

    const foundTexts = new Set();

    for (const selector of selectors) {
      const el = element.querySelector(selector);
      if (!el) continue;

      // Prefer textContent over title attribute for better language detection
      // But title attribute can be a good fallback if textContent is empty
      const content = (el.textContent || el.getAttribute('title') || '').trim();

      // Filter out common junk text
      if (content && content.length >= 3 && !/^\d+[:.]\d+$/.test(content)) {
        foundTexts.add(content);
      }
    }

    return Array.from(foundTexts).join(' ');
  },

  /**
   * Hide a DOM element and mark it as hidden by the filter.
   * @param {HTMLElement} element - Element to hide
   * @param {'video'|'channel'} type - Element type
   */
  hideElement(element, type) {
    element.style.display = 'none';
    element.setAttribute(DATA_ATTR.HIDDEN, type);
  },

  /** @param {HTMLElement} element - Element to show */
  showElement(element) {
    element.style.display = '';
    element.style.visibility = '';
    element.style.opacity = '';
    element.removeAttribute(DATA_ATTR.HIDDEN);
  },

  /** Show all elements hidden by the language filter. */
  showAllHiddenContent() {
    // 1. Direct cleanup by hidden attribute
    document.querySelectorAll(`[${DATA_ATTR.HIDDEN}]`).forEach(el => this.showElement(el));

    // 2. Safety pass: check everything we've touched
    document.querySelectorAll(`[${DATA_ATTR.CHECKED}]`).forEach(el => {
      // If it's still hidden by us, show it
      if (el.style.display === 'none') {
        this.showElement(el);
      }
      el.removeAttribute(DATA_ATTR.CHECKED);
      el.removeAttribute(DATA_ATTR.LANG);
    });
  },

  /**
   * Get all YouTube elements of a given type, excluding ads.
   * @param {'video'|'channel'} type - Element type to query
   * @returns {HTMLElement[]} Array of matching elements
   */
  getAllElements(type) {
    const selectors = window.YT_FILTER_CONFIG.selectors[type];
    const elements = document.querySelectorAll(selectors.join(','));

    return Array.from(elements).filter(
      el =>
        !el.matches('ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer') &&
        !el.closest('ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer')
    );
  },
};
