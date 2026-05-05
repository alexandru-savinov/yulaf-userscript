import { test, expect } from '@playwright/test';
import { injectUserscript } from '../_helpers/inject.js';

// WebKit-only live test: this file mirrors home.spec.js but is scoped to
// WebKit so the matrix is explicit. The 'live' Chromium project skips it.
test.skip(
  ({ browserName }) => browserName !== 'webkit',
  'home-webkit.spec.js is WebKit-only — see home.spec.js for the Chromium variant'
);

// TODO: un-fixme once we have a faithful injection path under headless WebKit.
// Symptom: page.evaluate(() => window.YuLaF) hangs to test timeout (60s) on
// real youtube.com under WebKit. Page renders fine (sign-in shell loads) but
// the userscript never publishes its global. Likely cause: Playwright's
// addInitScript + `new Function(src)()` smuggling path is blocked by
// youtube.com's CSP under WebKit (Chromium is more permissive about
// extension-world script injection from init scripts). Real Safari + the
// Userscripts app inject via the WebKit Content Blocker / extension API,
// which bypasses page CSP — so this is a harness gap, not a userscript bug.
// Keep the test in the suite so we notice if Playwright closes the gap or
// if the CSP shape changes.
test.fixme('@live: userscript loads on real youtube.com under WebKit without throwing', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await injectUserscript(page);
  await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded' });

  // Best-effort cookie banner dismissal — selectors vary by region.
  const consent = page.locator(
    'button[aria-label*="Accept"], button[aria-label*="Reject"], button:has-text("Accept all"), button:has-text("Reject all")'
  );
  if ((await consent.count()) > 0) {
    await consent.first().click({ trial: false }).catch(() => {});
  }

  // Wait for either item render OR the consent interstitial — YouTube serves
  // the latter on fresh headless sessions and we can't always click through it.
  // Either way we want to confirm the userscript loaded without throwing.
  await page
    .waitForSelector(
      'ytd-rich-item-renderer, ytd-video-renderer, ytd-rich-grid-media, ytd-consent-bump-v2-lightbox, [aria-label*="cookie" i]',
      { timeout: 30_000 }
    )
    .catch(() => {});

  const yulafLoaded = await page.evaluate(() => Boolean(window.YuLaF && window.YuLaF.version));
  expect(yulafLoaded).toBe(true);
  expect(errors).toEqual([]);
});
