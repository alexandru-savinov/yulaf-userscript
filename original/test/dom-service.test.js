/**
 * DOM Service Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Import the module
import '../src/content/services/dom-service.js';

describe('DOMService', () => {
  let service;

  beforeEach(() => {
    service = globalThis.DOMService;
    // Clear document body before each test
    document.body.innerHTML = '';
  });

  describe('extractText', () => {
    it('should extract text from video title element', () => {
      document.body.innerHTML = `
        <ytd-video-renderer>
          <h3 id="video-title">Test Video Title</h3>
        </ytd-video-renderer>
      `;

      const element = document.querySelector('ytd-video-renderer');
      const text = service.extractText(element, 'video');

      expect(text).toContain('Test Video Title');
    });

    it('should extract text from channel name element', () => {
      document.body.innerHTML = `
        <ytd-channel-renderer>
          <div id="channel-name">
            <a href="/channel/123">Test Channel</a>
          </div>
        </ytd-channel-renderer>
      `;

      const element = document.querySelector('ytd-channel-renderer');
      const text = service.extractText(element, 'channel');

      expect(text).toContain('Test Channel');
    });

    it('should combine title and description for videos', () => {
      document.body.innerHTML = `
        <ytd-video-renderer>
          <h3 id="video-title">Video Title</h3>
          <div class="metadata-snippet-container">Video Description</div>
        </ytd-video-renderer>
      `;

      const element = document.querySelector('ytd-video-renderer');
      const text = service.extractText(element, 'video');

      expect(text).toContain('Video Title');
      expect(text).toContain('Video Description');
    });

    it('should return empty string when no text found', () => {
      document.body.innerHTML = `
        <ytd-video-renderer>
          <div class="empty"></div>
        </ytd-video-renderer>
      `;

      const element = document.querySelector('ytd-video-renderer');
      const text = service.extractText(element, 'video');

      expect(text).toBe('');
    });

    it('should filter out timestamp-like text', () => {
      document.body.innerHTML = `
        <ytd-video-renderer>
          <h3>12:34</h3>
          <div id="video-title">Actual Title</div>
        </ytd-video-renderer>
      `;

      const element = document.querySelector('ytd-video-renderer');
      const text = service.extractText(element, 'video');

      expect(text).not.toContain('12:34');
      expect(text).toContain('Actual Title');
    });

    it('should use title attribute as fallback', () => {
      document.body.innerHTML = `
        <ytd-video-renderer>
          <h3 id="video-title" title="Fallback Title"></h3>
        </ytd-video-renderer>
      `;

      const element = document.querySelector('ytd-video-renderer');
      const text = service.extractText(element, 'video');

      expect(text).toContain('Fallback Title');
    });

    it('should deduplicate extracted texts', () => {
      document.body.innerHTML = `
        <ytd-video-renderer>
          <h3 id="video-title">Same Title</h3>
          <a id="video-title">Same Title</a>
        </ytd-video-renderer>
      `;

      const element = document.querySelector('ytd-video-renderer');
      const text = service.extractText(element, 'video');

      // Should only appear once due to Set usage
      const occurrences = (text.match(/Same Title/g) || []).length;
      expect(occurrences).toBe(1);
    });
  });

  describe('hideElement', () => {
    it('should hide element by setting display none', () => {
      document.body.innerHTML = '<div id="test">Content</div>';
      const element = document.getElementById('test');

      service.hideElement(element, 'video');

      expect(element.style.display).toBe('none');
    });

    it('should set hidden attribute with type', () => {
      document.body.innerHTML = '<div id="test">Content</div>';
      const element = document.getElementById('test');

      service.hideElement(element, 'channel');

      expect(element.getAttribute('data-language-filter-hidden')).toBe('channel');
    });
  });

  describe('showElement', () => {
    it('should show hidden element', () => {
      document.body.innerHTML = '<div id="test" style="display: none;">Content</div>';
      const element = document.getElementById('test');
      element.setAttribute('data-language-filter-hidden', 'video');

      service.showElement(element);

      expect(element.style.display).toBe('');
    });

    it('should remove hidden attribute', () => {
      document.body.innerHTML = '<div id="test" data-language-filter-hidden="video">Content</div>';
      const element = document.getElementById('test');

      service.showElement(element);

      expect(element.hasAttribute('data-language-filter-hidden')).toBe(false);
    });

    it('should clear visibility and opacity styles', () => {
      document.body.innerHTML = '<div id="test" style="visibility: hidden; opacity: 0;">Content</div>';
      const element = document.getElementById('test');

      service.showElement(element);

      expect(element.style.visibility).toBe('');
      expect(element.style.opacity).toBe('');
    });
  });

  describe('showAllHiddenContent', () => {
    it('should show all elements with hidden attribute', () => {
      document.body.innerHTML = `
        <div data-language-filter-hidden="video" style="display: none;">Video 1</div>
        <div data-language-filter-hidden="channel" style="display: none;">Channel 1</div>
        <div>Normal Element</div>
      `;

      service.showAllHiddenContent();

      const hiddenElements = document.querySelectorAll('[data-language-filter-hidden]');
      expect(hiddenElements.length).toBe(0);
    });

    it('should remove checked attributes', () => {
      document.body.innerHTML = `
        <div data-language-filter-checked="true" data-language-filter-lang="en">Element</div>
      `;

      service.showAllHiddenContent();

      const element = document.querySelector('div');
      expect(element.hasAttribute('data-language-filter-checked')).toBe(false);
      expect(element.hasAttribute('data-language-filter-lang')).toBe(false);
    });

    it('should show elements that are hidden via display none', () => {
      document.body.innerHTML = `
        <div data-language-filter-checked="true" style="display: none;">Hidden</div>
      `;

      service.showAllHiddenContent();

      const element = document.querySelector('div');
      expect(element.style.display).toBe('');
    });
  });

  describe('getAllElements', () => {
    it('should return all video elements', () => {
      document.body.innerHTML = `
        <ytd-video-renderer>Video 1</ytd-video-renderer>
        <ytd-video-renderer>Video 2</ytd-video-renderer>
        <ytd-compact-video-renderer>Video 3</ytd-compact-video-renderer>
      `;

      const elements = service.getAllElements('video');

      expect(elements.length).toBe(3);
    });

    it('should return all channel elements', () => {
      document.body.innerHTML = `
        <ytd-channel-renderer>Channel 1</ytd-channel-renderer>
        <ytd-channel-name>Channel 2</ytd-channel-name>
      `;

      const elements = service.getAllElements('channel');

      expect(elements.length).toBe(2);
    });

    it('should filter out ad elements', () => {
      document.body.innerHTML = `
        <ytd-video-renderer>Normal Video</ytd-video-renderer>
        <ytd-ad-slot-renderer>
          <ytd-video-renderer>Ad Video</ytd-video-renderer>
        </ytd-ad-slot-renderer>
        <ytd-in-feed-ad-layout-renderer>
          <ytd-video-renderer>In-feed Ad</ytd-video-renderer>
        </ytd-in-feed-ad-layout-renderer>
      `;

      const elements = service.getAllElements('video');

      expect(elements.length).toBe(1);
      expect(elements[0].textContent).toBe('Normal Video');
    });

    it('should return empty array when no elements found', () => {
      document.body.innerHTML = '<div>No videos here</div>';

      const elements = service.getAllElements('video');

      expect(elements).toEqual([]);
    });
  });
});
