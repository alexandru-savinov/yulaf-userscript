// Advanced Settings Page Controller

class AdvancedSettings {
  constructor() {
    this.languages = {};
    this.selectedLanguages = [];
    this.strictMode = false;
    this.enabled = true;
    this.sortBy = window.YT_FILTER_CONSTANTS?.DEFAULTS?.sortBy || 'popularity';
    this.init();
  }

  async init() {
    try {
      // Load all languages from config
      if (window.YT_FILTER_CONFIG && window.YT_FILTER_CONFIG.languages) {
        this.languages = { ...window.YT_FILTER_CONFIG.languages };
      }

      // Load current state from storage
      const result = await chrome.storage.sync.get(['selectedLanguages', 'strictMode', 'enabled']);
      this.selectedLanguages = result.selectedLanguages || [];
      this.strictMode = result.strictMode !== undefined ? result.strictMode : false;
      this.enabled = result.enabled !== false;

      // Update UI
      this.updateStrictModeToggle();
      this.renderLanguages();
      this.setupEventListeners();

      // Listen for external changes (e.g. from popup)
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && changes.enabled) {
          this.enabled = changes.enabled.newValue !== false;
        }
      });
    } catch (err) {
      console.warn('[YuLaF] Advanced settings init failed:', err.message || err);
    }
  }

  updateStrictModeToggle() {
    const toggle = document.getElementById('strictModeToggle');
    if (toggle) {
      toggle.checked = this.strictMode;
    }
  }

  renderLanguages(searchTerm = '') {
    const container = document.getElementById('languageOptions');
    if (!container) return;

    container.replaceChildren();

    const term = searchTerm.toLowerCase();
    const filtered = Object.entries(this.languages).filter(
      ([code, lang]) =>
        !term ||
        lang.name.toLowerCase().includes(term) ||
        lang.nativeName.toLowerCase().includes(term) ||
        code.toLowerCase().includes(term)
    );

    // Top languages list for popularity sorting (from constants)
    const topLanguages = window.YT_FILTER_CONSTANTS?.TOP_LANGUAGES_EXTENDED || [];

    // Sort languages
    filtered.sort(([aCode, aLang], [bCode, bLang]) => {
      // English always first
      if (aCode === 'en') return -1;
      if (bCode === 'en') return 1;

      // Then by selected status
      const aSel = this.selectedLanguages.includes(aCode);
      const bSel = this.selectedLanguages.includes(bCode);
      if (aSel !== bSel) return aSel ? -1 : 1;

      // Then by sort preference
      if (this.sortBy === 'popularity') {
        const aIdx = topLanguages.indexOf(aCode);
        const bIdx = topLanguages.indexOf(bCode);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return aLang.name.localeCompare(bLang.name);
      } else {
        return aLang.name.localeCompare(bLang.name);
      }
    });

    const frag = document.createDocumentFragment();
    filtered.forEach(([code, lang]) => {
      frag.appendChild(this.createLanguageElement(code, lang));
    });
    container.appendChild(frag);

    this.updateSelectedCount();
    this.updateLanguageTitle();
  }

  updateLanguageTitle() {
    const titleEl = document.getElementById('languageTitle');
    if (titleEl) {
      const count = Object.keys(this.languages).length;
      titleEl.textContent = `All Languages (${count})`;
    }
  }

  createLanguageElement(code, lang) {
    const isChecked = this.selectedLanguages.includes(code);

    const option = document.createElement('label');
    option.className = isChecked ? 'language-option selected' : 'language-option';

    // Use centralized country map from constants
    const countryMap = window.YT_FILTER_CONSTANTS?.COUNTRY_MAP || {};
    const flagBase = window.YT_FILTER_CONSTANTS?.URLS?.FLAG_CDN_BASE || 'https://flagcdn.com/24x18';

    const countryCode = countryMap[code] || code;
    const flagUrl = `${flagBase}/${countryCode}.png`;

    // Build DOM elements safely (no innerHTML with user data)
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'language';
    checkbox.value = code;
    checkbox.checked = isChecked;

    const labelSpan = document.createElement('span');
    labelSpan.className = 'language-label';

    const flagImg = document.createElement('img');
    flagImg.src = flagUrl;
    flagImg.alt = lang.name;
    flagImg.className = 'flag-img';
    flagImg.addEventListener('error', () => {
      flagImg.style.display = 'none';
    });

    const nameSpan = document.createElement('span');
    nameSpan.className = 'language-name';
    nameSpan.textContent = lang.name;

    labelSpan.appendChild(flagImg);
    labelSpan.appendChild(nameSpan);
    option.appendChild(checkbox);
    option.appendChild(labelSpan);

    checkbox.addEventListener('change', e => this.handleLanguageChange(e));
    return option;
  }

  async handleLanguageChange(e) {
    const code = e.target.value;
    const parentLabel = e.target.closest('.language-option');

    if (e.target.checked) {
      if (!this.selectedLanguages.includes(code)) {
        this.selectedLanguages.push(code);
      }
      if (parentLabel) {
        parentLabel.classList.add('selected');
      }
    } else {
      this.selectedLanguages = this.selectedLanguages.filter(lang => lang !== code);
      if (parentLabel) {
        parentLabel.classList.remove('selected');
      }
    }

    this.updateSelectedCount();

    // Save to storage
    try {
      await chrome.storage.sync.set({ selectedLanguages: this.selectedLanguages });
    } catch (err) {
      console.warn('[YuLaF] Failed to save language selection:', err.message || err);
    }
  }

  async handleStrictModeChange(e) {
    this.strictMode = e.target.checked;

    try {
      await chrome.storage.sync.set({ strictMode: this.strictMode });
    } catch (err) {
      console.warn('[YuLaF] Failed to save strict mode:', err.message || err);
    }
  }

  handleSearch(e) {
    this.renderLanguages(e.target.value);
  }

  handleSortChange(e) {
    this.sortBy = e.target.value;
    const searchInput = document.getElementById('languageSearch');
    this.renderLanguages(searchInput?.value || '');
  }

  handleBackButton() {
    window.close();
  }

  updateSelectedCount() {
    const countEl = document.getElementById('selectedCount');
    if (countEl) {
      countEl.textContent = this.selectedLanguages.length;
    }
  }

  setupEventListeners() {
    // Strict mode toggle
    const strictToggle = document.getElementById('strictModeToggle');
    if (strictToggle) {
      strictToggle.addEventListener('change', e => this.handleStrictModeChange(e));
    }

    // Search input
    const searchInput = document.getElementById('languageSearch');
    if (searchInput) {
      searchInput.addEventListener('input', e => this.handleSearch(e));
    }

    // Sort by dropdown
    const sortSelect = document.getElementById('sortBy');
    if (sortSelect) {
      sortSelect.addEventListener('change', e => this.handleSortChange(e));
    }

    // Back button
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.handleBackButton());
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new AdvancedSettings());
} else {
  new AdvancedSettings();
}
