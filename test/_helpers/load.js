import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const userscriptPath = path.resolve(__dirname, '..', '..', 'yulaf.user.js');

/**
 * Evaluate yulaf.user.js inside a sandboxed VM context with the current jsdom window/document
 * provided as globals. Returns the `module.exports` populated by the script's build-time shim.
 */
export function loadUserscript({ window: providedWindow, gmStorage } = {}) {
  const source = fs.readFileSync(userscriptPath, 'utf8');
  // Strip the metadata block — VM doesn't care, but it keeps stack traces cleaner.
  const stripped = source.replace(/^\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/m, '');

  const win = providedWindow || globalThis.window;
  const sandbox = {
    window: win,
    document: win ? win.document : globalThis.document,
    module: { exports: {} },
    console,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
    Date: globalThis.Date,
    Map: globalThis.Map,
    Set: globalThis.Set,
    WeakMap: globalThis.WeakMap,
    WeakSet: globalThis.WeakSet,
  };
  if (typeof globalThis.MutationObserver !== 'undefined') {
    sandbox.MutationObserver = globalThis.MutationObserver;
  }
  if (gmStorage) {
    const map = gmStorage instanceof Map ? gmStorage : new Map(Object.entries(gmStorage));
    sandbox.__gm = map;
    sandbox.GM_getValue = (key, fallback) => (map.has(key) ? map.get(key) : fallback);
    sandbox.GM_setValue = (key, value) => { map.set(key, value); };
    sandbox.GM_addStyle = (css) => {
      if (!sandbox.document) return null;
      const style = sandbox.document.createElement('style');
      style.textContent = css;
      (sandbox.document.head || sandbox.document.documentElement).appendChild(style);
      return style;
    };
  }
  vm.createContext(sandbox);
  vm.runInContext(stripped, sandbox, { filename: 'yulaf.user.js' });
  const exports = sandbox.module.exports;
  exports.__sandbox = sandbox;
  return exports;
}
