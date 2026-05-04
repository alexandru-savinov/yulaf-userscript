import {
  EXTENSION_ID,
  SHIELDS_IO_BASE,
  BADGE_COLOR_ON,
  BADGE_COLOR_OFF,
  BADGE_TEXT_COLOR,
  BADGE_FALLBACK_DARK,
  FETCH_TIMEOUT,
  STATS_CACHE_TTL,
  WELCOME_PAGE,
  DEFAULT_SETTINGS,
} from '../common/constants-bg.js';

// Add helper to always attempt white text and fallback to forcing a dark background
async function setBadgeTextAndColor({ text, bgColor, tabId } = {}) {
  try {
    // prepare options
    const textOpts = { text: String(text) };
    const bgOpts = { color: String(bgColor) };
    if (typeof tabId !== 'undefined') {
      textOpts.tabId = tabId;
      bgOpts.tabId = tabId;
    }

    // set text and background
    await chrome.action.setBadgeText(textOpts);
    await chrome.action.setBadgeBackgroundColor(bgOpts);

    // try to explicitly set white text color; if unsupported, fall back below
    try {
      const colorOpts = { color: BADGE_TEXT_COLOR };
      if (typeof tabId !== 'undefined') colorOpts.tabId = tabId;
      await chrome.action.setBadgeTextColor(colorOpts);
    } catch {
      // API not available: enforce a very dark background so Chrome will choose white text automatically
      const forcedDark = BADGE_FALLBACK_DARK;
      if ((bgColor || '').toLowerCase() !== forcedDark) {
        const forcedBgOpts = { color: forcedDark };
        if (typeof tabId !== 'undefined') forcedBgOpts.tabId = tabId;
        try {
          await chrome.action.setBadgeBackgroundColor(forcedBgOpts);
        } catch {
          // ignore; we attempted best-effort to force dark background
        }
      }
    }
  } catch (err) {
    console.warn('[YuLaF] Badge update failed:', err.message || err);
  }
}

// Badge state cache to avoid redundant updates
let lastBadgeState = null;

// Badge update function with better error handling
async function updateBadge(enabled) {
  if (lastBadgeState === enabled) return;
  try {
    const badgeText = enabled ? 'ON' : 'OFF';
    // Green when ON, gray when OFF
    const badgeColor = enabled ? BADGE_COLOR_ON : BADGE_COLOR_OFF;

    // Set badge globally using centralized helper
    await setBadgeTextAndColor({ text: badgeText, bgColor: badgeColor });

    // Also update for all existing YouTube tabs in parallel
    const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
    await Promise.allSettled(
      tabs
        .filter(tab => tab.id)
        .map(tab => setBadgeTextAndColor({ text: badgeText, bgColor: badgeColor, tabId: tab.id }))
    );

    lastBadgeState = enabled;
  } catch (err) {
    console.warn('[YuLaF] Badge update failed:', err.message || err);
  }
}

// Initialize badge on startup
async function initializeBadge() {
  try {
    const result = await chrome.storage.sync.get(['enabled']);
    const enabled = result.enabled !== false;
    await updateBadge(enabled);
  } catch {
    await updateBadge(true);
  }
}

// On install or update
chrome.runtime.onInstalled.addListener(async details => {
  if (details.reason === 'install') {
    // Only set defaults on fresh install - don't overwrite existing settings
    await chrome.storage.sync.set(DEFAULT_SETTINGS);

    // Initialize badge immediately
    await updateBadge(true);

    // Open welcome page for new users
    chrome.tabs.create({ url: chrome.runtime.getURL(WELCOME_PAGE) }).catch(err => {
      console.warn('[YuLaF] Failed to open welcome page:', err.message || err);
    });
  } else if (details.reason === 'update') {
    // On update: preserve user's existing settings, only fill in missing values
    const existing = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));

    const updates = {};
    for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
      if (existing[key] === undefined) updates[key] = defaultValue;
    }

    // Only write if there are missing values to fill
    if (Object.keys(updates).length > 0) {
      await chrome.storage.sync.set(updates);
    }

    // Re-initialize badge on update
    await initializeBadge();
  }
});

// Listen for storage changes
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'sync' && changes.enabled) {
    await updateBadge(changes.enabled.newValue);
  }
});

// Fetch Chrome Web Store stats via Shields.io API with caching
async function fetchExtensionStats() {
  try {
    // Check cache first
    const cached = await chrome.storage.local.get(['statsCache', 'statsCacheTime']);
    if (cached.statsCache && cached.statsCacheTime) {
      const age = Date.now() - cached.statsCacheTime;
      if (age < STATS_CACHE_TTL) {
        return cached.statsCache;
      }
    }

    // Fetch from Shields.io API with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    let usersRes, ratingRes;
    try {
      [usersRes, ratingRes] = await Promise.all([
        fetch(`${SHIELDS_IO_BASE}/users/${EXTENSION_ID}.json`, {
          signal: controller.signal,
        }),
        fetch(`${SHIELDS_IO_BASE}/rating/${EXTENSION_ID}.json`, {
          signal: controller.signal,
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }

    const usersData = await usersRes.json();
    const ratingData = await ratingRes.json();

    // Parse user count - show exact number
    let userCount = null;
    if (usersData?.value) {
      const count = parseInt(usersData.value.replace(/[,.\s]/g, ''));
      if (count > 0) {
        userCount = count.toLocaleString('en-US');
      }
    }

    // Parse rating (format: "5/5" or "4.8/5")
    let rating = null;
    if (ratingData?.value) {
      const ratingMatch = ratingData.value.match(/([\d.]+)/);
      if (ratingMatch) {
        rating = parseFloat(ratingMatch[1]).toFixed(1);
      }
    }

    // Return null if we couldn't get valid data
    if (!userCount || !rating) {
      return null;
    }

    const stats = { rating, userCount };

    // Cache the result
    chrome.storage.local.set({ statsCache: stats, statsCacheTime: Date.now() }).catch(() => {});

    return stats;
  } catch {
    // On fetch failure, return stale cache if available
    try {
      const stale = await chrome.storage.local.get(['statsCache']);
      if (stale.statsCache) return stale.statsCache;
    } catch {
      // ignore
    }
    return null;
  }
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Verify sender is this extension
  if (sender.id !== chrome.runtime.id) return;
  if (request.action === 'updateBadge' && typeof request.enabled === 'boolean') {
    updateBadge(request.enabled)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Will respond asynchronously
  }

  if (request.action === 'getExtensionStats') {
    fetchExtensionStats()
      .then(stats => {
        sendResponse({ success: true, stats });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Will respond asynchronously
  }
});

// Tab activation - refresh badge for active tab
chrome.tabs.onActivated.addListener(async activeInfo => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url?.includes('youtube.com')) {
      await initializeBadge();
    }
  } catch (err) {
    console.warn('[YuLaF] Tab activation handler failed:', err.message || err);
  }
});

// Tab update - refresh badge when URL changes
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('youtube.com')) {
    try {
      const result = await chrome.storage.sync.get(['enabled']);
      const enabled = result.enabled !== false;
      const badgeText = enabled ? 'ON' : 'OFF';
      const badgeColor = enabled ? BADGE_COLOR_ON : BADGE_COLOR_OFF;
      await setBadgeTextAndColor({ text: badgeText, bgColor: badgeColor, tabId });
    } catch (err) {
      console.warn('[YuLaF] Tab update badge failed:', err.message || err);
    }
  }
});

// Window focus change - refresh badge
chrome.windows.onFocusChanged.addListener(async windowId => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    try {
      const win = await chrome.windows.get(windowId, { populate: true });
      const activeTab = win.tabs?.find(tab => tab.active);
      if (activeTab?.url?.includes('youtube.com')) {
        await initializeBadge();
      }
    } catch (err) {
      console.warn('[YuLaF] Window focus handler failed:', err.message || err);
    }
  }
});

// Initialize badge immediately when service worker starts
initializeBadge();

// Refresh badge when extension starts or Chrome starts
chrome.runtime.onStartup.addListener(() => {
  initializeBadge();
});

// Keyboard shortcut handler (Alt+Y)
// When the active tab is YouTube, the content script's own keydown handler
// fires first and toggles via storage — so the background must NOT also toggle,
// otherwise the two toggles cancel each other out.
chrome.commands.onCommand.addListener(async command => {
  if (command === 'toggle-filter') {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (activeTab?.url?.includes('youtube.com')) {
        // Content script handles the toggle on YouTube tabs — do nothing here.
        return;
      }

      // Not on YouTube: find any YouTube tab and toggle it from background.
      const ytTabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
      if (ytTabs.length === 0) return;

      await toggleFilterForTab(ytTabs[0]);
    } catch (err) {
      console.warn('[YuLaF] Command handler failed:', err.message || err);
    }
  }
});

// Helper function to toggle filter for a specific tab
async function toggleFilterForTab(tab) {
  try {
    // Get current state and toggle
    const result = await chrome.storage.sync.get(['enabled']);
    const newEnabled = result.enabled === false;

    // Save to storage
    await chrome.storage.sync.set({ enabled: newEnabled });

    // Update badge
    await updateBadge(newEnabled);

    // Explicitly notify the content script so it reacts immediately,
    // even if the service worker was asleep and storage.onChanged is delayed.
    if (tab?.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'updateState',
          state: { enabled: newEnabled },
        });
      } catch {
        // Content script may not be injected yet — storage.onChanged will handle it
      }
    }
  } catch (err) {
    console.warn('[YuLaF] Toggle failed:', err.message || err);
  }
}
