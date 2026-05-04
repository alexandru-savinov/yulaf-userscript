import { test, expect } from '@playwright/test';
import { injectUserscript } from '../_helpers/inject.js';

test('@live: userscript loads on real youtube.com without throwing', async ({ page }) => {
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
