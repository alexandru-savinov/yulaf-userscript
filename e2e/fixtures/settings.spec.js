import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectUserscript } from '../_helpers/inject.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureUrl = 'file://' + path.resolve(__dirname, 'youtube-home.html');

async function waitFiltered(page) {
  await page.waitForFunction(() => {
    const items = document.querySelectorAll('ytd-rich-item-renderer, ytd-video-renderer');
    if (items.length === 0) return false;
    for (const it of items) {
      if (!it.hasAttribute('data-language-filter-checked')) return false;
    }
    return true;
  });
}

test('seeded selectedLanguages=[ru] inverts the hide pattern after reload', async ({ page }) => {
  await injectUserscript(page, { initialStorage: { selectedLanguages: ['ru'] } });
  await page.goto(fixtureUrl);
  await waitFiltered(page);

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

  expect(visibility.ru.visible).toBeGreaterThan(0);
  expect(visibility.ru.hidden).toBe(0);
  expect(visibility.en.hidden).toBeGreaterThan(0);
  expect(visibility.ja.hidden).toBeGreaterThan(0);
});

test('clicking the floating toggle opens the settings panel', async ({ page }) => {
  await injectUserscript(page);
  await page.goto(fixtureUrl);

  const toggle = page.locator('[data-yulaf-ui] .yulaf-toggle');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('data-enabled', '1');

  await toggle.click();

  const panel = page.locator('[data-yulaf-ui] .yulaf-panel.yulaf-open');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.yulaf-grid .yulaf-lang')).not.toHaveCount(0);
});

test('disabling the filter via the panel checkbox reveals every item and persists', async ({
  page,
}) => {
  const helpers = await injectUserscript(page);
  await page.goto(fixtureUrl);
  await waitFiltered(page);

  await page.locator('[data-yulaf-ui] .yulaf-toggle').click();
  const enabledCheckbox = page.locator('[data-yulaf-ui] .yulaf-enabled');
  await expect(enabledCheckbox).toBeChecked();
  await enabledCheckbox.click();
  await expect(enabledCheckbox).not.toBeChecked();

  await expect(page.locator('[data-yulaf-ui] .yulaf-toggle')).toHaveAttribute(
    'data-enabled',
    '0'
  );

  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll('[data-lang]')).every(
      (el) => el.style.display !== 'none'
    );
  });

  const stored = await helpers.getStorage();
  expect(stored.enabled).toBe(false);
});

test('Hide all button clears the language selection and persists it', async ({ page }) => {
  const helpers = await injectUserscript(page);
  await page.goto(fixtureUrl);
  await waitFiltered(page);

  await page.locator('[data-yulaf-ui] .yulaf-toggle').click();
  await page.locator('[data-yulaf-ui] .yulaf-hide-all').click();

  await page.waitForFunction(() => {
    const stored = window.__YULAF_GM__.get('selectedLanguages');
    return Array.isArray(stored) && stored.length === 0;
  });

  const stored = await helpers.getStorage();
  expect(stored.selectedLanguages).toEqual([]);
});
