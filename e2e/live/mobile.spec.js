import { test, expect, devices } from '@playwright/test';
import { injectUserscript } from '../_helpers/inject.js';

// Chromium-only: this test uses Pixel 5 device emulation (a Chromium device
// profile) and the live-webkit project's Desktop Safari profile would clash.
// If we want a WebKit mobile live test, it should be its own file with an
// iPhone profile.
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'mobile.spec.js uses Pixel 5 device emulation — Chromium only'
);

test.use({ ...devices['Pixel 5'] });

test('@live: userscript loads on m.youtube.com without throwing', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await injectUserscript(page);
  await page.goto('https://m.youtube.com/', { waitUntil: 'domcontentloaded' });

  // Best-effort cookie banner dismissal — selectors vary by region.
  const consent = page.locator(
    'button[aria-label*="Accept"], button[aria-label*="Reject"], button:has-text("Accept all"), button:has-text("Reject all")'
  );
  if ((await consent.count()) > 0) {
    await consent.first().click({ trial: false }).catch(() => {});
  }

  await page
    .waitForSelector(
      'ytm-rich-item-renderer, ytm-video-with-context-renderer, ytm-compact-video-renderer, ytm-consent-bump-v2-lightbox, [aria-label*="cookie" i]',
      { timeout: 30_000 }
    )
    .catch(() => {});

  const yulafLoaded = await page.evaluate(() => Boolean(window.YuLaF && window.YuLaF.version));
  expect(yulafLoaded).toBe(true);
  expect(errors).toEqual([]);
});
