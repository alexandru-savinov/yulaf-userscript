import { describe, it, expect, beforeEach } from 'vitest';
import { loadUserscript } from './_helpers/load.js';

const yulaf = loadUserscript();
const { DOMService } = yulaf;
const DATA_HIDDEN = yulaf.Constants.DATA_ATTRIBUTES.HIDDEN;

const fixtureHtml = `
  <div id="contents">
    <ytd-rich-item-renderer id="r1">
      <a id="video-title" href="/watch?v=1">  How to build a userscript  </a>
    </ytd-rich-item-renderer>
    <ytd-video-renderer id="r2">
      <a id="video-title" href="/watch?v=2">Sample title two</a>
    </ytd-video-renderer>
    <ytd-rich-item-renderer id="r3">
      <a id="video-title" href="/watch?v=3"></a>
    </ytd-rich-item-renderer>
    <ytd-ad-slot-renderer id="ad1">
      <a id="video-title" href="/ad">Promoted ad video</a>
    </ytd-ad-slot-renderer>
    <ytd-in-feed-ad-layout-renderer id="ad2">
      <ytd-rich-item-renderer id="r-in-ad">
        <a id="video-title" href="/ad2">Nested ad title</a>
      </ytd-rich-item-renderer>
    </ytd-in-feed-ad-layout-renderer>
  </div>
`;

describe('DOMService', () => {
  beforeEach(() => {
    document.body.innerHTML = fixtureHtml;
  });

  it('extractText returns trimmed text from the title selector', () => {
    const el = document.getElementById('r1');
    const text = DOMService.extractText(el, 'video');
    expect(text).toContain('How to build a userscript');
    expect(text.startsWith(' ')).toBe(false);
    expect(text.endsWith(' ')).toBe(false);
  });

  it('extractText returns empty string when no title text is present', () => {
    const el = document.getElementById('r3');
    const text = DOMService.extractText(el, 'video');
    expect(text).toBe('');
  });

  it('hideElement sets display:none and the hidden data attribute', () => {
    const el = document.getElementById('r1');
    DOMService.hideElement(el, 'video');
    expect(el.style.display).toBe('none');
    expect(el.getAttribute(DATA_HIDDEN)).toBe('video');
    expect(DOMService.isHidden(el)).toBe(true);
  });

  it('showElement reverses hideElement (round-trip)', () => {
    const el = document.getElementById('r2');
    DOMService.hideElement(el, 'video');
    DOMService.showElement(el);
    expect(el.style.display).toBe('');
    expect(el.hasAttribute(DATA_HIDDEN)).toBe(false);
    expect(DOMService.isHidden(el)).toBe(false);
  });

  it('isHidden is false for fresh elements', () => {
    const el = document.getElementById('r1');
    expect(DOMService.isHidden(el)).toBe(false);
  });

  it('getAllElements returns video elements and excludes ads', () => {
    const elements = DOMService.getAllElements('video');
    const ids = elements.map((el) => el.id).filter(Boolean);
    expect(ids).toContain('r1');
    expect(ids).toContain('r2');
    expect(ids).toContain('r3');
    expect(ids).not.toContain('ad1');
    expect(ids).not.toContain('r-in-ad');
  });

  it('getAllElements returns [] for an unknown type', () => {
    expect(DOMService.getAllElements('unknown-type')).toEqual([]);
  });
});
