/**
 * Chrome Extension API Mocks for Vitest
 */

// Storage mock with in-memory data
const createStorageMock = () => {
  let data = {};
  const listeners = [];

  return {
    sync: {
      get: vi.fn((keys) => {
        return new Promise((resolve) => {
          if (keys === null || keys === undefined) {
            resolve({ ...data });
          } else if (typeof keys === 'string') {
            resolve({ [keys]: data[keys] });
          } else if (Array.isArray(keys)) {
            const result = {};
            keys.forEach((key) => {
              if (data[key] !== undefined) {
                result[key] = data[key];
              }
            });
            resolve(result);
          } else {
            resolve({ ...keys, ...data });
          }
        });
      }),
      set: vi.fn((items) => {
        return new Promise((resolve) => {
          const changes = {};
          Object.entries(items).forEach(([key, value]) => {
            changes[key] = { oldValue: data[key], newValue: value };
            data[key] = value;
          });
          listeners.forEach((listener) => listener(changes, 'sync'));
          resolve();
        });
      }),
      remove: vi.fn((keys) => {
        return new Promise((resolve) => {
          const keysArray = Array.isArray(keys) ? keys : [keys];
          keysArray.forEach((key) => delete data[key]);
          resolve();
        });
      }),
      clear: vi.fn(() => {
        return new Promise((resolve) => {
          data = {};
          resolve();
        });
      })
    },
    onChanged: {
      addListener: vi.fn((callback) => {
        listeners.push(callback);
      }),
      removeListener: vi.fn((callback) => {
        const index = listeners.indexOf(callback);
        if (index > -1) listeners.splice(index, 1);
      })
    },
    // Helper for tests to reset storage
    _reset: () => {
      data = {};
    },
    _setData: (newData) => {
      data = { ...newData };
    }
  };
};

// i18n mock with language detection simulation
const createI18nMock = () => {
  const languagePatterns = {
    ja: /[\u3040-\u309F\u30A0-\u30FF]/,
    ko: /[\uAC00-\uD7AF]/,
    zh: /[\u4E00-\u9FAF]/,
    ru: /[\u0400-\u04FF]/,
    ar: /[\u0600-\u06FF]/,
    th: /[\u0E00-\u0E7F]/,
    el: /[\u0370-\u03FF]/,
    he: /[\u0590-\u05FF]/,
    hi: /[\u0900-\u097F]/
  };

  // Configurable overrides for specific text patterns
  const overrides = new Map();

  const defaultDetect = (text) => {
    let detectedLang = 'en';
    let percentage = 85;
    let isReliable = true;
    let secondary = null;

    for (const [lang, pattern] of Object.entries(languagePatterns)) {
      if (pattern.test(text)) {
        detectedLang = lang;
        break;
      }
    }

    // Turkish detection for Latin text with Turkish characters
    if (/[çğıöşüÇĞİÖŞÜ]/.test(text)) {
      detectedLang = 'tr';
      percentage = 75;
      isReliable = false;
      secondary = { language: 'en', percentage: 15 };
    }

    // German detection for Latin text with German-specific patterns
    if (/[äöüßÄÖÜ]/.test(text)) {
      detectedLang = 'de';
      percentage = 78;
      isReliable = false;
      secondary = { language: 'en', percentage: 12 };
    }

    // Lower reliability for short text
    if (text.length < 10) {
      isReliable = false;
      percentage = Math.min(percentage, 65);
    }

    const languages = [{ language: detectedLang, percentage }];
    if (secondary) languages.push(secondary);

    return { isReliable, languages };
  };

  return {
    detectLanguage: vi.fn((text, callback) => {
      // Check overrides first (string match or regex)
      for (const [pattern, result] of overrides) {
        const matches = typeof pattern === 'string'
          ? text.includes(pattern)
          : pattern.test(text);
        if (matches) {
          callback(typeof result === 'function' ? result(text) : result);
          return;
        }
      }

      callback(defaultDetect(text));
    }),
    getMessage: vi.fn((key) => key),
    getUILanguage: vi.fn(() => 'en'),

    // Test helpers for configurable detection
    _setDetectionResult: (textPattern, result) => {
      overrides.set(textPattern, result);
    },
    _resetOverrides: () => {
      overrides.clear();
    }
  };
};

// Runtime mock
const createRuntimeMock = () => {
  const messageListeners = [];

  return {
    onMessage: {
      addListener: vi.fn((callback) => {
        messageListeners.push(callback);
      }),
      removeListener: vi.fn((callback) => {
        const index = messageListeners.indexOf(callback);
        if (index > -1) messageListeners.splice(index, 1);
      })
    },
    sendMessage: vi.fn((message) => {
      return new Promise((resolve) => {
        messageListeners.forEach((listener) => {
          listener(message, {}, resolve);
        });
      });
    }),
    getURL: vi.fn((path) => `chrome-extension://mock-id/${path}`),
    id: 'mock-extension-id'
  };
};

// Tabs mock
const createTabsMock = () => {
  return {
    query: vi.fn(() => Promise.resolve([{ id: 1, url: 'https://www.youtube.com/' }])),
    sendMessage: vi.fn(() => Promise.resolve({})),
    onUpdated: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  };
};

// Action mock (for badge)
const createActionMock = () => {
  return {
    setBadgeText: vi.fn(() => Promise.resolve()),
    setBadgeBackgroundColor: vi.fn(() => Promise.resolve()),
    setBadgeTextColor: vi.fn(() => Promise.resolve()),
    setIcon: vi.fn(() => Promise.resolve()),
    onClicked: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  };
};

// Commands mock (for keyboard shortcuts)
const createCommandsMock = () => {
  const listeners = [];
  return {
    onCommand: {
      addListener: vi.fn((callback) => {
        listeners.push(callback);
      }),
      removeListener: vi.fn((callback) => {
        const index = listeners.indexOf(callback);
        if (index > -1) listeners.splice(index, 1);
      }),
      // Helper for testing
      _trigger: (command) => {
        listeners.forEach(listener => listener(command));
      }
    }
  };
};

// Windows mock
const createWindowsMock = () => {
  return {
    WINDOW_ID_NONE: -1,
    get: vi.fn((windowId, options) => Promise.resolve({
      id: windowId,
      tabs: [{ id: 1, active: true, url: 'https://www.youtube.com/' }]
    })),
    onFocusChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  };
};

// Create the complete chrome mock
export const createChromeMock = () => {
  const storage = createStorageMock();

  return {
    storage,
    i18n: createI18nMock(),
    runtime: createRuntimeMock(),
    tabs: createTabsMock(),
    action: createActionMock(),
    commands: createCommandsMock(),
    windows: createWindowsMock()
  };
};

// Default export for easy setup
export const chromeMock = createChromeMock();
