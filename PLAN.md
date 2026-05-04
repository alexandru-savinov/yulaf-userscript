# YuLaF Userscript — YouTube Language Filter for Safari (iOS/Mac)

Port of the [YuLaF Chrome extension](https://github.com/vakkaskarakurt/YuLaF-YouTube-Language-Filter) to a single userscript compatible with the [Userscripts app](https://apps.apple.com/app/userscripts/id1463298887) for Safari on iPhone, iPad, and Mac.

## Source Material

Original extension unpacked at `/tmp/yulaf-ext/unpacked/` (also archived in `original/`).

Key files from the extension:
- `src/common/constants.js` — config constants, language list, selectors
- `src/common/config.js` — DOM selectors, language metadata (names, icons)
- `src/content/services/language-detector.js` — character-set regex validators, exclusion patterns
- `src/content/services/language-service.js` — caching layer around detector
- `src/content/services/dom-service.js` — extract text, hide/show elements
- `src/content/services/filter-service.js` — orchestrates filtering of video/channel elements
- `src/content/index.js` — main controller, MutationObserver, history patching

## Architecture

### What changes from the Chrome extension

| Chrome extension | Userscript |
|-----------------|------------|
| `chrome.i18n.detectLanguage()` | Character-set regex detection only (no API available) |
| `chrome.storage.sync` | `GM_getValue` / `GM_setValue` |
| Background service worker (badge, stats) | Dropped entirely |
| Popup HTML page for settings | Injected settings panel on YouTube page |
| `chrome.commands` keyboard shortcut | Dropped (no iOS keyboard shortcuts) |
| 7 separate files | Single `.user.js` file |
| `chrome.runtime.onMessage` | Direct function calls (single script) |

### Language detection strategy

The Chrome extension uses `chrome.i18n.detectLanguage()` which is NOT available in userscripts. Replacement approach:

1. **Character-set detection** (already exists in the extension) — regex validators for non-Latin scripts (CJK, Cyrillic, Arabic, Devanagari, etc.). This is reliable for languages with unique scripts.

2. **Trigram/n-gram detection** for Latin-alphabet languages (English, Spanish, French, German, Turkish, etc.) — build a lightweight trigram frequency table per language. ~2KB per language, good accuracy on titles (short text).

3. **Fallback**: if detection confidence is low, show the video (don't hide uncertain content).

### UI — Injected Settings Panel

Since there's no popup page, inject a floating toggle + settings panel into YouTube:

- **Toggle button**: small floating button (bottom-right corner) showing ON/OFF state
- **Settings panel** (tap toggle to expand): language picker grid, strict mode toggle
- **Persistence**: `GM_getValue`/`GM_setValue` for selected languages + enabled state
- **Mobile-friendly**: touch targets >= 44px, swipe to dismiss

## Build Plan

### Phase 1 — Minimal viable userscript
1. Create `yulaf.user.js` with metadata block
2. Port constants + config (inline, no separate files)
3. Port DOM service (extractText, hideElement, showElement, getAllElements)
4. Port character-set language detector (regex validators)
5. Add basic trigram detector for Latin languages
6. Port filter service (processElement, filterContent, processNewNode)
7. Port main controller (MutationObserver, history patching, URL change detection)
8. Hardcode `selectedLanguages: ['en']` for initial testing
9. **Test on Mac Safari** with Userscripts app

### Phase 2 — Settings UI
1. Inject toggle button into YouTube page
2. Build settings panel (language grid with flags/icons)
3. Wire up `GM_getValue`/`GM_setValue` for persistence
4. Add strict mode toggle
5. **Test settings persistence across page loads**

### Phase 3 — Polish
1. Handle YouTube mobile layout differences (if needed for iOS Safari)
2. Add CSS transitions for hide/show (less jarring than display:none)
3. Test on iOS Simulator
4. Test on real iPhone/iPad

## Testing (on Mac)

### Setup
1. Install [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) from Mac App Store
2. Safari → Settings → Extensions → enable Userscripts
3. Open Userscripts → set script directory to this repo folder
4. Navigate to youtube.com

### Debug
- Safari → Develop → Web Inspector
- Console will show `[YuLaF]` prefixed log messages
- `window.YuLaF` exposes the filter instance for manual testing

### iOS Simulator
1. Open Xcode → Xcode menu → Open Developer Tool → Simulator
2. Choose an iPhone/iPad device
3. Install Userscripts from the simulated App Store
4. Safari → Develop → Simulator → inspect the page

## File Structure

```
yulaf-userscript/
  PLAN.md              — this file
  yulaf.user.js        — the userscript (single file, all logic)
  original/            — archived copy of the Chrome extension source
  trigrams/            — language trigram data (generated, used during build)
```
