Expand e2e coverage for the YuLaF userscript: add Safari/WebKit engine testing, cover more YouTube surfaces, exercise edge cases, add a performance benchmark, then triage and fix anything that breaks.

## Context

Phase 1 (`ralphex-plan.md`) shipped the working userscript: 1300+ lines of `yulaf.user.js`, ~120 unit tests, ~10 fixture e2e tests against headless Chromium, plus a single live test. The script is intended for **Safari** (iOS/iPadOS/macOS via the Userscripts app) but to date has only been tested in headless Chromium. The fixture surface is also narrow — only the YouTube home feed.

This phase tightens that gap by:
1. Running all fixture e2e tests in WebKit (Safari's engine) in addition to Chromium — the closest practical proxy for real Safari behaviour available headlessly.
2. Adding fixtures for additional YouTube surfaces: search results, subscriptions, watch-page sidebar, channel page, shorts feed.
3. Adding edge-case fixtures: mixed-script titles, RTL text, emoji-heavy titles, very long titles, empty titles, single-character titles.
4. Adding a performance smoke test: 1000-item synthetic feed, assert filter completes under a reasonable wall-clock budget.
5. Adding a real-Safari-engine live test: navigate to youtube.com under WebKit, smoke-check the script loads.
6. A dedicated triage-and-fix task at the end.

The repo already has a `package.json`, `playwright.config.js`, `e2e/_helpers/inject.js`, and a green `npm run check` pipeline. Build on those rather than rewriting them.

## Feedback loop

Same as Phase 1. Every task ends with `npm run check` green before committing.

After this phase, `npm run check` should chain:
1. `node --check yulaf.user.js`
2. `eslint yulaf.user.js`
3. `vitest run`
4. `playwright test --project=fixtures-chromium`
5. `playwright test --project=fixtures-webkit`

Live tests stay opt-in via `npm run e2e:live` (now also includes a webkit live project).

## Tasks

### Task 1: Add WebKit (Safari engine) project to Playwright
- [x] Install the WebKit browser binary: `npx playwright install webkit`
- [x] Update `playwright.config.js`: replace the single `fixtures` project with two — `fixtures-chromium` (existing config, renamed) and `fixtures-webkit` (same `testDir`, `use: { browserName: 'webkit' }`). Both must run from `npm run check`.
- [x] Update `playwright.config.js`: add a `live-webkit` project mirroring `live` but using WebKit. Excluded from `npm run check`; runs via `npm run e2e:live`.
- [x] Update `package.json` scripts:
  - `"check"` ends with `playwright test --project=fixtures-chromium --project=fixtures-webkit`
  - `"e2e"` runs both fixture projects
  - `"e2e:live"` runs `live` and `live-webkit`
- [x] Run `npm run check` and triage any WebKit-only failures. Common culprits: WebKit's stricter CSP on `file://`, different `MutationObserver` timing, slightly different `:has()` / `:is()` selector support. Fix in `yulaf.user.js` or in the fixture HTML, not by weakening the test. (No WebKit-only failures — all 20 tests passed across both engines.)
- [x] If a WebKit failure reveals a real Safari bug (e.g. an API used that Safari doesn't support), fix the userscript code; add a regression test. (N/A — no WebKit-only failures observed.)
- [x] Commit. Title: `test: run fixture e2e tests against WebKit in addition to Chromium`.

### Task 2: Add fixtures for additional YouTube surfaces
- [ ] `e2e/fixtures/youtube-search.html` — fake search-results page. Top section: `ytd-video-renderer` (long-form, side-by-side layout, larger thumbnail). Middle: `ytd-shelf-renderer` containing `ytd-video-renderer` siblings. Bottom: `ytd-channel-renderer` with channel metadata. Mix English + Russian + Japanese + Turkish video titles (≥ 2 of each).
- [ ] `e2e/fixtures/youtube-subscriptions.html` — fake subscriptions page using `ytd-rich-grid-renderer` → `ytd-rich-item-renderer` with mixed-language titles.
- [ ] `e2e/fixtures/youtube-watch.html` — fake watch page. Sidebar: `ytd-watch-next-secondary-results-renderer` containing `ytd-compact-video-renderer` siblings (this is a different selector path than the home feed). Mixed languages.
- [ ] `e2e/fixtures/youtube-channel.html` — fake channel page with `ytd-grid-video-renderer` items in a `ytd-grid-renderer`.
- [ ] `e2e/fixtures/youtube-shorts.html` — fake shorts feed using `ytd-reel-shelf-renderer` with `ytd-reel-item-renderer` children.
- [ ] For each fixture, add a `*.spec.js` that loads the fixture, injects the userscript, and asserts non-allowed-language items are hidden while allowed-language items remain visible. Reuse `e2e/_helpers/inject.js`.
- [ ] If any selector path is missing from `Config.SELECTORS` in `yulaf.user.js`, add it AND add a unit test for the new selector handling. Do not silently skip elements.
- [ ] `npm run check` passes (against both Chromium and WebKit)
- [ ] Commit. Title: `test: add fixtures for search, subscriptions, watch, channel, shorts`.

### Task 3: Add edge-case fixtures for unusual titles
- [ ] `e2e/fixtures/edge-cases.html` — single fixture page containing a grid of `ytd-rich-item-renderer` items, each with a deliberately unusual `#video-title`. Cases:
  - Empty title (whitespace only)
  - One-character title (`A`)
  - Mostly emoji with one English word: `🎉🎊🥳 Birthday 🎂🎈🎉`
  - Mostly emoji with one Japanese word: `🌸🌸 春 🌸🌸`
  - Mixed Latin + CJK: `ANIME REVIEW: 鬼滅の刃 episode 1`
  - Mixed Latin + Cyrillic: `Tutorial по Python для новичков`
  - RTL Arabic: `كيفية تعلم البرمجة`
  - RTL Hebrew: `איך ללמוד תכנות`
  - Very long title (250+ chars) in English
  - Very long title in Russian
  - Title with only digits and punctuation: `2024 — #1!!!`
  - Title with only URLs: `https://example.com`
- [ ] `e2e/fixtures/edge-cases.spec.js` — for each case, assert the script processes the element without throwing AND chooses a defensible outcome (hide for clearly non-allowed, show for clearly allowed, show for ambiguous-or-unknown — this is the "low confidence → show" rule from Phase 1 Task 4).
- [ ] Document the policy with a one-line comment in the spec: emoji-only / digits-only / URL-only titles → undetectable → show.
- [ ] If any case throws or hangs, fix `yulaf.user.js` and add a unit test for the same input.
- [ ] `npm run check` passes
- [ ] Commit. Title: `test: add edge-case fixtures (emoji, RTL, mixed-script, very long, URL-only)`.

### Task 4: Add performance smoke test
- [ ] `e2e/fixtures/perf-1000.spec.js` — fixture-on-the-fly: in the test, inject 1000 `ytd-rich-item-renderer` elements with mixed-language titles into a minimal HTML scaffold via `page.evaluate`. Inject the userscript. Measure the time from script-injection to "all 1000 items have `data-yulaf-processed`" using `performance.now()`.
- [ ] Assert the wall-clock budget: under 2000 ms (2 seconds) for first-pass filtering of 1000 items on a modern Mac. If the assertion fails, investigate and either tighten the userscript (most likely candidates: trigram detector cosine loop, or redundant work in `MutationObserver` callback) or relax the budget with a justification comment in the spec.
- [ ] Add a second perf scenario in the same file: stream items in batches of 50 via `setTimeout` (simulating YouTube's progressive render). Assert no `MutationObserver` storm — total CPU time across all observer callbacks under 1000 ms.
- [ ] Run only against `fixtures-chromium` (skip on `fixtures-webkit` — WebKit timing under headless on macOS is high-variance and would cause flakes). Add a `test.skip(({ browserName }) => browserName === 'webkit', '...')` line.
- [ ] `npm run check` passes
- [ ] Commit. Title: `test: add 1000-item performance smoke test`.

### Task 5: Add WebKit-based live test
- [ ] `e2e/live/home-webkit.spec.js` — same shape as `e2e/live/home.spec.js` but assigned to the `live-webkit` project (or use Playwright's `test.use({ browserName: 'webkit' })`). Navigates to `https://www.youtube.com`, dismisses any consent banner, injects the userscript, waits for at least one `ytd-rich-item-renderer`, asserts no console errors and that `window.YuLaF` is defined.
- [ ] Run `npm run e2e:live` once locally and confirm both `live` (Chromium) and `live-webkit` projects pass. If WebKit-only failures appear against real youtube.com, this is exactly the kind of bug Phase 2 is meant to catch — fix the userscript, then re-run.
- [ ] If the live WebKit test is too flaky on first attempt to land green, mark it `test.fixme` with a TODO comment naming the specific symptom, but do NOT delete it. The test stays in the suite.
- [ ] `npm run check` passes (live tests are not part of check, so this is a separate confirmation)
- [ ] Commit. Title: `test: add WebKit live e2e test against real youtube.com`.

### Task 6: Triage and fix issues surfaced by Tasks 1–5
- [ ] Review the test runs from Tasks 1–5. For each test that was marked `fixme`, weakened, or revealed a userscript bug that wasn't fully addressed inline, file it as a sub-bullet here:
  - [ ] (placeholder — agent fills in actual issues found)
- [ ] If no issues remain, commit a one-line note in `README.md`'s "Tested in" section listing the engines and surfaces validated, then check this task done.
- [ ] If issues remain: fix each in `yulaf.user.js`, add or un-`fixme` the corresponding test, run `npm run check` green, then commit per-fix with descriptive titles.
- [ ] Final `npm run check` AND `npm run e2e:live` both green.
- [ ] Commit (or skip if covered by per-fix commits). Title: `fix: address issues surfaced by expanded e2e coverage`.

## Constraints

- Same as Phase 1 — single-file userscript, no runtime deps, GM_* APIs only.
- All new browser binaries must be installed once via `npx playwright install <browser>`. Document any required install commands in the README's contributor section.
- Do NOT introduce a runtime trigger for live tests — they stay opt-in via `npm run e2e:live`.
- Do NOT regenerate trigram tables from corpus text (Phase 1 Task 4 hit content-filter false-positives doing that). The vendored `tools/trigrams.generated.json` is the source of truth.
- Do NOT delete a test to make CI green. If a test is genuinely wrong, fix it; if the underlying behaviour is wrong, fix that. The only acceptable test-disable is `test.fixme` with a comment naming the symptom.
- Real iOS / iPadOS device testing is the user's responsibility, not the agent's. The agent's contract ends at WebKit headless. Note this in the README.
- Live e2e tests against youtube.com may break when YouTube changes its DOM. Don't pin selectors so tightly that minor YouTube updates break the suite — use the same broad selector set as `Config.SELECTORS`.
- Commit per task. Do not squash across tasks. Per-fix commits in Task 6 are also fine.
- Keep the userscript readable. Section-boundary comments only.
