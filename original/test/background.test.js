/**
 * Background Service Worker Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Re-implement the background functions for testing
// (The actual background script runs as a service worker, so we test the logic)

async function setBadgeTextAndColor({ text, bgColor, tabId } = {}) {
  try {
    const textOpts = { text: String(text) };
    const bgOpts = { color: String(bgColor) };
    if (typeof tabId !== 'undefined') {
      textOpts.tabId = tabId;
      bgOpts.tabId = tabId;
    }

    await chrome.action.setBadgeText(textOpts);
    await chrome.action.setBadgeBackgroundColor(bgOpts);

    try {
      const colorOpts = { color: '#FFFFFF' };
      if (typeof tabId !== 'undefined') colorOpts.tabId = tabId;
      await chrome.action.setBadgeTextColor(colorOpts);
    } catch (e) {
      const forcedDark = '#000000';
      if ((bgColor || '').toLowerCase() !== forcedDark) {
        const forcedBgOpts = { color: forcedDark };
        if (typeof tabId !== 'undefined') forcedBgOpts.tabId = tabId;
        try {
          await chrome.action.setBadgeBackgroundColor(forcedBgOpts);
        } catch (err) {
          // ignore
        }
      }
    }
  } catch {
    // Badge update failed silently
  }
}

async function updateBadge(enabled) {
  try {
    const badgeText = enabled ? 'ON' : 'OFF';
    const badgeColor = enabled ? '#10B981' : '#6B7280';

    await setBadgeTextAndColor({ text: badgeText, bgColor: badgeColor });

    const tabs = await chrome.tabs.query({ url: "*://*.youtube.com/*" });
    for (const tab of tabs) {
      if (tab.id) {
        try {
          await setBadgeTextAndColor({ text: badgeText, bgColor: badgeColor, tabId: tab.id });
        } catch {
          // Tab badge update failed
        }
      }
    }
  } catch {
    // Badge update failed
  }
}

async function initializeBadge() {
  try {
    const result = await chrome.storage.sync.get(['enabled']);
    const enabled = result.enabled !== false;
    await updateBadge(enabled);
  } catch {
    await updateBadge(true);
  }
}

async function fetchExtensionStats() {
  const EXTENSION_ID = 'ejfoldoabjeidjdddhomeaojicaemdpm';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const [usersRes, ratingRes] = await Promise.all([
      fetch(`https://img.shields.io/chrome-web-store/users/${EXTENSION_ID}.json`, { signal: controller.signal }),
      fetch(`https://img.shields.io/chrome-web-store/rating/${EXTENSION_ID}.json`, { signal: controller.signal })
    ]);

    clearTimeout(timeout);

    const usersData = await usersRes.json();
    const ratingData = await ratingRes.json();

    let userCount = null;
    if (usersData?.value) {
      const count = parseInt(usersData.value.replace(/[,.\s]/g, ''));
      if (count > 0) {
        userCount = count.toLocaleString('en-US');
      }
    }

    let rating = null;
    if (ratingData?.value) {
      const ratingMatch = ratingData.value.match(/([\d.]+)/);
      if (ratingMatch) {
        rating = parseFloat(ratingMatch[1]).toFixed(1);
      }
    }

    if (!userCount || !rating) {
      return null;
    }

    return { rating, userCount };
  } catch {
    return null;
  }
}

async function toggleFilterForTab(tab) {
  try {
    const result = await chrome.storage.sync.get(['enabled']);
    const newEnabled = result.enabled === false ? true : false;

    await chrome.storage.sync.set({ enabled: newEnabled });
    await updateBadge(newEnabled);
  } catch {
    // Toggle failed
  }
}

describe('Background Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('setBadgeTextAndColor', () => {
    it('should set badge text and background color', async () => {
      await setBadgeTextAndColor({ text: 'ON', bgColor: '#10B981' });

      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: 'ON' });
      expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#10B981' });
    });

    it('should set badge text color to white', async () => {
      await setBadgeTextAndColor({ text: 'ON', bgColor: '#10B981' });

      expect(chrome.action.setBadgeTextColor).toHaveBeenCalledWith({ color: '#FFFFFF' });
    });

    it('should include tabId when provided', async () => {
      await setBadgeTextAndColor({ text: 'OFF', bgColor: '#6B7280', tabId: 123 });

      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: 'OFF', tabId: 123 });
      expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#6B7280', tabId: 123 });
    });

    it('should handle setBadgeTextColor failure gracefully', async () => {
      chrome.action.setBadgeTextColor.mockRejectedValueOnce(new Error('Not supported'));

      await setBadgeTextAndColor({ text: 'ON', bgColor: '#10B981' });

      // Should fall back to forcing dark background
      expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledTimes(2);
    });

    it('should not force dark if already black', async () => {
      chrome.action.setBadgeTextColor.mockRejectedValueOnce(new Error('Not supported'));

      await setBadgeTextAndColor({ text: 'ON', bgColor: '#000000' });

      // Should only be called once (not forced)
      expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledTimes(1);
    });

    it('should handle complete failure silently', async () => {
      chrome.action.setBadgeText.mockRejectedValueOnce(new Error('Failed'));

      // Should not throw
      await expect(setBadgeTextAndColor({ text: 'ON', bgColor: '#10B981' })).resolves.not.toThrow();
    });
  });

  describe('updateBadge', () => {
    it('should set badge to ON when enabled', async () => {
      chrome.tabs.query.mockResolvedValueOnce([]);

      await updateBadge(true);

      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: 'ON' });
      expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#10B981' });
    });

    it('should set badge to OFF when disabled', async () => {
      chrome.tabs.query.mockResolvedValueOnce([]);

      await updateBadge(false);

      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: 'OFF' });
      expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#6B7280' });
    });

    it('should update badge for all YouTube tabs', async () => {
      chrome.tabs.query.mockResolvedValueOnce([
        { id: 1, url: 'https://www.youtube.com/' },
        { id: 2, url: 'https://www.youtube.com/watch?v=123' }
      ]);

      await updateBadge(true);

      // Global + 2 tabs = 3 calls each
      expect(chrome.action.setBadgeText).toHaveBeenCalledTimes(3);
    });

    it('should skip tabs without id', async () => {
      chrome.tabs.query.mockResolvedValueOnce([
        { url: 'https://www.youtube.com/' }, // No id
        { id: 1, url: 'https://www.youtube.com/' }
      ]);

      await updateBadge(true);

      // Global + 1 tab (the one without id is skipped)
      expect(chrome.action.setBadgeText).toHaveBeenCalledTimes(2);
    });

    it('should handle tab update failure gracefully', async () => {
      chrome.tabs.query.mockResolvedValueOnce([{ id: 1, url: 'https://www.youtube.com/' }]);
      chrome.action.setBadgeText
        .mockResolvedValueOnce() // Global succeeds
        .mockRejectedValueOnce(new Error('Tab closed')); // Tab fails

      await expect(updateBadge(true)).resolves.not.toThrow();
    });
  });

  describe('initializeBadge', () => {
    it('should get enabled state from storage', async () => {
      chrome.storage.sync.get.mockResolvedValueOnce({ enabled: true });
      chrome.tabs.query.mockResolvedValueOnce([]);

      await initializeBadge();

      expect(chrome.storage.sync.get).toHaveBeenCalledWith(['enabled']);
    });

    it('should default to enabled when storage is empty', async () => {
      chrome.storage.sync.get.mockResolvedValueOnce({});
      chrome.tabs.query.mockResolvedValueOnce([]);

      await initializeBadge();

      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: 'ON' });
    });

    it('should use disabled state from storage', async () => {
      chrome.storage.sync.get.mockResolvedValueOnce({ enabled: false });
      chrome.tabs.query.mockResolvedValueOnce([]);

      await initializeBadge();

      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: 'OFF' });
    });

    it('should default to enabled on storage error', async () => {
      chrome.storage.sync.get.mockRejectedValueOnce(new Error('Storage error'));
      chrome.tabs.query.mockResolvedValueOnce([]);

      await initializeBadge();

      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: 'ON' });
    });
  });

  describe('fetchExtensionStats', () => {
    beforeEach(() => {
      // Mock global fetch
      global.fetch = vi.fn();
    });

    it('should fetch and parse stats correctly', async () => {
      global.fetch
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ value: '1,234' })
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ value: '4.8/5' })
        });

      const stats = await fetchExtensionStats();

      expect(stats).toEqual({
        rating: '4.8',
        userCount: '1,234'
      });
    });

    it('should return null when user count is invalid', async () => {
      global.fetch
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ value: 'invalid' })
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ value: '4.8/5' })
        });

      const stats = await fetchExtensionStats();

      expect(stats).toBeNull();
    });

    it('should return null when rating is missing', async () => {
      global.fetch
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ value: '1,234' })
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({})
        });

      const stats = await fetchExtensionStats();

      expect(stats).toBeNull();
    });

    it('should return null on fetch error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const stats = await fetchExtensionStats();

      expect(stats).toBeNull();
    });

    it('should handle rating format without fraction', async () => {
      global.fetch
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ value: '500' })
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ value: '5' })
        });

      const stats = await fetchExtensionStats();

      expect(stats).toEqual({
        rating: '5.0',
        userCount: '500'
      });
    });
  });

  describe('toggleFilterForTab', () => {
    it('should toggle from enabled to disabled', async () => {
      chrome.storage.sync.get.mockResolvedValueOnce({ enabled: true });
      chrome.tabs.query.mockResolvedValue([]);

      await toggleFilterForTab({ id: 1, url: 'https://www.youtube.com/' });

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({ enabled: false });
    });

    it('should toggle from disabled to enabled', async () => {
      chrome.storage.sync.get.mockResolvedValueOnce({ enabled: false });
      chrome.tabs.query.mockResolvedValue([]);

      await toggleFilterForTab({ id: 1, url: 'https://www.youtube.com/' });

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({ enabled: true });
    });

    it('should update badge after toggle', async () => {
      chrome.storage.sync.get.mockResolvedValueOnce({ enabled: true });
      chrome.tabs.query.mockResolvedValue([]);

      await toggleFilterForTab({ id: 1 });

      expect(chrome.action.setBadgeText).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      chrome.storage.sync.get.mockRejectedValueOnce(new Error('Error'));

      await expect(toggleFilterForTab({ id: 1 })).resolves.not.toThrow();
    });
  });

  describe('Message Handlers', () => {
    // Test the message handler logic
    const handleMessage = async (request, sender, sendResponse) => {
      if (request.action === 'updateBadge' && typeof request.enabled === 'boolean') {
        try {
          await updateBadge(request.enabled);
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        return true;
      }

      if (request.action === 'getExtensionStats') {
        try {
          const stats = await fetchExtensionStats();
          sendResponse({ success: true, stats });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        return true;
      }

      return false;
    };

    it('should handle updateBadge message', async () => {
      chrome.tabs.query.mockResolvedValue([]);
      const sendResponse = vi.fn();

      await handleMessage({ action: 'updateBadge', enabled: true }, {}, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('should handle getExtensionStats message', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({ json: () => Promise.resolve({ value: '100' }) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ value: '5.0' }) });

      const sendResponse = vi.fn();

      await handleMessage({ action: 'getExtensionStats' }, {}, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        stats: { rating: '5.0', userCount: '100' }
      });
    });

    it('should ignore unknown actions', async () => {
      const sendResponse = vi.fn();

      const result = await handleMessage({ action: 'unknown' }, {}, sendResponse);

      expect(result).toBe(false);
      expect(sendResponse).not.toHaveBeenCalled();
    });
  });

  describe('Install/Update Handlers', () => {
    // Test the install handler logic
    const handleInstall = async (details) => {
      if (details.reason === 'install') {
        const defaults = {
          enabled: true,
          strictMode: false,
          hideVideos: true,
          hideChannels: true,
          selectedLanguages: ['en']
        };

        await chrome.storage.sync.set(defaults);
        await updateBadge(true);

        return { openedWelcome: true };
      } else if (details.reason === 'update') {
        const existing = await chrome.storage.sync.get([
          'enabled', 'strictMode', 'hideVideos', 'hideChannels', 'selectedLanguages'
        ]);

        const updates = {};

        if (existing.enabled === undefined) updates.enabled = true;
        if (existing.strictMode === undefined) updates.strictMode = false;
        if (existing.hideVideos === undefined) updates.hideVideos = true;
        if (existing.hideChannels === undefined) updates.hideChannels = true;
        if (existing.selectedLanguages === undefined) updates.selectedLanguages = ['en'];

        if (Object.keys(updates).length > 0) {
          await chrome.storage.sync.set(updates);
        }

        await initializeBadge();

        return { updates };
      }

      return null;
    };

    it('should set defaults on fresh install', async () => {
      chrome.tabs.query.mockResolvedValue([]);

      const result = await handleInstall({ reason: 'install' });

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        enabled: true,
        strictMode: false,
        hideVideos: true,
        hideChannels: true,
        selectedLanguages: ['en']
      });
      expect(result.openedWelcome).toBe(true);
    });

    it('should not overwrite existing settings on update', async () => {
      chrome.storage.sync.get.mockResolvedValueOnce({
        enabled: false,
        strictMode: true,
        hideVideos: true,
        hideChannels: false,
        selectedLanguages: ['tr']
      });
      chrome.tabs.query.mockResolvedValue([]);

      const result = await handleInstall({ reason: 'update' });

      // Should not call set because all values exist
      expect(result.updates).toEqual({});
    });

    it('should fill missing values on update', async () => {
      chrome.storage.sync.get
        .mockResolvedValueOnce({ enabled: true }) // First call for update check
        .mockResolvedValueOnce({ enabled: true }); // Second call for initializeBadge
      chrome.tabs.query.mockResolvedValue([]);

      const result = await handleInstall({ reason: 'update' });

      expect(result.updates).toEqual({
        strictMode: false,
        hideVideos: true,
        hideChannels: true,
        selectedLanguages: ['en']
      });
    });
  });
});
