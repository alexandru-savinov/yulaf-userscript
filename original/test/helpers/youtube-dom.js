/**
 * YouTube DOM builder helpers for integration tests.
 * Creates realistic YouTube element structures matching the selectors in config.js.
 */

/**
 * Create a video element (ytd-video-renderer) with title and optional description.
 * @param {Object} opts
 * @param {string} opts.title - Video title text
 * @param {string} [opts.description] - Optional description text
 * @returns {HTMLElement}
 */
export function createVideoElement({ title, description }) {
  const renderer = document.createElement('ytd-video-renderer');
  const h3 = document.createElement('h3');
  const titleEl = document.createElement('a');
  titleEl.id = 'video-title';
  titleEl.textContent = title;
  titleEl.setAttribute('title', title);
  titleEl.setAttribute('href', '/watch?v=test');
  h3.appendChild(titleEl);
  renderer.appendChild(h3);

  if (description) {
    const descDiv = document.createElement('div');
    descDiv.className = 'metadata-snippet-container';
    descDiv.textContent = description;
    renderer.appendChild(descDiv);
  }

  return renderer;
}

/**
 * Create a compact video element (sidebar recommendations).
 * @param {Object} opts
 * @param {string} opts.title - Video title text
 * @returns {HTMLElement}
 */
export function createCompactVideoElement({ title }) {
  const renderer = document.createElement('ytd-compact-video-renderer');
  const h3 = document.createElement('h3');
  const titleEl = document.createElement('a');
  titleEl.id = 'video-title';
  titleEl.textContent = title;
  titleEl.setAttribute('href', '/watch?v=test');
  h3.appendChild(titleEl);
  renderer.appendChild(h3);
  return renderer;
}

/**
 * Create a channel element (ytd-channel-renderer).
 * @param {Object} opts
 * @param {string} opts.name - Channel name
 * @returns {HTMLElement}
 */
export function createChannelElement({ name }) {
  const renderer = document.createElement('ytd-channel-renderer');
  const channelName = document.createElement('div');
  channelName.id = 'channel-name';
  const link = document.createElement('a');
  link.textContent = name;
  link.setAttribute('href', '/channel/test');
  channelName.appendChild(link);
  renderer.appendChild(channelName);
  return renderer;
}

/**
 * Create an ad-wrapped video element (should be skipped by filter).
 * @param {Object} opts
 * @param {string} opts.title - Ad video title
 * @returns {HTMLElement}
 */
export function createAdElement({ title }) {
  const ad = document.createElement('ytd-ad-slot-renderer');
  const video = createVideoElement({ title });
  ad.appendChild(video);
  return ad;
}

/**
 * Build a YouTube-like page with multiple elements.
 * @param {Array<Object>} items - Array of { type, title, description, name }
 *   type: 'video' | 'compact-video' | 'channel' | 'ad'
 * @returns {HTMLElement[]} Array of created top-level elements
 */
export function buildYouTubePage(items) {
  const elements = [];
  for (const item of items) {
    let el;
    switch (item.type) {
      case 'video':
        el = createVideoElement({ title: item.title, description: item.description });
        break;
      case 'compact-video':
        el = createCompactVideoElement({ title: item.title });
        break;
      case 'channel':
        el = createChannelElement({ name: item.name || item.title });
        break;
      case 'ad':
        el = createAdElement({ title: item.title });
        break;
      default:
        throw new Error(`Unknown item type: ${item.type}`);
    }
    document.body.appendChild(el);
    elements.push(el);
  }
  return elements;
}
