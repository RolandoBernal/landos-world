import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/theme-manager.js', import.meta.url), 'utf8');

function createThemeRuntime(options = {}) {
  const store = new Map();
  if (options.storedPreference) {
    store.set('landos_world_appearance_preference_v1', options.storedPreference);
  }
  const listeners = new Set();
  const meta = {
    content: '',
    setAttribute(name, value) {
      if (name === 'content') this.content = value;
    },
  };
  const mediaQuery = {
    matches: Boolean(options.systemPrefersDark),
    addEventListener(type, callback) {
      if (type === 'change') listeners.add(callback);
    },
  };
  const context = vm.createContext({
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
    },
    document: {
      documentElement: {
        dataset: {},
        style: {},
      },
      querySelectorAll: (selector) => (selector === 'meta[name="theme-color"]' ? [meta] : []),
    },
    window: {
      matchMedia: () => mediaQuery,
      dispatchEvent: () => {},
      CustomEvent: class CustomEvent {
        constructor(type, init) {
          this.type = type;
          this.detail = init?.detail;
        }
      },
    },
  });
  vm.runInContext(source, context);
  return {
    api: context.window.LandosTheme,
    root: context.document.documentElement,
    meta,
    store,
    setSystemPrefersDark(value) {
      mediaQuery.matches = Boolean(value);
      listeners.forEach((callback) => callback({ matches: mediaQuery.matches }));
    },
  };
}

test('theme preference defaults to system for new users', () => {
  const runtime = createThemeRuntime();
  assert.equal(runtime.api.getState().preference, 'system');
  assert.equal(runtime.store.get(runtime.api.STORAGE_KEY), undefined);
});

test('system preference resolves from the current OS color scheme', () => {
  assert.equal(createThemeRuntime({ systemPrefersDark: false }).api.getState().effectiveTheme, 'light');
  assert.equal(createThemeRuntime({ systemPrefersDark: true }).api.getState().effectiveTheme, 'dark');
});

test('explicit light and dark preferences override the OS color scheme', () => {
  assert.equal(createThemeRuntime({ storedPreference: 'light', systemPrefersDark: true }).api.getState().effectiveTheme, 'light');
  assert.equal(createThemeRuntime({ storedPreference: 'dark', systemPrefersDark: false }).api.getState().effectiveTheme, 'dark');
});

test('system preference updates live when the OS color scheme changes', () => {
  const runtime = createThemeRuntime({ systemPrefersDark: false });
  assert.equal(runtime.api.getState().effectiveTheme, 'light');
  runtime.setSystemPrefersDark(true);
  assert.equal(runtime.api.getState().effectiveTheme, 'dark');
  assert.equal(runtime.root.dataset.theme, 'dark');
  assert.equal(runtime.meta.content, '#000000');
});

test('explicit preferences ignore live OS color scheme changes', () => {
  const runtime = createThemeRuntime({ storedPreference: 'light', systemPrefersDark: false });
  runtime.setSystemPrefersDark(true);
  assert.equal(runtime.api.getState().effectiveTheme, 'light');
  assert.equal(runtime.root.dataset.theme, 'light');
});

test('setPreference persists locally and reapplies the root theme attributes', () => {
  const runtime = createThemeRuntime({ systemPrefersDark: false });
  runtime.api.setPreference('dark');
  assert.equal(runtime.store.get(runtime.api.STORAGE_KEY), 'dark');
  assert.equal(runtime.root.dataset.appearancePreference, 'dark');
  assert.equal(runtime.root.dataset.theme, 'dark');
  assert.equal(runtime.root.style.colorScheme, 'dark');
});
