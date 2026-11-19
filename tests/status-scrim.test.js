import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source = await readFile(new URL('../js/status-scrim.js', import.meta.url), 'utf8');
function setup({ installed = true, media = false, pathname = '/', hash = '#/', viewport = null, capacitor = null } = {}) {
  const properties = new Map();
  const root = { dataset: {}, style: { setProperty: (key, value) => properties.set(key, value), removeProperty: key => properties.delete(key) } };
  const events = {};
  const display = { matches: media, addEventListener: (name, fn) => { events[name] = fn; } };
  const location = { pathname, hash };
  vm.runInNewContext(source, {
    visualViewport: viewport, document: { documentElement: root }, navigator: { standalone: installed }, location,
    matchMedia: () => display, addEventListener: (name, fn) => { events[name] = fn; },
    Capacitor: capacitor,
  });
  return { root, events, display, location, properties };
}

test('installed ecosystem routes receive presentation adapters without changing location', () => {
  const state = setup();
  for (const route of ['', 'settings', 'daily-chief-briefing', 'weather', 'lee-lees-tracker',
    'digital-clock', 'violet-sprints', 'violet-futbol-game-tracker', 'road-bike-checklist', 'maintenance-total', 'violet-dineros']) {
    state.location.hash = `#/${route}`;
    state.events.hashchange();
    assert.ok(state.root.dataset.statusApp, route || 'launcher');
    assert.equal(state.location.hash, `#/${route}`);
  }
  state.location.hash = '#/canceled-app';
  state.events.hashchange();
  assert.equal(state.root.dataset.statusApp, undefined);
});

test('regular browser mode remains ungated until standalone display changes', () => {
  const state = setup({ installed: false });
  assert.equal(state.root.dataset.statusApp, undefined);
  state.display.matches = true;
  state.events.change();
  assert.equal(state.root.dataset.statusApp, 'home');
  state.display.matches = false;
  state.events.change();
  assert.equal(state.root.dataset.statusApp, undefined);
});

test('LWVD in-shell route and pageshow use the approved adapter', () => {
  const state = setup({ hash: '#/violet-dineros' });
  assert.equal(state.root.dataset.statusApp, 'lwvd');
  delete state.root.dataset.statusApp;
  state.events.pageshow();
  assert.equal(state.root.dataset.statusApp, 'lwvd');
});


test('native shell receives presentation adapters without standalone signals', () => {
  const state = setup({ installed: false, media: false, capacitor: { isNativePlatform: () => true } });
  assert.equal(state.root.dataset.statusApp, 'home');
  assert.equal(state.root.dataset.nativeApp, 'true');
  state.location.hash = '#/lee-lees-tracker';
  state.events.hashchange();
  assert.equal(state.root.dataset.statusApp, 'llt');
  assert.equal(state.root.dataset.nativeApp, 'true');
});

test('native frost is gated behind the native flag and the PWA cover stays opaque', async () => {
  const css = await readFile(new URL('../css/status-scrim.css', import.meta.url), 'utf8');
  assert.match(css, /:root\[data-status-app\] body::after \{\n  content: ""; position: fixed; inset: 0 0 auto; height: var\(--status-inset\);\n  background: var\(--status-surface\);/);
  assert.match(css, /:root\[data-status-app\]\[data-native-app\] body::after \{[^}]*backdrop-filter: blur\(18px\) saturate\(150%\)/);
  assert.match(css, /:root\[data-status-app\]\[data-native-app\] body::after \{[^}]*color-mix\(in srgb, var\(--status-surface\) 84%, transparent\)/);
});

test('status cover remains anchored without visual-viewport scroll offsets', async () => {
  const css = await readFile(new URL('../css/status-scrim.css', import.meta.url), 'utf8');
  assert.match(css, /position: fixed; inset: 0 0 auto/);
  assert.doesNotMatch(css + source, /status-viewport-top|offsetTop/);
  const state = setup({ hash: '#/lee-lees-tracker', viewport: { offsetTop: 120 } });
  assert.equal(state.root.dataset.statusApp, 'llt');
  assert.equal(state.properties.size, 0);
});
