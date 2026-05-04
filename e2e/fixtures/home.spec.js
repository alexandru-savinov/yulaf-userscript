import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectUserscript } from '../_helpers/inject.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureUrl = 'file://' + path.resolve(__dirname, 'youtube-home.html');

test('userscript wires up and tags every video item with data-yulaf-processed', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await injectUserscript(page);
  await page.goto(fixtureUrl);

  // Wait for at least one item to be tagged so we know the controller has run.
  await page.waitForSelector('[data-yulaf-processed="1"]');

  const counts = await page.evaluate(() => {
    const items = document.querySelectorAll('ytd-rich-item-renderer, ytd-video-renderer');
    let processed = 0;
    for (const it of items) if (it.getAttribute('data-yulaf-processed') === '1') processed++;
    return { total: items.length, processed };
  });

  expect(counts.total).toBeGreaterThan(0);
  expect(counts.processed).toBe(counts.total);
  expect(errors).toEqual([]);
});

test('window.YuLaF debug handle is exposed', async ({ page }) => {
  await injectUserscript(page);
  await page.goto(fixtureUrl);
  const version = await page.evaluate(() => window.YuLaF && window.YuLaF.version);
  expect(version).toBeTruthy();
});
