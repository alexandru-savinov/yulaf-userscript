import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectUserscript } from '../_helpers/inject.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureUrl = 'file://' + path.resolve(__dirname, 'perf-scaffold.html');

// Skip on WebKit: headless WebKit timing on macOS is high-variance and would
// cause perf-budget flakes. The userscript is also engine-agnostic for hot paths.
test.skip(
  ({ browserName }) => browserName === 'webkit',
  'WebKit headless timing on macOS is high-variance — perf budget would flake'
);

const TITLES_BY_LANG = {
  en: [
    'How to build a userscript from scratch with vanilla JavaScript',
    'The complete beginners guide to learning English grammar quickly',
    'Top ten React performance tips every developer should know',
    'Building a full stack web application from start to finish',
  ],
  ru: [
    'Как настроить расширение для Safari на iPad и iPhone',
    'Лучшие фильмы прошлого года по версии редакции канала',
    'Полное руководство по программированию на JavaScript для начинающих',
    'Обзор новой модели смартфона и сравнение с конкурентами',
  ],
  ja: [
    '日本語のタイトルのサンプル動画を作ってみました',
    '東京の朝の様子を撮ってみたので是非ご覧ください',
    '最新のスマートフォンレビューと使い方の紹介動画です',
    '美味しい和食の作り方を簡単に説明する料理チャンネル',
  ],
  tr: [
    "İstanbul'da güzel bir gün geçirmek için yapılacaklar listesi",
    'Türkçe öğrenmek için en iyi yöntemler ve kaynaklar burada',
    'Yeni başlayanlar için kapsamlı programlama dersleri serisi',
    'Ev yapımı yemek tarifleri ve mutfak ipuçları paylaşımı',
  ],
};

function makeItems(count) {
  const langs = Object.keys(TITLES_BY_LANG);
  const out = [];
  for (let i = 0; i < count; i++) {
    const lang = langs[i % langs.length];
    const titles = TITLES_BY_LANG[lang];
    out.push({ lang, title: titles[i % titles.length], idx: i });
  }
  return out;
}

test('first-pass filtering of 1000 items completes under 2000ms', async ({ page }) => {
  await injectUserscript(page);
  await page.goto(fixtureUrl);
  await page.waitForFunction(() => window.YuLaF && window.YuLaF.version);

  const items = makeItems(1000);

  const elapsed = await page.evaluate(async (items) => {
    const contents = document.getElementById('contents');
    const t0 = performance.now();
    const frag = document.createDocumentFragment();
    for (const it of items) {
      const el = document.createElement('ytd-rich-item-renderer');
      el.setAttribute('data-lang', it.lang);
      const a = document.createElement('a');
      a.id = 'video-title';
      a.href = '/watch?v=' + it.lang + it.idx;
      a.textContent = it.title;
      el.appendChild(a);
      frag.appendChild(el);
    }
    contents.appendChild(frag);

    await new Promise((resolve) => {
      const tick = () => {
        const all = document.querySelectorAll('ytd-rich-item-renderer');
        if (all.length === items.length) {
          let done = 0;
          for (const el of all) if (el.hasAttribute('data-yulaf-processed')) done++;
          if (done === items.length) return resolve();
        }
        setTimeout(tick, 5);
      };
      tick();
    });
    return performance.now() - t0;
  }, items);

  // eslint-disable-next-line no-console
  console.log(`[perf] first-pass 1000 items: ${elapsed.toFixed(1)}ms`);
  expect(elapsed).toBeLessThan(2000);
});

test('streaming 1000 items in batches of 50 keeps total observer CPU under 1000ms', async ({
  page,
}) => {
  // Wrap MutationObserver to measure cumulative callback time. Must run before
  // the userscript registers its observer, so this addInitScript precedes
  // injectUserscript.
  await page.addInitScript(() => {
    const Native = window.MutationObserver;
    let total = 0;
    let calls = 0;
    window.__moStats = () => ({ total, calls });
    function Wrapped(cb) {
      return new Native(function (mutations, observer) {
        const t0 = performance.now();
        try {
          return cb(mutations, observer);
        } finally {
          total += performance.now() - t0;
          calls++;
        }
      });
    }
    Wrapped.prototype = Native.prototype;
    window.MutationObserver = Wrapped;
  });

  await injectUserscript(page);
  await page.goto(fixtureUrl);
  await page.waitForFunction(() => window.YuLaF && window.YuLaF.version);

  const items = makeItems(1000);

  const result = await page.evaluate(async (items) => {
    const contents = document.getElementById('contents');
    const BATCH = 50;
    let added = 0;
    const t0 = performance.now();
    await new Promise((resolve) => {
      function tick() {
        const frag = document.createDocumentFragment();
        for (let j = 0; j < BATCH && added < items.length; j++) {
          const it = items[added++];
          const el = document.createElement('ytd-rich-item-renderer');
          el.setAttribute('data-lang', it.lang);
          const a = document.createElement('a');
          a.id = 'video-title';
          a.href = '/watch?v=' + it.lang + it.idx;
          a.textContent = it.title;
          el.appendChild(a);
          frag.appendChild(el);
        }
        contents.appendChild(frag);
        if (added < items.length) setTimeout(tick, 16);
        else resolve();
      }
      tick();
    });

    await new Promise((resolve) => {
      const wait = () => {
        const all = document.querySelectorAll('ytd-rich-item-renderer');
        if (all.length < items.length) return setTimeout(wait, 10);
        let done = 0;
        for (const el of all) if (el.hasAttribute('data-yulaf-processed')) done++;
        if (done === items.length) return resolve();
        setTimeout(wait, 10);
      };
      wait();
    });

    const wallClock = performance.now() - t0;
    const stats = window.__moStats ? window.__moStats() : { total: 0, calls: 0 };
    return { wallClock, total: stats.total, calls: stats.calls };
  }, items);

  // eslint-disable-next-line no-console
  console.log(
    `[perf] streaming 1000/50: wall=${result.wallClock.toFixed(1)}ms, ` +
      `MO callbacks=${result.calls}, MO total=${result.total.toFixed(1)}ms`
  );
  expect(result.total).toBeLessThan(1000);
});
