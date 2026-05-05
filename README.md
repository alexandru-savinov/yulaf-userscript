# YuLaF — YouTube Language Filter (Safari userscript)

Hide YouTube videos whose titles aren't in your selected languages. Single-file
Safari/Userscripts port of the original
[YuLaF Chrome extension](https://github.com/vakkaskarakurt/YuLaF-YouTube-Language-Filter).

Works on:

- `https://www.youtube.com/` (desktop / iPad)
- `https://m.youtube.com/` (mobile web)

## Tested in

Validated under headless Chromium and WebKit (Safari engine) across home, search, subscriptions, watch sidebar, channel, shorts, mobile, and edge-case (emoji / RTL / mixed-script / very-long / digits-only / URL-only) fixtures, plus a live smoke test against real `youtube.com` (Chromium). WebKit is the closest practical proxy for real Safari available headlessly; real iOS / iPadOS / macOS Safari + Userscripts.app verification is the user's responsibility.

## What it does

- Detects the language of each video title using a two-stage pipeline:
  1. Character-set regexes (CJK, Cyrillic, Arabic, Devanagari, Hebrew, Thai, …).
  2. Trigram statistics (vendored from
     [`franc-min`](https://github.com/wooorm/franc), MIT) for Latin-script
     languages — English, Spanish, French, German, Turkish, Portuguese,
     Italian, Dutch.
- Hides any video whose detected language isn't in your allow-list. Items below
  the confidence threshold default to **show** (so you don't lose anything).
- Floating bottom-right toggle gives you instant on/off plus a settings panel
  for language selection, strict mode, and show-all / hide-all shortcuts.
- All preferences persist via the Userscripts app (`GM_getValue` /
  `GM_setValue`).

## Install

The script lives at one canonical URL once this branch is merged to `main`:

> **Raw script:** <https://raw.githubusercontent.com/alexandru-savinov/yulaf-userscript/main/yulaf.user.js>

Opening that link in Safari with the Userscripts app installed prompts you
to install it directly — that is the fastest path on all three platforms.
The step-by-step instructions below cover the manual flow if the
auto-install prompt doesn't appear, and also walk you through the one-time
Userscripts app setup.

### macOS (Safari)

1. Install the
   [Userscripts app](https://apps.apple.com/app/userscripts/id1463298887)
   from the Mac App Store (free).
2. Open Safari → **Settings → Extensions** → enable **Userscripts**.
3. Click the Userscripts toolbar button → **Open Extension Preferences** →
   set a **Save Location** (an empty folder is best — the app manages its
   contents).
4. **Easiest:** open the [raw script URL](#install) above in Safari. The
   Userscripts editor opens with the script pre-loaded → click **Save**.
   *Or, manually:* Userscripts toolbar icon → **Open Editor** → **+** →
   **New JS** → paste the contents of [`yulaf.user.js`](./yulaf.user.js) →
   **Save**.
5. Visit `https://www.youtube.com/`. A small red **Y** toggle appears
   bottom-right.

### iPhone (iOS Safari)

1. Install **Userscripts** from the App Store
   ([same app](https://apps.apple.com/app/userscripts/id1463298887)).
2. Open the **Settings** app → **Safari → Extensions → Userscripts**:
   enable it, then set permission to **Allow** for `youtube.com` and
   `m.youtube.com` (or **All Websites** if you prefer).
3. Open the **Userscripts** app once. It asks you to choose a save
   directory in Files — create one (e.g. `Files → On My iPhone →
   Userscripts`) and select it.
4. **Easiest:** in Safari, navigate to the
   [raw script URL](#install) above. Userscripts detects the `.user.js`
   suffix and offers to install — confirm.
   *Or, manually:* download the file into the Userscripts folder via
   share-sheet, iCloud Drive, or AirDrop from your Mac.
5. Open `https://m.youtube.com/`. Tap the **AA** button in the address
   bar → **Manage Extensions** → confirm Userscripts is enabled for this
   site. Reload — the floating **Y** toggle appears bottom-right.
6. Tap the **Y** to open the language picker.

### iPad (iPadOS Safari)

The flow is identical to iPhone above; iPad-specific notes:

- iPad Safari defaults to the **desktop** YouTube layout
  (`https://www.youtube.com/`). The userscript handles both desktop and
  mobile (`https://m.youtube.com/`) layouts.
- If you have a Magic Keyboard or trackpad attached, the toggle also
  responds to right-click / two-finger tap for instant on/off without
  opening the panel — same as macOS.

Steps:

1. Install **Userscripts** from the App Store.
2. **Settings → Safari → Extensions → Userscripts**: enable, then **Allow**
   on `youtube.com` (and `m.youtube.com` if you use the mobile layout).
3. Open the **Userscripts** app and pick a save folder in Files
   (`Files → On My iPad → Userscripts` works well).
4. **Easiest:** open the [raw script URL](#install) in Safari and let
   Userscripts install it.
   *Or, manually:* save `yulaf.user.js` into the chosen folder (Files
   drag-and-drop, iCloud Drive, AirDrop from your Mac).
5. Reload `https://www.youtube.com/`. The floating **Y** appears
   bottom-right.

## Configuring

Tap the floating "Y" button to open the panel:

- **Filter enabled** — master on/off switch (long-press / right-click the
  button toggles this without opening the panel).
- **Strict mode** — when on, mixed-script titles must be ≥ 50 %
  target-language to count as a match. When off, any target-language
  characters count.
- **Languages** — multi-select grid of supported languages. Tap to toggle.
- **Show all / Hide all** — quick selection helpers.

## Debugging

- Desktop Safari: enable the Develop menu (Settings → Advanced → "Show
  Develop menu in menu bar") → Develop → Show Web Inspector → Console.
  `window.YuLaF` exposes `version`, `Config`, `filter` (the controller),
  `settings`, and `ui`.
- iOS: connect the device to a Mac via USB, then Safari (Mac) → Develop → your
  device → the YouTube tab.
- Set `DEBUG = true` near the top of `yulaf.user.js` for `[YuLaF]` console
  logging.

## Known limitations

- Detection is title-only. We don't peek at audio tracks or video descriptions.
- Trigram statistics are short-text-tuned but ambiguous titles (1–2 common
  words, brand names, emoji-only) intentionally default to **show**.
- YouTube's DOM changes regularly. Selectors live in
  `Config.selectors` near the top of `yulaf.user.js`; PRs welcome.
- The Userscripts app does not implement `GM_xmlhttpRequest`, so we don't make
  any network calls. All language data is embedded inline.

## Development

The project is a single file (`yulaf.user.js`) plus tests:

```bash
npm install
npx playwright install chromium    # one-time
npm run check                      # lint + unit + fixture e2e
npm run e2e:live                   # live YouTube e2e (network-dependent)
```

The build of inline trigram tables is done via:

```bash
node tools/build-trigrams.mjs
```

The output is checked in; you only need to re-run it if you add new languages.

## Credits

- Original Chrome extension by
  [vakkaskarakurt](https://github.com/vakkaskarakurt) — archived under
  [`original/`](./original).
- Trigram statistics derived from [`franc-min`](https://github.com/wooorm/franc)
  (MIT).
