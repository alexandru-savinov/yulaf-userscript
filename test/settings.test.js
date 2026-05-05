import { describe, it, expect, beforeEach } from 'vitest';
import { loadUserscript } from './_helpers/load.js';

const fixtureHtml = `
  <div id="contents">
    <ytd-rich-item-renderer id="en1">
      <a id="video-title" href="/watch?v=en1">How to build a userscript from scratch</a>
    </ytd-rich-item-renderer>
    <ytd-rich-item-renderer id="ru1">
      <a id="video-title" href="/watch?v=ru1">Как настроить расширение для Safari</a>
    </ytd-rich-item-renderer>
  </div>
`;

describe('SettingsService.load', () => {
  it('returns defaults when GM storage is empty', () => {
    const yulaf = loadUserscript({ gmStorage: new Map() });
    const settings = yulaf.SettingsService.load();
    const d = yulaf.Constants.DEFAULTS;
    expect(settings.enabled).toBe(d.enabled);
    expect(settings.strictMode).toBe(d.strictMode);
    expect(settings.hideVideos).toBe(d.hideVideos);
    expect(settings.hideChannels).toBe(d.hideChannels);
    expect(settings.selectedLanguages).toEqual(d.selectedLanguages);
  });

  it('falls back to defaults without GM bridge present', () => {
    const yulaf = loadUserscript();
    const settings = yulaf.SettingsService.load();
    expect(settings.enabled).toBe(true);
    expect(settings.selectedLanguages).toEqual(['en']);
  });

  it('rejects unknown language codes from storage', () => {
    const yulaf = loadUserscript({
      gmStorage: new Map([['selectedLanguages', ['en', 'xx', 'fakelang', 'ru']]]),
    });
    const settings = yulaf.SettingsService.load();
    expect(settings.selectedLanguages).toEqual(['en', 'ru']);
  });

  it('falls back to defaults when storage has only invalid codes', () => {
    const yulaf = loadUserscript({
      gmStorage: new Map([['selectedLanguages', ['xx']]]),
    });
    const settings = yulaf.SettingsService.load();
    expect(settings.selectedLanguages).toEqual(['en']);
  });

  it('always includes English as a floor, even when stored prefs exclude it', () => {
    const yulaf = loadUserscript({
      gmStorage: new Map([['selectedLanguages', ['ru', 'ja']]]),
    });
    const settings = yulaf.SettingsService.load();
    expect(settings.selectedLanguages).toContain('en');
    expect(settings.selectedLanguages).toContain('ru');
    expect(settings.selectedLanguages).toContain('ja');
  });
});

describe('SettingsService.save / round-trip', () => {
  it('writes through to GM storage and reloads identically', () => {
    const storage = new Map();
    const yulaf = loadUserscript({ gmStorage: storage });
    yulaf.SettingsService.save({
      enabled: false,
      strictMode: true,
      selectedLanguages: ['ru', 'ja'],
    });
    expect(storage.get('enabled')).toBe(false);
    expect(storage.get('strictMode')).toBe(true);
    expect(storage.get('selectedLanguages')).toEqual(['ru', 'ja']);

    const reloaded = yulaf.SettingsService.load();
    expect(reloaded.enabled).toBe(false);
    expect(reloaded.strictMode).toBe(true);
    // English is now an enforced floor — load() always includes it.
    expect(reloaded.selectedLanguages).toEqual(expect.arrayContaining(['ru', 'ja', 'en']));
  });

  it('subscribers are notified on save', () => {
    const yulaf = loadUserscript({ gmStorage: new Map() });
    const calls = [];
    const unsubscribe = yulaf.SettingsService.subscribe((u) => calls.push(u));
    yulaf.SettingsService.save({ enabled: false });
    yulaf.SettingsService.save({ selectedLanguages: ['fr'] });
    expect(calls).toEqual([{ enabled: false }, { selectedLanguages: ['fr'] }]);
    unsubscribe();
    yulaf.SettingsService.save({ enabled: true });
    expect(calls.length).toBe(2);
  });

  it('ignores unknown keys', () => {
    const storage = new Map();
    const yulaf = loadUserscript({ gmStorage: storage });
    yulaf.SettingsService.save({ enabled: false, garbage: 'x' });
    expect(storage.has('garbage')).toBe(false);
    expect(storage.get('enabled')).toBe(false);
  });
});

describe('Controller.init loads from SettingsService', () => {
  beforeEach(() => {
    document.body.innerHTML = fixtureHtml;
  });

  it('uses persisted selectedLanguages instead of the ["en"] default', () => {
    const yulaf = loadUserscript({
      gmStorage: new Map([['selectedLanguages', ['ru']]]),
    });
    yulaf.Controller._cleanupObservers();
    yulaf.Controller._unpatchHistory();
    yulaf.Controller.filteringActive = false;
    yulaf.Controller.init();
    // English is force-included as a fallback floor; ['ru'] becomes ['ru', 'en'].
    expect(yulaf.Controller.settings.selectedLanguages).toEqual(expect.arrayContaining(['ru', 'en']));
    expect(yulaf.LanguageService.selectedLanguages).toEqual(expect.arrayContaining(['ru', 'en']));
    yulaf.Controller.stop();
  });

  it('does not start the filter when storage marks it disabled', () => {
    const yulaf = loadUserscript({
      gmStorage: new Map([['enabled', false]]),
    });
    yulaf.Controller._cleanupObservers();
    yulaf.Controller._unpatchHistory();
    yulaf.Controller.filteringActive = false;
    yulaf.Controller.init();
    expect(yulaf.Controller.settings.enabled).toBe(false);
    expect(yulaf.Controller.filteringActive).toBe(false);
    yulaf.Controller.stop();
  });
});

describe('Controller.updateSettings triggers re-filter', () => {
  it('re-filters with the new allowlist when languages change', async () => {
    document.body.innerHTML = fixtureHtml;
    const yulaf = loadUserscript({
      gmStorage: new Map([['selectedLanguages', ['en']]]),
    });
    yulaf.Controller._cleanupObservers();
    yulaf.Controller._unpatchHistory();
    yulaf.Controller.filteringActive = false;
    yulaf.Controller.init();

    yulaf.FilterService.filterContent(yulaf.Controller.settings);
    expect(yulaf.DOMService.isHidden(document.getElementById('ru1'))).toBe(true);
    expect(yulaf.DOMService.isHidden(document.getElementById('en1'))).toBe(false);

    yulaf.Controller.updateSettings({ selectedLanguages: ['ru'] });
    // Allow the debounced re-filter cycle to run.
    await new Promise((r) => setTimeout(r, 200));

    expect(yulaf.DOMService.isHidden(document.getElementById('ru1'))).toBe(false);
    expect(yulaf.DOMService.isHidden(document.getElementById('en1'))).toBe(true);

    yulaf.Controller.stop();
  });

  it('Controller.setEnabled(false) reveals all hidden content', () => {
    document.body.innerHTML = fixtureHtml;
    const yulaf = loadUserscript({ gmStorage: new Map() });
    yulaf.Controller._cleanupObservers();
    yulaf.Controller._unpatchHistory();
    yulaf.Controller.filteringActive = false;
    yulaf.Controller.init();
    yulaf.FilterService.filterContent(yulaf.Controller.settings);
    expect(yulaf.DOMService.isHidden(document.getElementById('ru1'))).toBe(true);

    yulaf.Controller.setEnabled(false);
    expect(yulaf.Controller.settings.enabled).toBe(false);
    expect(yulaf.DOMService.isHidden(document.getElementById('ru1'))).toBe(false);
  });

  it('persists changes through GM_setValue', () => {
    const storage = new Map();
    const yulaf = loadUserscript({ gmStorage: storage });
    yulaf.Controller._cleanupObservers();
    yulaf.Controller._unpatchHistory();
    yulaf.Controller.filteringActive = false;
    yulaf.Controller.init();

    yulaf.Controller.updateSettings({ strictMode: true, selectedLanguages: ['fr'] });
    expect(storage.get('strictMode')).toBe(true);
    expect(storage.get('selectedLanguages')).toEqual(['fr']);

    yulaf.Controller.setEnabled(false);
    expect(storage.get('enabled')).toBe(false);
    yulaf.Controller.stop();
  });
});

describe('SettingsUI', () => {
  it('mounts a floating toggle button on the body', () => {
    document.body.innerHTML = '';
    const yulaf = loadUserscript({ gmStorage: new Map() });
    yulaf.Controller._cleanupObservers();
    yulaf.Controller._unpatchHistory();
    yulaf.Controller.filteringActive = false;
    yulaf.SettingsUI.destroy();
    yulaf.Controller.init();
    const root = document.querySelector('[data-yulaf-ui]');
    expect(root).toBeTruthy();
    const btn = root.querySelector('.yulaf-toggle');
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('data-enabled')).toBe('1');
    yulaf.SettingsUI.destroy();
    yulaf.Controller.stop();
  });
});
