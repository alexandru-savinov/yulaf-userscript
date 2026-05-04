export class LanguageHandler {
  constructor() {
    this.languages = {};
    this.currentState = {};
  }

  setLanguages(languages) {
    this.languages = languages;
  }

  setCurrentState(state) {
    this.currentState = state;
  }

  renderLanguageTags() {
    const container = document.getElementById('languageTags');
    if (!container) return;

    container.replaceChildren();

    // Get selected languages and render them as tags
    const selectedLangs = this.currentState.selectedLanguages || [];

    selectedLangs.forEach(code => {
      const lang = this.languages[code];
      if (lang) {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.setAttribute('role', 'listitem');
        tag.textContent = lang.name;
        container.appendChild(tag);
      }
    });

    // If no languages selected, show a placeholder
    if (selectedLangs.length === 0) {
      const tag = document.createElement('span');
      tag.className = 'tag tag-placeholder';
      tag.textContent = 'No languages selected';
      container.appendChild(tag);
    }
  }
}
