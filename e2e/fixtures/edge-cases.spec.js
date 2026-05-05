import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectUserscript } from '../_helpers/inject.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureUrl = 'file://' + path.resolve(__dirname, 'edge-cases.html');

// Policy: emoji-only / digits-only / URL-only titles → undetectable → show
// (low-confidence default-show rule from Phase 1 Task 4).

async function waitForAllProcessed(page) {
  await page.waitForFunction(() => {
    const items = document.querySelectorAll('[data-case]');
    if (items.length === 0) return false;
    for (const it of items) {
      if (it.getAttribute('data-yulaf-processed') !== '1') return false;
    }
    return true;
  });
  // Empty / too-short titles trigger an internal 200 ms retry inside the
  // userscript before defaulting to show. Wait it out plus a safety margin.
  await page.waitForTimeout(500);
}

test('edge cases: every title is processed without throwing', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await injectUserscript(page);
  await page.goto(fixtureUrl);

  await waitForAllProcessed(page);

  expect(errors).toEqual([]);

  const total = await page.evaluate(
    () => document.querySelectorAll('[data-case]').length
  );
  expect(total).toBe(12);
});

test('edge cases: each title yields a defensible visibility', async ({ page }) => {
  await injectUserscript(page);
  await page.goto(fixtureUrl);

  await waitForAllProcessed(page);

  const visibility = await page.evaluate(() => {
    const out = {};
    for (const el of document.querySelectorAll('[data-case]')) {
      const key = el.getAttribute('data-case');
      const isHidden =
        el.hasAttribute('data-language-filter-hidden') ||
        el.classList.contains('yulaf-hidden') ||
        el.style.display === 'none';
      out[key] = isHidden ? 'hidden' : 'visible';
    }
    return out;
  });

  // Allowed via "low confidence → show" policy (no script chars, or text too
  // short / too low-confidence to classify with the en target).
  expect(visibility['empty']).toBe('visible');
  expect(visibility['single-char']).toBe('visible');
  expect(visibility['emoji-en-word']).toBe('visible');
  expect(visibility['digits-punct']).toBe('visible');
  expect(visibility['url-only']).toBe('visible');
  expect(visibility['very-long-en']).toBe('visible');

  // Clearly non-target script → hidden.
  expect(visibility['emoji-ja-word']).toBe('hidden');
  expect(visibility['mixed-latin-cjk']).toBe('hidden');
  expect(visibility['mixed-latin-cyr']).toBe('hidden');
  expect(visibility['rtl-arabic']).toBe('hidden');
  expect(visibility['rtl-hebrew']).toBe('hidden');
  expect(visibility['very-long-ru']).toBe('hidden');
});
