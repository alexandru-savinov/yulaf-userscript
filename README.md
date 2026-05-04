# YuLaF — YouTube Language Filter (Safari userscript)

Hide YouTube videos whose titles aren't in your selected languages. Single-file
Safari/Userscripts port of the original
[YuLaF Chrome extension](https://github.com/vakkaskarakurt/YuLaF-YouTube-Language-Filter).

Works on:

- `https://www.youtube.com/` (desktop / iPad)
- `https://m.youtube.com/` (mobile web)

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

## Install — macOS Safari

1. Install the
   [Userscripts app](https://apps.apple.com/app/userscripts/id1463298887)
   from the Mac App Store.
2. Open Safari → Settings → Extensions → enable **Userscripts**.
3. In the Userscripts app set a save directory (any folder you like) and turn
   on the toolbar icon for `youtube.com` and `m.youtube.com`.
4. Click the Userscripts toolbar icon → "Open editor" → "+" → "New JS".
5. Paste the contents of [`yulaf.user.js`](./yulaf.user.js) and save.
6. Reload `https://www.youtube.com/`. You should see the small red "Y" floating
   bottom-right.

You can alternatively click the raw `yulaf.user.js` link from your forked
repository and Userscripts will offer to install it.

## Install — iOS / iPadOS

1. Install **Userscripts** from the App Store (same name, same publisher as
   above).
2. Settings → Safari → Extensions → enable **Userscripts**, then grant it
   "Allow on Every Website" (or scope to youtube.com / m.youtube.com).
3. In Files, create a folder for userscripts. Open Userscripts and point it at
   that folder.
4. Save `yulaf.user.js` into that folder (e.g. share-sheet from a download in
   Safari, or drop in via iCloud Drive).
5. Open Safari → tap the **A**ᴬ button in the address bar → Userscripts →
   confirm `yulaf.user.js` is enabled for the site.
6. Reload the page. The floating toggle appears bottom-right; tap it to open
   the language picker.

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
