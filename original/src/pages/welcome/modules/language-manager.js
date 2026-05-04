export class LanguageManager {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.languages = {};
  }

  /** Load languages from shared config */
  async loadLanguages() {
    this.languages = window.YT_FILTER_CONFIG?.languages || {};
  }

  /** Populate UI */
  populateLanguageSelections() {
    this.populatePopularLanguages();
    this.populateAllLanguages();
    this.populateAdvancedLanguages();
    this.updateSelectionSummary();
    this.setupSearchAndSort();
  }

  populatePopularLanguages() {
    const container = document.getElementById('popularLanguages');
    if (!container) return;

    const popularCodes = window.YT_FILTER_CONSTANTS?.TOP_LANGUAGES?.slice(0, 12) || [
      'en',
      'zh',
      'es',
      'hi',
      'ar',
      'pt',
      'ru',
      'ja',
      'fr',
      'de',
      'ko',
      'it',
    ];
    container.replaceChildren();
    const frag = document.createDocumentFragment();
    popularCodes.forEach(code => {
      if (this.languages[code]) {
        frag.appendChild(this.createLanguageElement(code, this.languages[code]));
      }
    });
    container.appendChild(frag);
  }

  populateAllLanguages() {
    const container = document.getElementById('allLanguages');
    if (container) {
      this.renderLanguageList(container, Object.entries(this.languages));
    }
  }

  /** Advanced grid (welcome page step 3) */
  populateAdvancedLanguages(searchTerm = '', sortBy = 'popularity') {
    const container = document.getElementById('languageGridAdvanced');
    if (!container) return;

    container.replaceChildren();

    const countryMap = window.YT_FILTER_CONSTANTS?.COUNTRY_MAP || {};
    const topLanguages = window.YT_FILTER_CONSTANTS?.TOP_LANGUAGES_EXTENDED || [];

    // Filter
    const term = searchTerm.toLowerCase();
    const filtered = Object.entries(this.languages).filter(
      ([code, lang]) =>
        !term ||
        lang.name.toLowerCase().includes(term) ||
        lang.nativeName.toLowerCase().includes(term) ||
        code.toLowerCase().includes(term)
    );

    // Sort
    filtered.sort(([aCode, aLang], [bCode, bLang]) => {
      // English first
      if (aCode === 'en') return -1;
      if (bCode === 'en') return 1;

      // Selected languages next
      const aSel = this.stateManager.selectedLanguages.includes(aCode);
      const bSel = this.stateManager.selectedLanguages.includes(bCode);
      if (aSel !== bSel) return aSel ? -1 : 1;

      // Then by sort preference
      if (sortBy === 'popularity') {
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

    // Render
    const frag = document.createDocumentFragment();
    filtered.forEach(([code, lang]) => {
      const isSelected = this.stateManager.selectedLanguages.includes(code);
      const countryCode = countryMap[code] || code;
      const flagCdnBase =
        window.YT_FILTER_CONSTANTS?.URLS?.FLAG_CDN_BASE || 'https://flagcdn.com/24x18';
      const flagUrl = `${flagCdnBase}/${countryCode}.png`;

      const option = document.createElement('label');
      option.className = 'language-option-advanced';
      // Build DOM elements safely
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'language';
      checkbox.value = code;
      checkbox.checked = isSelected;

      const labelSpan = document.createElement('span');
      labelSpan.className = 'language-label-advanced';

      const flagImg = document.createElement('img');
      flagImg.src = flagUrl;
      flagImg.alt = lang.name;
      flagImg.className = 'flag-img';
      flagImg.addEventListener('error', () => {
        flagImg.classList.add('hidden');
      });

      const nameSpan = document.createElement('span');
      nameSpan.className = 'language-name-advanced';
      nameSpan.textContent = lang.name;

      labelSpan.appendChild(flagImg);
      labelSpan.appendChild(nameSpan);
      option.appendChild(checkbox);
      option.appendChild(labelSpan);
      checkbox.addEventListener('change', () => {
        this.toggleLanguage(code);
        this.populateAdvancedLanguages(searchTerm, sortBy);
      });

      frag.appendChild(option);
    });
    container.appendChild(frag);
  }

  /** Setup search and sort for welcome page */
  setupSearchAndSort() {
    const searchInput = document.getElementById('languageSearch');
    const sortSelect = document.getElementById('sortBy');

    if (searchInput) {
      searchInput.addEventListener('input', e => {
        const sortBy = sortSelect?.value || 'popularity';
        this.populateAdvancedLanguages(e.target.value, sortBy);
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', e => {
        const searchTerm = searchInput?.value || '';
        this.populateAdvancedLanguages(searchTerm, e.target.value);
      });
    }
  }

  /** Create language card element */
  createLanguageElement(code, lang) {
    const element = document.createElement('div');
    element.className = `language-item ${this.stateManager.selectedLanguages.includes(code) ? 'selected' : ''}`;
    element.dataset.code = code;

    const flagSpan = document.createElement('span');
    flagSpan.className = 'flag';
    flagSpan.textContent = lang.icon;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'name';
    nameSpan.textContent = lang.name;

    element.appendChild(flagSpan);
    element.appendChild(nameSpan);
    element.addEventListener('click', () => this.toggleLanguage(code));
    return element;
  }

  /** Render language list */
  renderLanguageList(container, entries, searchTerm = '') {
    container.replaceChildren();

    const term = searchTerm.toLowerCase();
    const filtered = entries.filter(
      ([code, lang]) =>
        !term ||
        lang.name.toLowerCase().includes(term) ||
        lang.nativeName.toLowerCase().includes(term) ||
        code.toLowerCase().includes(term)
    );

    filtered.sort(([cA, lA], [cB, lB]) => {
      const selA = this.stateManager.selectedLanguages.includes(cA);
      const selB = this.stateManager.selectedLanguages.includes(cB);
      if (selA && !selB) return -1;
      if (!selA && selB) return 1;
      return lA.name.localeCompare(lB.name);
    });

    const frag = document.createDocumentFragment();
    filtered.forEach(([code, lang]) => frag.appendChild(this.createLanguageElement(code, lang)));
    container.appendChild(frag);
  }

  /** Toggle language selection */
  toggleLanguage(code) {
    this.stateManager.toggleLanguage(code);
    this.updateLanguageSelections();
    this.updateSelectionSummary();
    this.saveLanguageSelection();

    // Also update the advanced grid on the welcome page
    const searchInput = document.getElementById('languageSearch');
    const sortSelect = document.getElementById('sortBy');
    if (searchInput || sortSelect) {
      const searchTerm = searchInput?.value || '';
      const sortBy = sortSelect?.value || 'popularity';
      this.populateAdvancedLanguages(searchTerm, sortBy);
    }
  }

  /** Preset language selection */
  selectPresetLanguages(langCodes) {
    this.stateManager.selectedLanguages = [...langCodes];
    this.updateLanguageSelections();
    this.updateSelectionSummary();
    this.saveLanguageSelection();
  }

  updateLanguageSelections() {
    document.querySelectorAll('.language-item').forEach(item => {
      item.classList.toggle(
        'selected',
        this.stateManager.selectedLanguages.includes(item.dataset.code)
      );
    });
  }

  /** Summary (count + tags) */
  updateSelectionSummary() {
    const countEl = document.getElementById('selectedCount');
    const tagsEl = document.getElementById('selectedLanguages');

    if (countEl) countEl.textContent = this.stateManager.selectedLanguages.length;

    if (tagsEl) {
      tagsEl.replaceChildren();

      const countryMap = window.YT_FILTER_CONSTANTS?.COUNTRY_MAP || {};

      this.stateManager.selectedLanguages.forEach(code => {
        if (!this.languages[code]) return;

        const countryCode = countryMap[code] || code;
        const flagCdnBase =
          window.YT_FILTER_CONSTANTS?.URLS?.FLAG_CDN_BASE || 'https://flagcdn.com/24x18';
        const flagUrl = `${flagCdnBase}/${countryCode}.png`;

        const tag = document.createElement('span');
        tag.className = 'selected-tag';

        const flagImg = document.createElement('img');
        flagImg.src = flagUrl;
        flagImg.alt = '';
        flagImg.className = 'selected-tag-flag';
        flagImg.addEventListener('error', () => {
          flagImg.classList.add('hidden');
        });

        const nameEl = document.createElement('span');
        nameEl.textContent = this.languages[code].name;

        const removeEl = document.createElement('span');
        removeEl.className = 'remove';
        removeEl.dataset.code = code;
        removeEl.textContent = '\u00d7';
        removeEl.addEventListener('click', () => this.toggleLanguage(code));

        tag.appendChild(flagImg);
        tag.appendChild(nameEl);
        tag.appendChild(removeEl);
        tagsEl.appendChild(tag);
      });
    }
  }

  /** Search filter */
  filterLanguages(searchTerm) {
    const container = document.getElementById('allLanguages');
    if (container) {
      this.renderLanguageList(container, Object.entries(this.languages), searchTerm);
    }
  }

  /** Save settings */
  async saveLanguageSelection() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.sync.set({ selectedLanguages: this.stateManager.selectedLanguages });
      }
    } catch (err) {
      console.warn('[YuLaF] Failed to save language selection:', err.message || err);
    }
  }
}
