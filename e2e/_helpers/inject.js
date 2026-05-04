import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const userscriptPath = path.resolve(__dirname, '..', '..', 'yulaf.user.js');

/**
 * Install GM_* stubs and inject the userscript source into the page before any page script runs.
 * Returns helpers for the test to inspect/seed GM storage from the Node side.
 */
export async function injectUserscript(page, { initialStorage = {} } = {}) {
  const source = fs.readFileSync(userscriptPath, 'utf8');

  await page.addInitScript(
    ({ storage, src }) => {
      // eslint-disable-next-line no-undef
      const w = window;
      const map = new Map(Object.entries(storage));
      w.__YULAF_GM__ = map;
      w.GM_getValue = (key, fallback) => (map.has(key) ? map.get(key) : fallback);
      w.GM_setValue = (key, value) => {
        map.set(key, value);
      };
      w.GM_addStyle = (css) => {
        const style = document.createElement('style');
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
        return style;
      };

      // Strip the userscript metadata block; execute the IIFE body in the page context.
      const stripped = src.replace(/^\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/m, '');
      // eslint-disable-next-line no-new-func
      new Function(stripped)();
    },
    { storage: initialStorage, src: source }
  );

  return {
    getStorage: () => page.evaluate(() => Object.fromEntries(window.__YULAF_GM__.entries())),
    setStorage: (key, value) =>
      page.evaluate(
        ([k, v]) => {
          window.__YULAF_GM__.set(k, v);
        },
        [key, value]
      ),
  };
}
