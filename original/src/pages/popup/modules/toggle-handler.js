export class ToggleHandler {
  constructor(_storageManager, _uiManager, tab) {
    this.tab = tab;
    this.currentState = {};
  }

  setCurrentState(state) {
    this.currentState = state;
  }

  async handleEnableChange(e) {
    const newEnabled = e.target.checked;

    try {
      // 2. Save to storage (YouTube tabs will pick this up via onChanged)
      await chrome.storage.sync.set({ enabled: newEnabled });
      this.currentState.enabled = newEnabled;

      // 3. Update badge
      chrome.runtime
        .sendMessage({
          action: 'updateBadge',
          enabled: newEnabled,
        })
        .catch(err => {
          console.warn('[YuLaF] Badge message failed, updating directly:', err.message || err);
          this.updateBadgeDirectly(newEnabled);
        });
    } catch {
      this.revertEnableChange(e, !newEnabled);
    }
  }

  async updateBadgeDirectly(enabled) {
    try {
      const badgeText = enabled ? 'ON' : 'OFF';
      const badge = window.YT_FILTER_CONSTANTS?.BADGE || {};
      const badgeColor = enabled ? badge.COLOR_ON : badge.COLOR_OFF;

      await chrome.action.setBadgeText({ text: badgeText });
      await chrome.action.setBadgeBackgroundColor({ color: badgeColor });

      try {
        await chrome.action.setBadgeTextColor({ color: badge.TEXT_COLOR });
      } catch {
        // setBadgeTextColor not supported in older Chrome — non-critical
      }

      if (this.tab?.id) {
        await chrome.action.setBadgeText({ text: badgeText, tabId: this.tab.id });
        await chrome.action.setBadgeBackgroundColor({ color: badgeColor, tabId: this.tab.id });
      }
    } catch {
      // Badge update failed - non-critical, extension still works
    }
  }

  updateToggles(state) {
    const enableFilter = document.getElementById('enableFilter');

    if (enableFilter) enableFilter.checked = !!state.enabled;

    this.updateBadgeDirectly(!!state.enabled);
  }

  setupEventListeners() {
    document
      .getElementById('enableFilter')
      ?.addEventListener('change', e => this.handleEnableChange(e));
  }

  revertEnableChange(e, fallbackEnabled) {
    e.target.checked = fallbackEnabled;
    this.showToast('Settings could not be saved.');
  }

  showToast(message, duration = window.YT_FILTER_CONSTANTS?.TIMING?.TOAST_DURATION || 2500) {
    // Remove any existing toast
    document.querySelector('.yulaf-toast')?.remove();

    const toast = document.createElement('div');
    toast.className = 'yulaf-toast';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.textContent = message;
    document.body.appendChild(toast);

    // Fade in
    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });

    // Fade out and remove
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }
}
