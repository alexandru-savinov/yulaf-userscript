// src/js/welcome.js
import { StateManager } from './modules/state-manager.js';
import { ProgressManager } from './modules/progress-manager.js';
import { LanguageManager } from './modules/language-manager.js';

class WelcomeController {
  constructor() {
    this.stateManager = new StateManager();
    this.progressManager = new ProgressManager(this.stateManager);
    this.languageManager = new LanguageManager(this.stateManager);
    this.init();
  }

  async init() {
    await this.languageManager.loadLanguages();
    this.setupEventListeners();
    this.languageManager.populateLanguageSelections();
    this.progressManager.updateUI();
    await this.loadExtensionStats();
  }

  async loadExtensionStats() {
    try {
      await chrome.storage.local.remove(['extensionStats', 'statsLastUpdated']);
      const response = await chrome.runtime.sendMessage({ action: 'getExtensionStats' });

      if (response?.success && response?.stats) {
        this.updateStatsUI(response.stats);
      } else {
        this.hideStatsUI();
      }
    } catch (err) {
      console.warn('[YuLaF] Failed to load extension stats:', err.message || err);
      this.hideStatsUI();
    }
  }

  updateStatsUI(stats) {
    const ratingEl = document.getElementById('ratingValue');
    const userCountEl = document.getElementById('userCount');

    if (ratingEl) ratingEl.textContent = stats.rating;
    if (userCountEl) userCountEl.textContent = stats.userCount;
  }

  hideStatsUI() {
    const ratingBadge = document.getElementById('ratingBadge');
    const usersBadge = document.getElementById('usersBadge');

    if (ratingBadge) ratingBadge.classList.add('hidden');
    if (usersBadge) usersBadge.classList.add('hidden');
  }

  setupEventListeners() {
    // Step indicators (clickable)
    document.querySelectorAll('.step').forEach(step => {
      step.addEventListener('click', () => {
        const stepNum = parseInt(step.dataset.step, 10);
        if (stepNum <= this.stateManager.currentStep + 1) this.goToStep(stepNum);
      });
    });

    // Navigation arrows
    document.getElementById('navPrev')?.addEventListener('click', () => this.prevStep());
    document.getElementById('navNext')?.addEventListener('click', () => this.nextStep());
    this.updateNavArrows();

    // Quick action cards
    document.getElementById('shareWithFriend')?.addEventListener('click', () => this.handleShare());
    document
      .getElementById('advancedSettings')
      ?.addEventListener('click', () => this.openAdvancedSettings());

    // Footer links
    document.getElementById('supportLink')?.addEventListener('click', e => {
      e.preventDefault();
      this.handleSupport();
    });

    // Rating badge click
    document
      .getElementById('ratingBadge')
      ?.addEventListener('click', () => this.handleRateUsClick());
    document
      .getElementById('usersBadge')
      ?.addEventListener('click', () => this.handleRateUsClick());

    // Final actions
    document.getElementById('goToYouTube')?.addEventListener('click', () => this.goToYouTube());

    // Keyboard
    document.addEventListener('keydown', e => this.handleKeyboard(e));
  }

  handleKeyboard(e) {
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      if (this.stateManager.currentStep < this.stateManager.totalSteps) this.nextStep();
    }
    if (e.key === 'ArrowLeft' && this.stateManager.currentStep > 1) this.prevStep();
  }

  nextStep() {
    if (this.stateManager.nextStep()) {
      this.progressManager.updateUI();
      this.updateNavArrows();
      if (this.stateManager.currentStep === 4) this.stateManager.finalizeSetup();
    }
  }

  prevStep() {
    if (this.stateManager.prevStep()) {
      this.progressManager.updateUI();
      this.updateNavArrows();
    }
  }

  goToStep(stepNum) {
    if (this.stateManager.goToStep(stepNum)) {
      this.progressManager.updateUI();
      this.updateNavArrows();
    }
  }

  updateNavArrows() {
    const prevBtn = document.getElementById('navPrev');
    const nextBtn = document.getElementById('navNext');
    const currentStep = this.stateManager.currentStep;
    const totalSteps = this.stateManager.totalSteps;

    // Hide left arrow on first step
    if (prevBtn) {
      prevBtn.classList.toggle('hidden', currentStep <= 1);
    }

    // Hide right arrow on last step
    if (nextBtn) {
      nextBtn.classList.toggle('hidden', currentStep >= totalSteps);
    }
  }

  goToYouTube() {
    const url = window.YT_FILTER_CONSTANTS?.URLS?.YOUTUBE || 'https://www.youtube.com';
    if (chrome?.tabs) {
      chrome.tabs
        .create({ url })
        .then(() => window.close())
        .catch(err => console.warn('[YuLaF] Failed to open tab:', err.message || err));
    } else {
      window.open(url, '_blank');
    }
  }

  handleShare() {
    const shareUrl =
      window.YT_FILTER_CONSTANTS?.URLS?.CHROME_WEB_STORE ||
      'https://chromewebstore.google.com/detail/ejfoldoabjeidjdddhomeaojicaemdpm';
    const shareText =
      'Want to see only the content in the language you want to learn on YouTube? We have a solution:';
    const fullText = `${shareText} ${shareUrl}`;

    // Always copy to clipboard
    navigator.clipboard
      .writeText(fullText)
      .then(() => {
        // Update button to show copied state
        const shareCard = document.getElementById('shareWithFriend');
        if (shareCard) {
          const originalIcon = shareCard.querySelector('.action-icon');
          const originalTitle = shareCard.querySelector('.action-title');

          if (originalIcon) originalIcon.textContent = '✓';
          if (originalTitle) originalTitle.textContent = 'Link Copied!';

          setTimeout(() => {
            if (originalIcon) originalIcon.textContent = '➤';
            if (originalTitle) originalTitle.textContent = 'Share with Friends';
          }, window.YT_FILTER_CONSTANTS?.TIMING?.COPIED_FEEDBACK_DURATION || 2000);
        }
      })
      .catch(() => {
        prompt('Copy this link to share:', fullText);
      });
  }

  openAdvancedSettings() {
    const page = window.YT_FILTER_CONSTANTS?.PAGES?.ADVANCED || 'src/pages/advanced/index.html';
    if (chrome?.tabs) {
      chrome.tabs
        .create({ url: chrome.runtime.getURL(page) })
        .catch(err => console.warn('[YuLaF] Failed to open tab:', err.message || err));
    } else {
      window.open(chrome.runtime.getURL(page), '_blank');
    }
  }

  handleSupport() {
    const url =
      window.YT_FILTER_CONSTANTS?.URLS?.GITHUB_ISSUES ||
      'https://github.com/vakkaskarakurt/YuLaF-YouTube-Language-Filter/issues';
    window.open(url, '_blank');
  }

  handleRateUsClick() {
    const url =
      window.YT_FILTER_CONSTANTS?.URLS?.CHROME_WEB_STORE ||
      'https://chromewebstore.google.com/detail/yulaf-youtube-language-fi/ejfoldoabjeidjdddhomeaojicaemdpm';
    window.open(url, '_blank');
  }
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  window.welcomeController = new WelcomeController();

  // Benefit card animations via CSS classes
  const observer = new IntersectionObserver(
    entries =>
      entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('animate-in');
      }),
    { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
  );

  document.querySelectorAll('.benefit-card, .step-card, .use-case, .action-card').forEach(card => {
    card.classList.add('animate-ready');
    observer.observe(card);
  });

  // Typing effect
  const heroText = document.querySelector('.hero-text');
  if (heroText) {
    const text = heroText.textContent;
    heroText.textContent = '';
    let i = 0;
    const typeEffect = setInterval(() => {
      heroText.textContent += text.charAt(i++);
      if (i > text.length) clearInterval(typeEffect);
    }, window.YT_FILTER_CONSTANTS?.TIMING?.TYPING_EFFECT_INTERVAL || 30);
  }
});
