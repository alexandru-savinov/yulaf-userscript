Port the YuLaF Chrome extension to a single Safari userscript (yulaf.user.js) compatible with the Userscripts app on iOS/iPadOS/macOS.

## Context

Architectural background, design decisions, and source-file mapping live in `PLAN.md` — read it first.

The Chrome extension source is archived under `original/`. Key files:
- `original/src/common/constants.js` — config constants, language list
- `original/src/common/config.js` — DOM selectors, language metadata
- `original/src/content/services/language-detector.js` — character-set regex validators
- `original/src/content/services/language-service.js` — caching layer
- `original/src/content/services/dom-service.js` — extractText, hide/show
- `original/src/content/services/filter-service.js` — orchestration
- `original/src/content/index.js` — main controller + MutationObserver

The Userscripts app (Safari) supports the standard `GM_*` API (`GM_getValue`, `GM_setValue`, `GM_addStyle`). It does NOT support `chrome.*` APIs, background workers, popup pages, or `chrome.i18n.detectLanguage()`.

Output: a single `yulaf.user.js` at the repo root, plus unit tests under `test/`, and Playwright e2e tests under `e2e/`.

## Feedback loop (set up in Task 1, used by every subsequent task)

Every task MUST end by running `npm run check` and confirming it passes before committing. The check script chains:

1. `node --check yulaf.user.js` — syntax parse
2. `npx eslint yulaf.user.js` — lint
3. `npx vitest run` — unit tests (jsdom env)
4. `npx playwright test --project=fixtures` — e2e tests against local YouTube DOM fixtures (fast, deterministic)

A separate `npm run e2e:live` runs `--project=live` against the real `youtube.com` — slower, network-dependent, NOT part of `npm run check`. The agent SHOULD run it at least once at the end of Task 5 and Task 7 to validate against real YouTube markup.

This is the agent's primary feedback loop. If any stage fails, fix the underlying issue — do not weaken the check.

Additionally, when porting tricky logic (regex detection, filter orchestration), write the unit test first, watch it fail, then port the implementation until it passes.

## Tasks

### Task 1: Bootstrap userscript + feedback loop tooling
- [x] Create `yulaf.user.js` at repo root with a complete userscript metadata block (`@name`, `@namespace`, `@version 0.1.0`, `@description`, `@author`, `@match https://*.youtube.com/*`, `@match https://m.youtube.com/*`, `@grant GM_getValue`, `@grant GM_setValue`, `@grant GM_addStyle`, `@run-at document-start`)
- [x] Wrap the script body in an IIFE; add a `DEBUG` flag and `log()` helper prefixing `[YuLaF]`
- [x] Add a build-time export shim: when `typeof module !== 'undefined' && module.exports`, expose internals (`DOMService`, `LanguageDetector`, `LanguageService`, `FilterService`, `Controller`, `Config`, `Constants`) on `module.exports` so vitest can require them. The shim must be a no-op in the real userscript runtime.
- [x] `npm init -y`, then add devDependencies: `vitest`, `jsdom`, `@playwright/test`, `eslint`
- [x] Run `npx playwright install chromium` once during setup so e2e tests can launch the browser
- [x] `eslint.config.js` — minimal flat config: ESM, browser globals + `GM_*` globals declared, `no-unused-vars` warn, `no-undef` error
- [x] `vitest.config.js` — `environment: 'jsdom'`, `include: ['test/**/*.test.js']`
- [x] `playwright.config.js` — declare two projects:
  - `fixtures` — runs `e2e/fixtures/**/*.spec.js` against local `file://` HTML, headless Chromium, fast, deterministic. Part of `npm run check`.
  - `live` — runs `e2e/live/**/*.spec.js` against `https://www.youtube.com`, headless Chromium, longer timeouts, retries. Excluded from `npm run check`; run via `npm run e2e:live`.
- [x] `e2e/_helpers/inject.js` — shared helper that, given a Playwright `page`:
  1. Stubs `GM_getValue` / `GM_setValue` / `GM_addStyle` on the page via `addInitScript`, backed by an in-memory map exposed for the test to seed
  2. Injects `yulaf.user.js` source via `addInitScript` (read from disk, wrap in IIFE)
  3. Returns a handle for the test to inspect (e.g. read/write GM storage from the test side)
- [x] `e2e/fixtures/youtube-home.html` — a static HTML page containing a handful of fake `ytd-rich-item-renderer` / `ytd-video-renderer` elements with mixed-language `#video-title` text (English, Russian, Japanese, Turkish — at least 2 of each). Match the real YouTube selectors closely enough that `original/src/common/config.js` selectors find them.
- [x] `e2e/fixtures/home.spec.js` — Playwright test that loads the fixture, injects the userscript, waits for `data-yulaf-processed`, and asserts the (initially trivial) wiring round-trip works. Real filter assertions land in Task 5.
- [x] `e2e/live/home.spec.js` — Playwright test that navigates to `https://www.youtube.com`, dismisses the cookie banner if present, injects the userscript, waits for at least one `ytd-rich-item-renderer` to render, and asserts the script loaded without throwing. Tagged `@live`. Skipped in `check` via the project filter.
- [x] `package.json` scripts:
  - `"check": "node --check yulaf.user.js && eslint yulaf.user.js && vitest run && playwright test --project=fixtures"`
  - `"test": "vitest run"`
  - `"e2e": "playwright test --project=fixtures"`
  - `"e2e:live": "playwright test --project=live"`
- [x] Add `.gitignore` entries: `node_modules/`, `playwright-report/`, `test-results/`
- [x] At end of task: stub the userscript body with a no-op controller that just sets `data-yulaf-processed` on every matching element so e2e tests have something to verify wiring against. Real filtering comes in later tasks.
- [x] `npm run check` passes
- [x] Commit

### Task 2: Port constants, config, and DOM service
- [x] Port the constants from `original/src/common/constants.js` inline (language list, debounce values, default selected languages)
- [x] Port the config from `original/src/common/config.js` inline (DOM selectors, language metadata: code, name, native name, flag/icon)
- [x] Port `original/src/content/services/dom-service.js` as a `DOMService` object inside `yulaf.user.js` (extractText, hideElement, showElement, getAllElements, isHidden)
- [x] Wire all ported modules into the `module.exports` shim from Task 1
- [x] `test/dom-service.test.js` — covers extractText (returns trimmed text from the title selector), hideElement / showElement / isHidden round-trip, getAllElements returns the expected count from a fixture DOM
- [x] `npm run check` passes
- [x] Commit

### Task 3: Port character-set detector and caching language service
- [x] Port `original/src/content/services/language-detector.js` character-set regex validators (CJK, Cyrillic, Arabic, Devanagari, Hebrew, Thai, etc.) and exclusion patterns. Keep the regex behaviour byte-identical where reasonable.
- [x] Port `original/src/content/services/language-service.js` caching layer (Map with size cap; LRU not strictly required but document the eviction strategy in a one-line comment)
- [x] `test/language-detector.test.js` — at least one positive and one negative title per script family ported. Edge cases: empty string, whitespace-only, mixed-script titles.
- [x] `test/language-service.test.js` — cache hit returns identical reference, cache eviction at size cap, cache key normalisation
- [x] `npm run check` passes
- [x] Commit

### Task 4: Add trigram detector for Latin-alphabet languages
- [x] Add `franc-min` as a **dev-only dependency**: `npm install --save-dev franc-min trigrams`. These are NOT used at runtime — the userscript stays single-file and dependency-free.
- [x] Create `tools/build-trigrams.mjs` that:
  1. Imports `franc-min`'s trigram data (`franc-min/data.json` or equivalent — read it from `node_modules/`)
  2. Subsets to `[en, es, fr, de, tr, pt, it, nl]`
  3. Writes the result to `tools/trigrams.generated.json` (checked in)
  4. Prints a JS literal (`const TRIGRAM_TABLES = {...};`) suitable for pasting between marker comments in `yulaf.user.js`
- [x] DO NOT generate corpus text or write language sample files yourself. Vendor the prebuilt trigram statistics from `franc-min` only. Add a one-line attribution comment in `yulaf.user.js` next to the embedded tables: `// Trigram data derived from franc-min (MIT, https://github.com/wooorm/franc)`.
- [x] Embed the generated table inline in `yulaf.user.js` between `// ── BEGIN trigram-tables ──` / `// ── END trigram-tables ──` marker comments so the build script can re-write it idempotently.
- [x] Implement `detectLatinLanguage(text)` returning `{lang, confidence}` using cosine similarity over normalised trigram vectors. Reference: franc's algorithm (do not require franc at runtime — reimplement the math in plain JS, ~30 lines). [Implemented as `TrigramDetector.detect` using franc's rank-distance metric — yields stronger separation on short titles than cosine over count vectors.]
- [x] Wire into the language service: character-set detection runs first; trigram detection only for pure-Latin text. Confidence below a tunable threshold → return `null` and do NOT hide the video.
- [x] `test/trigram-detector.test.js` — for each supported language, write 2–3 short test titles in that language and assert correct detection. Also test: `null` for empty/whitespace, `null` for very short input (<10 chars), `null` for low-confidence ambiguous input. Keep test fixtures short and topically neutral (greetings, weather, food, simple descriptions).
- [x] `npm run check` passes
- [x] Commit
- [x] **Note**: previous attempts at this task tripped Anthropic content-filter false-positives when generating long multilingual corpus text inline. Vendoring `franc-min`'s prebuilt data avoids that entirely. Do not regenerate corpora; do not paste long blocks of non-English text into your assistant output.

### Task 5: Port filter service and main controller
- [x] Port `original/src/content/services/filter-service.js` as a `FilterService` (processElement, filterContent, processNewNode, shouldHide)
- [x] Port `original/src/content/index.js` main controller: MutationObserver setup, `history.pushState` / `replaceState` patching, URL-change detection, debounced re-filter
- [x] Hardcode `selectedLanguages: ['en']` for now — user-configurable storage lands in Task 6
- [x] Expose `window.YuLaF = { filter, config, version }` for in-page debugging
- [x] `test/filter-service.test.js` — hides when language not in allowlist, shows when language IS in allowlist, idempotent on already-processed elements, MutationObserver picks up newly-added nodes
- [x] Extend `e2e/fixtures/home.spec.js`: assert English items stay visible and non-English items end up hidden (display:none or `aria-hidden`, whichever the port chose) on the fixture page
- [x] Add `e2e/fixtures/dynamic-load.spec.js` — fixture starts empty, JS injects new video items 500ms later, assert the MutationObserver picks them up and filters correctly
- [x] Run `npm run e2e:live` once and confirm the script loads on real youtube.com without errors. If selectors need tweaking for the live site, do that here.
- [x] `npm run check` passes — this is the first task where e2e tests exercise real filter behaviour end-to-end
- [x] Commit

### Task 6: Inject settings UI + persistence
- [x] Floating toggle button anchored bottom-right, z-index above YouTube chrome but below modals. Min 44×44 px touch target. Visual ON/OFF state.
- [x] Tap toggle → expand settings panel: language picker grid (flag + name, multi-select), strict-mode toggle, "show all" / "hide all" shortcuts. Tap outside or swipe-down to dismiss.
- [x] Persist via `GM_getValue` / `GM_setValue`: `selectedLanguages` (array of codes), `enabled` (bool), `strictMode` (bool). Load on startup, save on every change.
- [x] Inject styles via `GM_addStyle`, scoped under a `.yulaf-` class prefix
- [x] Replace the Task-5 hardcoded `['en']` with the loaded value
- [x] `test/settings.test.js` — defaults when storage empty, round-trip save/load, change events trigger re-filter
- [x] `e2e/fixtures/settings.spec.js` — flip `selectedLanguages` to `['ru']` via the GM_setValue stub, reload, assert the inverse hide pattern; also exercise the toggle button (click → script disables, items show)
- [x] `npm run check` passes
- [x] Commit

### Task 7: Polish + installation docs
- [ ] Replace bare `display:none` with CSS transitions (opacity + max-height) — less jarring
- [ ] Verify behaviour against the YouTube mobile layout (`m.youtube.com`) — extend selectors if needed
- [ ] Add `e2e/fixtures/youtube-mobile.html` plus `e2e/fixtures/mobile.spec.js` covering the mobile selectors
- [ ] Add an `e2e/live/mobile.spec.js` that navigates to `https://m.youtube.com` with a mobile user-agent and confirms the script loads
- [ ] Run `npm run e2e:live` once and confirm both desktop and mobile live tests pass
- [ ] Write `README.md`: what it does, install steps for macOS Safari + Userscripts app, install steps for iOS/iPadOS, debugging via Web Inspector, known limitations, link to the original Chrome extension
- [ ] Bump `@version` in the metadata block to `1.0.0`
- [ ] `npm run check` passes
- [ ] Commit

## Constraints

- The deliverable MUST be a single, directly-installable `yulaf.user.js`. No runtime build step, no external script imports at runtime.
- Use ONLY userscript-supported APIs. No `chrome.*`, no `browser.*`, no service workers, no popup pages.
- All language data (regex tables, trigrams) must be embedded inline in the userscript.
- Touch targets in the injected UI must be at least 44×44 px (iOS HIG).
- Do NOT modify anything under `original/` — it is the archived reference source.
- Do NOT add a bundler (webpack/vite/rollup) for the userscript itself. The `tools/build-trigrams.mjs` dev-time helper is allowed; its output must be checked in.
- Unit tests must run via `npm test`; fixture e2e tests via `npm run e2e`; live e2e tests via `npm run e2e:live`. The live suite is NOT part of `npm run check` — keep it that way (it's network-dependent and brittle).
- Use headless Chromium via Playwright. Do not require a real Safari browser in the test pipeline. Real-Safari verification is the human's job at install time.
- The `npm run check` pipeline is the contract. Do not weaken it (e.g. `|| true`, skipping stages, deleting failing tests). If a stage fails, fix the root cause.
- Commit after each task. Do not squash across tasks.
- Keep the userscript readable: section-boundary comments only (`// ── DOMService ──`), not line-by-line narration.
