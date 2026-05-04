import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectUserscript } from '../_helpers/inject.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureUrl = 'file://' + path.resolve(__dirname, 'dynamic-load.html');

test('MutationObserver picks up dynamically inserted items and filters them', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await injectUserscript(page);
  await page.goto(fixtureUrl);

  // The fixture's inline script injects 4 items 500ms after load.
  await page.waitForFunction(() => {
    const items = document.querySelectorAll('ytd-rich-item-renderer');
    if (items.length < 4) return false;
    for (const it of items) {
      if (!it.hasAttribute('data-language-filter-checked')) return false;
    }
    return true;
  });

  const visibility = await page.evaluate(() => {
    const out = {};
    for (const el of document.querySelectorAll('[data-lang]')) {
      const lang = el.getAttribute('data-lang');
      const isHidden =
        el.style.display === 'none' || el.hasAttribute('data-language-filter-hidden');
      out[lang] = out[lang] || { hidden: 0, visible: 0 };
      if (isHidden) out[lang].hidden++;
      else out[lang].visible++;
    }
    return out;
  });

  expect(visibility.en.visible).toBeGreaterThan(0);
  expect(visibility.en.hidden).toBe(0);
  expect(visibility.ru.hidden).toBeGreaterThan(0);
  expect(visibility.ja.hidden).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
