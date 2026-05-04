/**
 * Filter Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Import dependencies in order
import '../src/content/services/language-detector.js';
import '../src/content/services/language-service.js';
import '../src/content/services/dom-service.js';
import '../src/content/services/filter-service.js';

describe('FilterService', () => {
  let service;
  let mockSettings;

  beforeEach(() => {
    service = globalThis.FilterService;
    document.body.innerHTML = '';

    // Reset service state
    service.processingElements = new WeakSet();
    if (service._loggedTexts) service._loggedTexts.clear();

    // Setup LanguageService
    globalThis.LanguageService.setLanguages(['en']);
    globalThis.LanguageService.clearCache();

    // Default settings
    mockSettings = {
      enabled: true,
      strictMode: false,
      hideVideos: true,
      hideChannels: true,
      selectedLanguages: ['en']
    };
  });

  describe('log', () => {
    it('should not log when debug is false', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      service.debug = false;

      service.log('test message');

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log when debug is true', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      service.debug = true;

      service.log('test message');

      expect(consoleSpy).toHaveBeenCalledWith('[YuLaF]', 'test message');

      service.debug = false;
      consoleSpy.mockRestore();
    });
  });

  describe('filterContent', () => {
    it('should return early if settings is null', async () => {
      const filterSpy = vi.spyOn(service, 'filterElementType');

      await service.filterContent(null);

      expect(filterSpy).not.toHaveBeenCalled();
      filterSpy.mockRestore();
    });

    it('should filter videos when hideVideos is true', async () => {
      document.body.innerHTML = `
        <ytd-video-renderer>
          <h3 id="video-title">Hello World English Video</h3>
        </ytd-video-renderer>
      `;

      await service.filterContent({ ...mockSettings, hideChannels: false });

      // Should have processed the video
      const video = document.querySelector('ytd-video-renderer');
      expect(video.hasAttribute('data-language-filter-checked')).toBe(true);
    });

    it('should filter channels when hideChannels is true', async () => {
      document.body.innerHTML = `
        <ytd-channel-renderer>
          <div id="channel-name"><a>English Channel</a></div>
        </ytd-channel-renderer>
      `;

      await service.filterContent({ ...mockSettings, hideVideos: false });

      const channel = document.querySelector('ytd-channel-renderer');
      expect(channel.hasAttribute('data-language-filter-checked')).toBe(true);
    });

    it('should process both videos and channels in parallel', async () => {
      document.body.innerHTML = `
        <ytd-video-renderer>
          <h3 id="video-title">English Video</h3>
        </ytd-video-renderer>
        <ytd-channel-renderer>
          <div id="channel-name"><a>English Channel</a></div>
        </ytd-channel-renderer>
      `;

      await service.filterContent(mockSettings);

      const video = document.querySelector('ytd-video-renderer');
      const channel = document.querySelector('ytd-channel-renderer');

      expect(video.hasAttribute('data-language-filter-checked')).toBe(true);
      expect(channel.hasAttribute('data-language-filter-checked')).toBe(true);
    });
  });

  describe('processElement', () => {
    it('should skip elements already being processed', async () => {
      document.body.innerHTML = `
        <ytd-video-renderer>
          <h3 id="video-title">Test Video</h3>
        </ytd-video-renderer>
      `;

      const element = document.querySelector('ytd-video-renderer');
      service.processingElements.add(element);

      await service.processElement(element, 'video');

      // Should not have added checked attribute
      expect(element.hasAttribute('data-language-filter-checked')).toBe(false);
    });

    it('should skip elements already checked for same language', async () => {
      document.body.innerHTML = `
        <ytd-video-renderer data-language-filter-checked="true" data-language-filter-lang="en">
          <h3 id="video-title">Test Video</h3>
        </ytd-video-renderer>
      `;

      const element = document.querySelector('ytd-video-renderer');
      globalThis.LanguageService.selectedLanguages = ['en'];

      const hideSpy = vi.spyOn(globalThis.DOMService, 'hideElement');

      await service.processElement(element, 'video');

      expect(hideSpy).not.toHaveBeenCalled();
      hideSpy.mockRestore();
    });

    it('should re-process elements when language changes', async () => {
      document.body.innerHTML = `
        <ytd-video-renderer data-language-filter-checked="true" data-language-filter-lang="en">
          <h3 id="video-title">Test Video</h3>
        </ytd-video-renderer>
      `;

      const element = document.querySelector('ytd-video-renderer');
      globalThis.LanguageService.selectedLanguages = ['tr']; // Different language

      await service.processElement(element, 'video');

      expect(element.getAttribute('data-language-filter-lang')).toBe('tr');
    });

    it('should show element when language matches', async () => {
      document.body.innerHTML = `
        <ytd-video-renderer>
          <h3 id="video-title">Hello World This is English Text</h3>
        </ytd-video-renderer>
      `;

      globalThis.LanguageService.setLanguages(['en']);
      const element = document.querySelector('ytd-video-renderer');

      await service.processElement(element, 'video');

      // Should be shown (no display: none)
      expect(element.style.display).toBe('');
    });

    it('should hide element when language does not match', async () => {
      document.body.innerHTML = `
        <ytd-video-renderer>
          <h3 id="video-title">こんにちは世界 日本語テキスト</h3>
        </ytd-video-renderer>
      `;

      globalThis.LanguageService.setLanguages(['en']);
      const element = document.querySelector('ytd-video-renderer');

      await service.processElement(element, 'video');

      // Should be hidden
      expect(element.style.display).toBe('none');
    });

    it('should show element when no text is found', async () => {
      document.body.innerHTML = `
        <ytd-video-renderer>
          <div class="empty"></div>
        </ytd-video-renderer>
      `;

      const element = document.querySelector('ytd-video-renderer');

      await service.processElement(element, 'video');

      // Should be shown (default to show when no text)
      expect(element.style.display).toBe('');
    });

    it('should clear logged texts when limit is reached', async () => {
      service._loggedTexts = new Set();

      // Fill with 500+ items
      for (let i = 0; i < 501; i++) {
        service._loggedTexts.add(`text-${i}`);
      }

      document.body.innerHTML = `
        <ytd-video-renderer>
          <h3 id="video-title">New Text That Should Trigger Cleanup</h3>
        </ytd-video-renderer>
      `;

      const element = document.querySelector('ytd-video-renderer');
      await service.processElement(element, 'video');

      // Set should have been cleared and now have just 1 item
      expect(service._loggedTexts.size).toBeLessThan(501);
    });

    it('should remove element from processing set after completion', async () => {
      document.body.innerHTML = `
        <ytd-video-renderer>
          <h3 id="video-title">Test Video</h3>
        </ytd-video-renderer>
      `;

      const element = document.querySelector('ytd-video-renderer');

      await service.processElement(element, 'video');

      expect(service.processingElements.has(element)).toBe(false);
    });
  });

  describe('processNewNode', () => {
    beforeEach(() => {
      // Mock YT_FILTER_INSTANCE for extension state check
      globalThis.YT_FILTER_INSTANCE = { enabled: true };
    });

    it('should return early if node has no matches method', () => {
      const textNode = document.createTextNode('text');

      // Should not throw
      expect(() => service.processNewNode(textNode, mockSettings)).not.toThrow();
    });

    it('should return early if settings is null', () => {
      document.body.innerHTML = '<ytd-video-renderer>Video</ytd-video-renderer>';
      const node = document.querySelector('ytd-video-renderer');

      expect(() => service.processNewNode(node, null)).not.toThrow();
    });

    it('should skip ad elements', () => {
      document.body.innerHTML = `
        <ytd-ad-slot-renderer>
          <ytd-video-renderer>Ad Video</ytd-video-renderer>
        </ytd-ad-slot-renderer>
      `;

      const adNode = document.querySelector('ytd-ad-slot-renderer');
      const processSpy = vi.spyOn(service, 'processElement');

      service.processNewNode(adNode, mockSettings);

      expect(processSpy).not.toHaveBeenCalled();
      processSpy.mockRestore();
    });

    it('should process video node directly', () => {
      document.body.innerHTML = `
        <ytd-video-renderer>
          <h3 id="video-title">Video Title</h3>
        </ytd-video-renderer>
      `;

      const videoNode = document.querySelector('ytd-video-renderer');
      const processSpy = vi.spyOn(service, 'processElement').mockResolvedValue();

      service.processNewNode(videoNode, mockSettings);

      expect(processSpy).toHaveBeenCalledWith(videoNode, 'video');
      processSpy.mockRestore();
    });

    it('should process channel node directly', () => {
      document.body.innerHTML = `
        <ytd-channel-renderer>
          <div id="channel-name"><a>Channel Name</a></div>
        </ytd-channel-renderer>
      `;

      const channelNode = document.querySelector('ytd-channel-renderer');
      const processSpy = vi.spyOn(service, 'processElement').mockResolvedValue();

      service.processNewNode(channelNode, { ...mockSettings, hideVideos: false });

      expect(processSpy).toHaveBeenCalledWith(channelNode, 'channel');
      processSpy.mockRestore();
    });

    it('should find and process videos inside a container node', () => {
      document.body.innerHTML = `
        <div id="container">
          <ytd-video-renderer>
            <h3 id="video-title">Video 1</h3>
          </ytd-video-renderer>
          <ytd-video-renderer>
            <h3 id="video-title">Video 2</h3>
          </ytd-video-renderer>
        </div>
      `;

      const container = document.getElementById('container');
      const processSpy = vi.spyOn(service, 'processElement').mockResolvedValue();

      service.processNewNode(container, mockSettings);

      expect(processSpy).toHaveBeenCalledTimes(2);
      processSpy.mockRestore();
    });

    it('should not process videos inside ads when scanning container', () => {
      document.body.innerHTML = `
        <div id="container">
          <ytd-video-renderer>Normal Video</ytd-video-renderer>
          <ytd-ad-slot-renderer>
            <ytd-video-renderer>Ad Video</ytd-video-renderer>
          </ytd-ad-slot-renderer>
        </div>
      `;

      const container = document.getElementById('container');
      const processSpy = vi.spyOn(service, 'processElement').mockResolvedValue();

      service.processNewNode(container, mockSettings);

      // Should only process the normal video, not the ad
      expect(processSpy).toHaveBeenCalledTimes(1);
      processSpy.mockRestore();
    });

    it('should respect hideVideos setting', () => {
      document.body.innerHTML = `
        <ytd-video-renderer>
          <h3 id="video-title">Video</h3>
        </ytd-video-renderer>
      `;

      const videoNode = document.querySelector('ytd-video-renderer');
      const processSpy = vi.spyOn(service, 'processElement').mockResolvedValue();

      service.processNewNode(videoNode, { ...mockSettings, hideVideos: false });

      expect(processSpy).not.toHaveBeenCalled();
      processSpy.mockRestore();
    });

    it('should respect hideChannels setting', () => {
      document.body.innerHTML = `
        <ytd-channel-renderer>Channel</ytd-channel-renderer>
      `;

      const channelNode = document.querySelector('ytd-channel-renderer');
      const processSpy = vi.spyOn(service, 'processElement').mockResolvedValue();

      service.processNewNode(channelNode, { ...mockSettings, hideChannels: false });

      expect(processSpy).not.toHaveBeenCalled();
      processSpy.mockRestore();
    });
  });

  describe('filterElementType', () => {
    it('should process all elements of given type', async () => {
      document.body.innerHTML = `
        <ytd-video-renderer><h3 id="video-title">Video 1</h3></ytd-video-renderer>
        <ytd-video-renderer><h3 id="video-title">Video 2</h3></ytd-video-renderer>
        <ytd-video-renderer><h3 id="video-title">Video 3</h3></ytd-video-renderer>
      `;

      await service.filterElementType('video');

      const videos = document.querySelectorAll('ytd-video-renderer');
      videos.forEach(video => {
        expect(video.hasAttribute('data-language-filter-checked')).toBe(true);
      });
    });
  });
});
