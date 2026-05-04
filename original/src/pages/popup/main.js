import { StorageManager } from './modules/storage-manager.js';
import { UIManager } from './modules/ui-manager.js';
import { ToggleHandler } from './modules/toggle-handler.js';
import { LanguageHandler } from './modules/language-handler.js';

// Platform detection helper
function isMac() {
  if (navigator.userAgentData?.platform) {
    return navigator.userAgentData.platform === 'macOS';
  }
  return navigator.platform?.toUpperCase().indexOf('MAC') >= 0;
}

// Setup shortcut hint and tooltip with i18n
function setupShortcutHints() {
  const mac = isMac();
  const hintEl = document.getElementById('shortcutHint');
  const tooltipEl = document.getElementById('shortcutTooltip');

  if (hintEl) {
    hintEl.textContent =
      chrome.i18n.getMessage(mac ? 'shortcutHintMac' : 'shortcutHintOther') ||
      (mac ? '⌃Y' : 'Alt+Y');
  }
  if (tooltipEl) {
    tooltipEl.textContent =
      chrome.i18n.getMessage(mac ? 'shortcutTooltipMac' : 'shortcutTooltipOther') ||
      (mac ? 'Toggle filter (Ctrl+Y)' : 'Toggle filter (Alt+Y)');
  }
}

class PopupController {
  constructor() {
    this.tab = null;
    this.storageManager = new StorageManager();
    this.uiManager = new UIManager();
    this.toggleHandler = null;
    this.languageHandler = null;
    this.listenersAdded = false;
    this.init();
  }

  async init() {
    try {
      // Setup shortcut hints immediately
      setupShortcutHints();

      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.tab = tab;

      // Not YouTube → show special screen
      if (!tab?.url?.includes('youtube.com')) {
        this.uiManager.showNonYouTubePage();
        this.uiManager.setupNonYouTubeEventListeners();
        return;
      }

      // Init handlers
      this.toggleHandler = new ToggleHandler(this.storageManager, this.uiManager, tab);
      this.languageHandler = new LanguageHandler();

      // Load current state + languages
      const [state, languages] = await Promise.all([
        this.storageManager.loadCurrentState(tab),
        this.storageManager.loadLanguages(tab),
      ]);

      // Apply state
      this.toggleHandler.setCurrentState(state);
      this.languageHandler.setCurrentState(state);
      this.languageHandler.setLanguages(languages);

      // Setup
      this.setupEventListeners();
      this.updateUI(state);

      // Fade-in UI
      const loadDelay = window.YT_FILTER_CONSTANTS?.TIMING?.POPUP_LOAD_DELAY || 100;
      setTimeout(() => this.uiManager.showLoaded(), loadDelay);
    } catch (err) {
      console.warn('[YuLaF] Popup init failed:', err.message || err);
      const loadDelay = window.YT_FILTER_CONSTANTS?.TIMING?.POPUP_LOAD_DELAY || 100;
      setTimeout(() => this.uiManager.showLoaded(), loadDelay);
    }
  }

  updateUI(state) {
    this.toggleHandler.updateToggles(state);
    this.languageHandler.renderLanguageTags();
  }

  setupEventListeners() {
    if (this.listenersAdded) return;

    // Components
    this.toggleHandler.setupEventListeners();

    this.setupFooterButtons();

    // Keyboard shortcut (Alt+Y) inside popup — toggle filter on/off
    document.addEventListener('keydown', e => {
      if (e.code === 'KeyY' && e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const checkbox = document.getElementById('enableFilter');
        if (checkbox && this.toggleHandler) {
          checkbox.checked = !checkbox.checked;
          this.toggleHandler.handleEnableChange({ target: checkbox });
        }
      }
    });

    // Listen for storage updates
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync') this.handleStorageChanges(changes);
    });

    this.listenersAdded = true;
  }

  setupFooterButtons() {
    const openTab = url =>
      chrome.tabs
        .create({ url })
        .then(() => window.close())
        .catch(err => console.warn('[YuLaF] Failed to open tab:', err.message || err));

    // Header Settings Button (top-right)
    document
      .getElementById('headerSettingsBtn')
      ?.addEventListener('click', () =>
        openTab(
          chrome.runtime.getURL(
            window.YT_FILTER_CONSTANTS?.PAGES?.ADVANCED || 'src/pages/advanced/index.html'
          )
        )
      );

    // Footer Rate Button
    document
      .getElementById('rateBtn')
      ?.addEventListener('click', () =>
        openTab(
          window.YT_FILTER_CONSTANTS?.URLS?.CHROME_WEB_STORE ||
            'https://chromewebstore.google.com/detail/yulaf-youtube-language-fi/ejfoldoabjeidjdddhomeaojicaemdpm'
        )
      );

    // Footer Share Button - Show Modal
    document.getElementById('shareBtn')?.addEventListener('click', () => {
      const modal = document.getElementById('shareModal');
      if (modal) {
        modal.classList.add('show');
        // Focus trap: focus the first focusable element
        const firstFocusable = modal.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      }
    });

    // Close Share Modal
    document.getElementById('closeShareModal')?.addEventListener('click', () => {
      document.getElementById('shareModal')?.classList.remove('show');
      // Return focus to share button
      document.getElementById('shareBtn')?.focus();
    });

    // Close modal when clicking outside
    document.getElementById('shareModal')?.addEventListener('click', e => {
      if (e.target.id === 'shareModal') {
        document.getElementById('shareModal')?.classList.remove('show');
        document.getElementById('shareBtn')?.focus();
      }
    });

    // Focus trap for modal: Tab key cycles within modal
    document.getElementById('shareModal')?.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.getElementById('shareModal')?.classList.remove('show');
        document.getElementById('shareBtn')?.focus();
        return;
      }
      if (e.key !== 'Tab') return;

      const modal = e.currentTarget;
      const focusable = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    // Copy Share Text
    document.getElementById('copyShareText')?.addEventListener('click', async () => {
      const shareText = document.getElementById('shareText')?.textContent || '';
      const copyBtn = document.getElementById('copyShareText');

      try {
        await navigator.clipboard.writeText(shareText);

        // Change button text and icon using DOM API
        if (copyBtn) {
          const originalChildren = Array.from(copyBtn.childNodes).map(n => n.cloneNode(true));
          copyBtn.classList.add('copied');

          // Clear and build "Copied!" state
          while (copyBtn.firstChild) copyBtn.removeChild(copyBtn.firstChild);
          const svgNS = 'http://www.w3.org/2000/svg';
          const svg = document.createElementNS(svgNS, 'svg');
          svg.setAttribute('viewBox', '0 0 24 24');
          svg.setAttribute('fill', 'none');
          svg.setAttribute('stroke', 'currentColor');
          svg.setAttribute('stroke-width', '2');
          const polyline = document.createElementNS(svgNS, 'polyline');
          polyline.setAttribute('points', '20 6 9 17 4 12');
          svg.appendChild(polyline);
          const span = document.createElement('span');
          span.textContent = 'Copied!';
          copyBtn.append(svg, span);

          setTimeout(() => {
            copyBtn.classList.remove('copied');
            while (copyBtn.firstChild) copyBtn.removeChild(copyBtn.firstChild);
            originalChildren.forEach(child => copyBtn.appendChild(child));
          }, 2000);
        }
      } catch (err) {
        console.warn('[YuLaF] Clipboard copy failed:', err.message || err);
      }
    });

    // Platform Share Buttons
    document.querySelectorAll('.platform-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const platform = btn.getAttribute('data-platform');
        const storeUrl =
          window.YT_FILTER_CONSTANTS?.URLS?.CHROME_WEB_STORE ||
          'https://chromewebstore.google.com/detail/yulaf-youtube-language-fi/ejfoldoabjeidjdddhomeaojicaemdpm';
        const shareUrl = encodeURIComponent(storeUrl);

        // Copy text to clipboard first
        try {
          await navigator.clipboard.writeText(
            document.getElementById('shareText')?.textContent || ''
          );
        } catch {
          // Copy failed - silent
        }

        // Platform-specific share URLs
        const shareUrls = window.YT_FILTER_CONSTANTS?.SHARE_URLS;
        const urls = shareUrls
          ? {
              x: shareUrls.x(shareUrl),
              reddit: shareUrls.reddit(shareUrl),
              whatsapp: shareUrls.whatsapp(shareUrl),
              telegram: shareUrls.telegram(shareUrl),
            }
          : {
              x: `https://twitter.com/intent/tweet?url=${shareUrl}`,
              reddit: `https://reddit.com/submit?url=${shareUrl}`,
              whatsapp: `https://wa.me/?text=${shareUrl}`,
              telegram: `https://t.me/share/url?url=${shareUrl}`,
            };

        if (urls[platform]) {
          openTab(urls[platform]);
        }
      });
    });

    // Tags Section Click - Navigate to Advanced Settings
    document.querySelector('.tags-section')?.addEventListener('click', () => {
      openTab(
        chrome.runtime.getURL(
          window.YT_FILTER_CONSTANTS?.PAGES?.ADVANCED || 'src/pages/advanced/index.html'
        )
      );
    });
  }

  handleStorageChanges(changes) {
    const current = this.toggleHandler.currentState;
    const newState = { ...current };
    let changed = false;

    for (const key in changes) {
      if (
        key in current &&
        JSON.stringify(changes[key].newValue) !== JSON.stringify(current[key])
      ) {
        newState[key] = changes[key].newValue;
        changed = true;
      }
    }

    if (changed) {
      this.toggleHandler.setCurrentState(newState);
      this.languageHandler.setCurrentState(newState);
      this.updateUI(newState);
    }
  }
}

// Boot
document.addEventListener('DOMContentLoaded', () => new PopupController());
