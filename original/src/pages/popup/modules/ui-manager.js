export class UIManager {
  constructor() {
    this.container = document.querySelector('.container');
  }

  showLoaded() {
    this.container?.classList.add('loaded');
    this.container?.classList.add('visible');
  }

  showNonYouTubePage() {
    document.body.classList.add('non-yt-body');

    // Clear existing content
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }

    // Build DOM structure
    const container = document.createElement('div');
    container.className = 'non-yt-container';

    // Header
    const header = document.createElement('header');
    header.className = 'non-yt-header';
    const logo = document.createElement('div');
    logo.className = 'non-yt-logo';
    const logoImg = document.createElement('img');
    logoImg.src = chrome.runtime.getURL('icons/icon48.png');
    logoImg.alt = 'YuLaF';
    const logoText = document.createElement('span');
    logoText.className = 'non-yt-logo-text';
    logoText.textContent = 'YuLaF - YouTube Language Filter';
    logo.append(logoImg, logoText);
    header.appendChild(logo);

    // Content
    const content = document.createElement('div');
    content.className = 'non-yt-content';

    const icon = document.createElement('div');
    icon.className = 'non-yt-icon';
    icon.textContent = '\u{1F3AF}';

    const title = document.createElement('h2');
    title.className = 'non-yt-title';
    title.textContent = 'YuLaF is Ready!';

    const text = document.createElement('p');
    text.className = 'non-yt-text';
    text.append('Please visit ');
    const strong = document.createElement('strong');
    strong.textContent = 'YouTube';
    text.append(strong, ' to start filtering videos by language.');

    const goBtn = document.createElement('button');
    goBtn.id = 'goToYouTubeBtn';
    goBtn.className = 'non-yt-btn';
    goBtn.textContent = 'Go to YouTube';

    content.append(icon, title, text, goBtn);

    // Footer
    const footer = document.createElement('footer');
    footer.className = 'non-yt-footer';

    const guideBtn = this._createFooterButton('guideBtn', 'guide-btn', 'Guide', [
      { tag: 'path', attrs: { d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20' } },
      {
        tag: 'path',
        attrs: { d: 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' },
      },
    ]);

    const settingsBtn = this._createFooterButton('settingsBtn', 'settings-btn', 'Settings', [
      { tag: 'circle', attrs: { cx: '12', cy: '12', r: '3' } },
      {
        tag: 'path',
        attrs: {
          d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z',
        },
      },
    ]);

    footer.append(guideBtn, settingsBtn);
    container.append(header, content, footer);
    document.body.appendChild(container);
  }

  _createFooterButton(id, extraClass, label, svgPaths) {
    const btn = document.createElement('button');
    btn.id = id;
    btn.className = `non-yt-footer-btn ${extraClass}`;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    for (const { tag, attrs } of svgPaths) {
      const el = document.createElementNS(svgNS, tag);
      for (const [key, val] of Object.entries(attrs)) {
        el.setAttribute(key, val);
      }
      svg.appendChild(el);
    }

    const span = document.createElement('span');
    span.textContent = label;
    btn.append(svg, span);
    return btn;
  }

  setupNonYouTubeEventListeners() {
    const C = window.YT_FILTER_CONSTANTS || {};
    setTimeout(() => {
      const openTab = url =>
        chrome.tabs
          .create({ url })
          .then(() => window.close())
          .catch(err => console.warn('[YuLaF] Failed to open tab:', err.message || err));

      // Go to YouTube button
      document.getElementById('goToYouTubeBtn')?.addEventListener('click', () => {
        openTab(C.URLS?.YOUTUBE || 'https://www.youtube.com');
      });

      // Guide button
      document.getElementById('guideBtn')?.addEventListener('click', () => {
        openTab(chrome.runtime.getURL(C.PAGES?.WELCOME || 'src/pages/welcome/index.html'));
      });

      // Settings button
      document.getElementById('settingsBtn')?.addEventListener('click', () => {
        openTab(chrome.runtime.getURL(C.PAGES?.ADVANCED || 'src/pages/advanced/index.html'));
      });
    }, 100);
  }
}
