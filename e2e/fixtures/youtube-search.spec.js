import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectUserscript } from '../_helpers/inject.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureUrl = 'file://' + path.resolve(__dirname, 'youtube-search.html');

const ITEM_SELECTOR = 'ytd-video-renderer, ytd-channel-renderer';

test('search results: items get tagged and processed', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await injectUserscript(page);
  await page.goto(fixtureUrl);

  await page.waitForSelector('[data-yulaf-processed="1"]');

  const counts = await page.evaluate((sel) => {
    const items = document.querySelectorAll(sel);
    let processed = 0;
    for (const it of items) if (it.getAttribute('data-yulaf-processed') === '1') processed++;
    return { total: items.length, processed };
  }, ITEM_SELECTOR);

  expect(counts.total).toBeGreaterThan(0);
  expect(counts.processed).toBe(counts.total);
  expect(errors).toEqual([]);
});

test('search results: english stays visible, non-english hidden across video + shelf rows', async ({ page }) => {
  await injectUserscript(page);
  await page.goto(fixtureUrl);

  await page.waitForFunction((sel) => {
    const items = document.querySelectorAll(sel);
    if (items.length === 0) return false;
    for (const it of items) {
      if (!it.hasAttribute('data-language-filter-checked')) return false;
    }
    return true;
  }, 'ytd-video-renderer');

  const visibility = await page.evaluate(() => {
    const out = {};
    for (const el of document.querySelectorAll('ytd-video-renderer[data-lang]')) {
      const lang = el.getAttribute('data-lang');
      const isHidden =
        el.style.display === 'none' ||
        el.hasAttribute('data-language-filter-hidden') ||
        el.classList.contains('yulaf-hidden');
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
  expect(visibility.tr.hidden).toBeGreaterThan(0);
});
