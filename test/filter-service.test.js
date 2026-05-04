import { describe, it, expect, beforeEach } from 'vitest';
import { loadUserscript } from './_helpers/load.js';

const yulaf = loadUserscript();
const { FilterService, LanguageService, Controller, DOMService, Constants } = yulaf;
const DATA = Constants.DATA_ATTRIBUTES;

const fixtureHtml = `
  <div id="contents">
    <ytd-rich-item-renderer id="en1">
      <a id="video-title" href="/watch?v=en1">How to build a userscript from scratch</a>
    </ytd-rich-item-renderer>
    <ytd-rich-item-renderer id="en2">
      <a id="video-title" href="/watch?v=en2">The complete beginners guide to learning English grammar</a>
    </ytd-rich-item-renderer>
    <ytd-rich-item-renderer id="ru1">
      <a id="video-title" href="/watch?v=ru1">Как настроить расширение для Safari</a>
    </ytd-rich-item-renderer>
    <ytd-video-renderer id="ja1">
      <a id="video-title" href="/watch?v=ja1">日本語のタイトルのサンプル動画</a>
    </ytd-video-renderer>
  </div>
`;

const settings = {
  enabled: true,
  strictMode: false,
  hideVideos: true,
  hideChannels: true,
  selectedLanguages: ['en'],
};

function resetState() {
  document.body.innerHTML = fixtureHtml;
  LanguageService.clearCache();
  LanguageService.setLanguages(['en']);
  LanguageService.setStrictMode(false);
  FilterService._loggedTexts.clear();
}

describe('FilterService.filterContent', () => {
  beforeEach(() => {
    resetState();
  });

  it('hides items whose detected language is not in the allowlist', () => {
    FilterService.filterContent(settings);
    expect(DOMService.isHidden(document.getElementById('ru1'))).toBe(true);
    expect(DOMService.isHidden(document.getElementById('ja1'))).toBe(true);
  });

  it('shows items whose detected language IS in the allowlist', () => {
    FilterService.filterContent(settings);
    expect(DOMService.isHidden(document.getElementById('en1'))).toBe(false);
    expect(DOMService.isHidden(document.getElementById('en2'))).toBe(false);
  });

  it('marks every processed element with the checked + processed attributes', () => {
    FilterService.filterContent(settings);
    for (const id of ['en1', 'en2', 'ru1', 'ja1']) {
      const el = document.getElementById(id);
      expect(el.getAttribute(DATA.CHECKED)).toBe('true');
      expect(el.getAttribute(DATA.PROCESSED)).toBe('1');
      expect(el.getAttribute(DATA.LANG)).toBe('en');
    }
  });

  it('is idempotent — re-running does not re-process unchanged elements', () => {
    FilterService.filterContent(settings);
    const ru = document.getElementById('ru1');
    const v1 = ru.getAttribute(DATA.VERSION);
    FilterService.filterContent(settings);
    const v2 = ru.getAttribute(DATA.VERSION);
    expect(v2).toBe(v1);
    expect(DOMService.isHidden(ru)).toBe(true);
  });

  it('re-checks elements when the language allowlist changes', () => {
    FilterService.filterContent(settings);
    expect(DOMService.isHidden(document.getElementById('ru1'))).toBe(true);

    LanguageService.setLanguages(['ru']);
    FilterService.filterContent({ ...settings, selectedLanguages: ['ru'] });
    expect(DOMService.isHidden(document.getElementById('ru1'))).toBe(false);
    expect(DOMService.isHidden(document.getElementById('en1'))).toBe(true);
  });

  it('skips ad slots entirely', () => {
    document.body.innerHTML = `
      <ytd-ad-slot-renderer id="ad1">
        <a id="video-title" href="/ad">Promoted ad video</a>
      </ytd-ad-slot-renderer>
    `;
    FilterService.filterContent(settings);
    const ad = document.getElementById('ad1');
    expect(ad.hasAttribute(DATA.CHECKED)).toBe(false);
    expect(DOMService.isHidden(ad)).toBe(false);
  });
});

describe('FilterService.processNewNode', () => {
  beforeEach(() => {
    resetState();
  });

  it('processes a newly-added matching node', () => {
    document.body.innerHTML = '<div id="contents"></div>';
    const contents = document.getElementById('contents');

    const newItem = document.createElement('ytd-rich-item-renderer');
    newItem.id = 'newRu';
    newItem.innerHTML = '<a id="video-title" href="/watch?v=newRu">Лучшие фильмы прошлого года</a>';
    contents.appendChild(newItem);

    FilterService.processNewNode(newItem, settings);
    expect(DOMService.isHidden(newItem)).toBe(true);
  });

  it('processes matching descendants of an added subtree', () => {
    document.body.innerHTML = '<div id="contents"></div>';
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <ytd-rich-item-renderer id="nestedJa">
        <a id="video-title" href="/watch?v=nj">日本語のタイトルのサンプル動画</a>
      </ytd-rich-item-renderer>
    `;
    document.getElementById('contents').appendChild(wrapper);
    FilterService.processNewNode(wrapper, settings);
    expect(DOMService.isHidden(document.getElementById('nestedJa'))).toBe(true);
  });
});

describe('Controller MutationObserver integration', () => {
  beforeEach(() => {
    resetState();
    Controller._cleanupObservers();
    Controller._unpatchHistory();
    Controller.filteringActive = false;
  });

  it('picks up dynamically inserted nodes and filters them', async () => {
    document.body.innerHTML = '<div id="contents"></div>';
    Controller.init();

    // Let the initial (debounced) filter cycle settle.
    await new Promise((r) => setTimeout(r, 200));

    // Inject a non-English item after init.
    const item = document.createElement('ytd-rich-item-renderer');
    item.id = 'lateRu';
    item.innerHTML = '<a id="video-title" href="/watch?v=lr">Как настроить расширение для Safari</a>';
    document.getElementById('contents').appendChild(item);

    // Wait for MutationObserver microtask + processing to flush.
    await new Promise((r) => setTimeout(r, 200));

    expect(item.getAttribute(DATA.CHECKED)).toBe('true');
    expect(DOMService.isHidden(item)).toBe(true);

    Controller.stop();
  });

  it('Controller.stop() reveals previously hidden content', async () => {
    document.body.innerHTML = fixtureHtml;
    Controller.init();
    // Run the initial filter cycle synchronously.
    FilterService.filterContent(Controller.settings);
    expect(DOMService.isHidden(document.getElementById('ru1'))).toBe(true);

    Controller.stop();
    expect(DOMService.isHidden(document.getElementById('ru1'))).toBe(false);
  });
});
