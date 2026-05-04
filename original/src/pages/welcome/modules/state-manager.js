export class StateManager {
  constructor() {
    this.currentStep = 1;
    this.totalSteps = 4;
    this.selectedLanguages = ['en'];
  }

  /** Next step */
  nextStep() {
    if (this.currentStep >= this.totalSteps) return false;
    this.currentStep++;
    return true;
  }

  /** Go to previous step */
  prevStep() {
    if (this.currentStep <= 1) return false;

    this.currentStep--;
    return true;
  }

  /** Go to a specific step */
  goToStep(stepNum) {
    if (stepNum < 1 || stepNum > this.totalSteps) return false;

    this.currentStep = stepNum;
    return true;
  }

  /** Toggle language selection */
  toggleLanguage(code) {
    const exists = this.selectedLanguages.includes(code);

    if (exists) {
      this.selectedLanguages = this.selectedLanguages.filter(lang => lang !== code);
    } else {
      this.selectedLanguages.push(code);
    }
  }

  /** Finalize setup and save settings */
  async finalizeSetup() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const defaults = window.YT_FILTER_CONSTANTS?.DEFAULTS || {};
        await chrome.storage.sync.set({
          enabled: defaults.enabled ?? true,
          strictMode: defaults.strictMode ?? false,
          hideVideos: defaults.hideVideos ?? true,
          hideChannels: defaults.hideChannels ?? true,
          selectedLanguages: this.selectedLanguages,
          welcomeShown: true,
        });
      }
    } catch (err) {
      console.warn('[YuLaF] Setup finalization failed:', err.message || err);
    }
  }
}
