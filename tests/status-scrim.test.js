import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source = await readFile(new URL('../js/status-scrim.js', import.meta.url), 'utf8');
function setup({ installed = true, media = false, pathname = '/', hash = '#/', viewport = null } = {}) {
  const properties = new Map();
  const root = { dataset: {}, style: { setProperty: (key, value) => properties.set(key, value), removeProperty: key => properties.delete(key) } };
  const events = {};
  const display = { matches: media, addEventListener: (name, fn) => { events[name] = fn; } };
  const location = { pathname, hash };
  vm.runInNewContext(source, {
    visualViewport: viewport, document: { documentElement: root }, navigator: { standalone: installed }, location,
    matchMedia: () => display, addEventListener: (name, fn) => { events[name] = fn; },
  });
  return { root, events, display, location, properties };
}

test('installed ecosystem routes receive presentation adapters without changing location', () => {
  const state = setup();
  for (const route of ['', 'settings', 'daily-chief-briefing', 'weather', 'lee-lees-tracker',
    'digital-clock', 'violet-sprints', 'violet-futbol-game-tracker', 'road-bike-checklist', 'maintenance-total']) {
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

test('LWVD standalone entry and pageshow use the approved adapter', () => {
  const state = setup({ pathname: '/landos-world/violet-dineros/index.html' });
  assert.equal(state.root.dataset.statusApp, 'lwvd');
  delete state.root.dataset.statusApp;
  state.events.pageshow();
  assert.equal(state.root.dataset.statusApp, 'lwvd');
});


test('LLT status cover follows keyboard viewport panning and clears on exit', () => {
  const listeners = {};
  const viewport = { offsetTop: 0, addEventListener: (name, fn) => { listeners[name] = fn; } };
  const state = setup({ hash: '#/lee-lees-tracker', viewport });
  for (const offset of [90, 150, 35, 0]) {
    viewport.offsetTop = offset;
    listeners.resize(); listeners.scroll();
    assert.equal(state.properties.get('--status-viewport-top'), `${offset}px`);
  }
  viewport.offsetTop = 120;
  state.location.hash = '#/weather'; state.events.hashchange();
  listeners.scroll();
  assert.equal(state.properties.has('--status-viewport-top'), false);
  state.location.hash = '#/lee-lees-tracker'; state.events.hashchange();
  assert.equal(state.properties.get('--status-viewport-top'), '120px');
});
