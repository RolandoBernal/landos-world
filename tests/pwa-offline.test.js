import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
const pwaManager = readFileSync(new URL('../js/pwa-manager.js', import.meta.url), 'utf8');
const digitalClockCss = readFileSync(new URL('../css/digital-clock.css', import.meta.url), 'utf8');
const dailyChiefBriefingCss = readFileSync(new URL('../css/daily-chief-briefing.css', import.meta.url), 'utf8');
const leeLeeDiabetesCss = readFileSync(new URL('../css/lee-lee-diabetes.css', import.meta.url), 'utf8');
const sprintsCss = readFileSync(new URL('../css/sprints.css', import.meta.url), 'utf8');
const vfgtCss = readFileSync(new URL('../css/violet-futbol-game-tracker.css', import.meta.url), 'utf8');
const roadBikeCss = readFileSync(new URL('../css/road-bike-checklist.css', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));

function createElementStub() {
  return {
    hidden: false,
    innerHTML: '',
    textContent: '',
    attributes: {},
    classList: {
      values: new Set(),
      toggle(name, force) {
        if (force) this.values.add(name);
        else this.values.delete(name);
      },
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
  };
}

function createPwaContext({
  onLine = true,
  serviceWorker,
  caches,
  storage,
  standalone = false,
  buildMetadata = { environment: 'unknown', appVersion: '1.0.0' },
  fetchImplementation,
  visibleForms = [],
  timerDelay,
} = {}) {
  const documentListeners = {};
  const windowListeners = {};
  const elements = {
    'pwa-network-status': createElementStub(),
    'pwa-toast': createElementStub(),
    'pwa-offline-settings': createElementStub(),
  };
  const localStorageStore = new Map();
  const context = {
    console: {
      ...console,
      warn: () => {},
    },
    alert: () => {},
    confirm: () => true,
    CustomEvent: class CustomEvent {
      constructor(type) {
        this.type = type;
      }
    },
    Intl,
    URL,
    Date,
    Math,
    Map,
    Symbol,
    WeakMap,
    WeakSet,
    MessageChannel: class MessageChannel {
      constructor() {
        const port1 = { onmessage: null, close: () => {} };
        const port2 = { onmessage: null, close: () => {} };
        port1.postMessage = (data) => port2.onmessage?.({ data });
        port2.postMessage = (data) => port1.onmessage?.({ data });
        this.port1 = port1;
        this.port2 = port2;
      }
    },
    Number,
    Promise,
    Set,
    String,
    clearTimeout,
    document: {
      activeElement: null,
      body: {},
      visibilityState: 'visible',
      addEventListener(type, handler) {
        documentListeners[type] = handler;
      },
      querySelectorAll() {
        return visibleForms;
      },
      getElementById(id) {
        return elements[id] || null;
      },
    },
    localStorage: {
      getItem(key) {
        return localStorageStore.get(key) || null;
      },
      setItem(key, value) {
        localStorageStore.set(key, String(value));
      },
      removeItem(key) {
        localStorageStore.delete(key);
      },
    },
    matchMedia: () => ({ matches: standalone }),
    navigator: {
      onLine,
      standalone,
      serviceWorker,
      storage,
    },
    setTimeout: timerDelay === undefined
      ? setTimeout
      : (callback, delay, ...args) => setTimeout(callback, Math.min(delay, timerDelay), ...args),
    clearTimeout,
    location: { hostname: 'example.com', href: 'https://example.com/index.html', reloadCount: 0, reload() { this.reloadCount += 1; } },
    window: null,
  };
  context.window = context;
  context.globalThis = context;
  context.LandoWorldBuildMetadata = buildMetadata;
  const sessionStore = new Map();
  context.sessionStorage = {
    getItem(key) { return sessionStore.get(key) || null; },
    setItem(key, value) { sessionStore.set(key, String(value)); },
    removeItem(key) { sessionStore.delete(key); },
  };
  if (fetchImplementation) context.fetch = fetchImplementation;
  context.addEventListener = (type, handler) => {
    windowListeners[type] ||= [];
    windowListeners[type].push(handler);
  };
  context.dispatchEvent = () => true;
  if (caches) context.caches = caches;
  vm.runInNewContext(pwaManager, context);
  documentListeners.DOMContentLoaded?.();
  return { context, documentListeners, elements, windowListeners };
}

async function flushAsync() {
  for (let i = 0; i < 6; i += 1) {
    await Promise.resolve();
  }
}

test('service worker precaches the app shell and app modules needed for offline launch', () => {
  [
    './index.html',
    './index-digital-clock.html',
    './manifest.webmanifest',
    './css/digital-clock.css',
    './css/app-themes.css',
    './css/weather-app.css',
    './css/daily-chief-briefing.css',
    './css/lee-lee-diabetes.css',
    './css/sprints.css',
    './css/violet-futbol-game-tracker.css',
    './css/road-bike-checklist.css',
    './css/maintenance-total.css',
    './js/pwa-manager.js',
    './js/weather-service.js',
    './js/weather-app.js',
    './js/daily-chief-briefing.js',
    './js/theme-manager.js',
    './js/landos-world-build-metadata.js',
    './js/lee-lee-pre-meal-timer.js',
    './js/lee-lee-diabetes-tracker.js',
    './js/sprints-app.js',
    './js/violet-futbol-game-tracker.js',
    './js/road-bike-checklist.js',
    './js/maintenance-total.js',
    './js/maintenance-total-v2.js',
    './fonts/digital-7.ttf',
    './fonts/dm-sans-latin.woff2',
    './fonts/dm-sans-latin-ext.woff2',
    './fonts/roboto-mono-regular.ttf',
    './icons/landos-world.svg',
    './icons/weather.png',
    './icons/digital-clock.png',
    './icons/lee-lees-tracker.png',
    './icons/violet-sprints.png',
    './icons/violet-futbol-game-tracker.png',
    './icons/road-bike-checklist.png',
    './icons/imt-maintenance-icon-pearl-white.svg',
    './icons/imaintenancetotal-pearl-white.png',
    './icons/death-on-notecards.png',
  ].forEach((asset) => assert.match(sw, new RegExp(asset.replaceAll('.', '\\.'))));
});

test('Digital Clock reuses the VFGT seven-segment renderer only for time digits', () => {
  assert.match(html, /const CLOCK_SEVEN_SEGMENT_NAMES = \['top', 'upper-left', 'upper-right', 'middle', 'lower-left', 'lower-right', 'bottom'\]/);
  assert.match(html, /class="vfgt_seven_segment_digit" data-vfgt-seven-segment-digit="\$\{digit\}" aria-hidden="true"/);
  assert.match(html, /class="vfgt_seven_segment vfgt_seven_segment--\$\{segment\} \$\{active\.has\(segment\) \? 'is-on' : 'is-off'\}"/);
  assert.match(html, /timeEl\.querySelectorAll\('\.time_separator'\)\.forEach\(setClockSeparatorMarkup\)/);
  assert.match(html, /setClockPartText\(refs\.hour, data\.hour\)/);
  assert.match(html, /setClockPartText\(refs\.minute, data\.minute\)/);
  assert.match(html, /setClockPartText\(refs\.second, data\.second\)/);
  assert.match(html, /setTextIfChanged\(refs\.ampm, data\.ampm\)/);
});

test('Digital Clock seven-segment CSS is scoped away from normal interface text', () => {
  assert.match(digitalClockCss, /\.digit_clock_time \{[\s\S]*--vfgt-segment-on: currentColor/);
  assert.match(digitalClockCss, /\.digit_clock_time \.vfgt_seven_segment_digit \{[\s\S]*height: var\(--digit-height\)/);
  assert.match(digitalClockCss, /\.digit_clock_time \.vfgt_seven_segment_colon span \{[\s\S]*box-shadow: var\(--vfgt-segment-glow\)/);
  assert.match(digitalClockCss, /--digital-clock-ui-font: 'Orbitron', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif/);
  assert.match(digitalClockCss, /\.digit_clock_time \.ampm \{[\s\S]*font-family: var\(--digital-clock-ui-font\)/);
  assert.match(digitalClockCss, /\.digit_clock_date,[\s\S]*\.digit_clock_date_short \{[\s\S]*font-family: var\(--digital-clock-ui-font\)/);
  assert.doesNotMatch(digitalClockCss, /\.digit_clock_app \{[\s\S]{0,220}font-family: 'Digital-7'/);
});

test('service worker uses separate versioned caches and strategy-specific runtime handling', () => {
  assert.match(sw, /const SW_VERSION = '__LANDOS_BUILD_SHA__'/);
  assert.match(sw, /const APP_CACHE = `landos-world-app-\$\{SW_VERSION\}`/);
  assert.match(sw, /const WEATHER_CACHE = `landos-world-weather-\$\{SW_VERSION\}`/);
  assert.match(sw, /const IMAGE_CACHE = `landos-world-images-\$\{SW_VERSION\}`/);
  assert.match(sw, /async function cacheFirst/);
  assert.match(sw, /const cached = await cache\.match\(request\)\s*\n\s*\|\| await cache\.match\(request, \{ ignoreSearch: true \}\)/);
  assert.doesNotMatch(sw.match(/self\.addEventListener\('install',[\s\S]*?\n\}\);/)?.[0] || '', /skipWaiting/);
  assert.match(sw, /if \(message\.type === 'SKIP_WAITING'\)[\s\S]*self\.skipWaiting\(\)/);
  assert.match(sw, /deployment-version\.json[\s\S]*fetch\(new Request\(request, \{ cache: 'no-store' \}\)\)/);
  assert.match(sw, /message\.type === 'GET_BUILD_METADATA'/);
  assert.match(sw, /async function staleWhileRevalidate/);
  assert.match(sw, /async function networkFirst/);
  assert.match(sw, /new Request\(url, \{ cache: 'reload' \}\)/);
  assert.match(sw, /WEATHER_HOSTS\.has\(url\.hostname\)/);
});

test('PWA checks for updates when the app opens, returns to the foreground, reconnects, and periodically while open', () => {
  assert.match(pwaManager, /const UPDATE_CHECK_INTERVAL_MS = 15 \* 60 \* 1000/);
  assert.match(pwaManager, /registration\.update\(\)/);
  assert.match(pwaManager, /document\.addEventListener\('visibilitychange'/);
  assert.match(pwaManager, /window\.addEventListener\('pageshow'/);
  assert.match(pwaManager, /window\.setInterval\(\(\) => \{[\s\S]*checkForServiceWorkerUpdate\(activeRegistration\);[\s\S]*checkForDeployedRelease\(\)/);
  assert.match(pwaManager, /checkForServiceWorkerUpdate\(\);/);
});

test('localhost previews bypass service-worker registration', () => {
  assert.match(pwaManager, /LOCAL_PREVIEW_HOSTS = new Set\(\['localhost', '127\.0\.0\.1', '\[::1\]', '::1'\]\)/);
  assert.match(pwaManager, /if \(isLocalPreview\(\)\) \{/);
  assert.match(pwaManager, /disableLocalPreviewServiceWorkers\(\)/);
  assert.match(pwaManager, /registration\.unregister\(\)/);
});

test('app dropdowns use padded custom select arrows', () => {
  [
    [html, /css\/daily-chief-briefing\.css\?v=20260917-1/],
    [html, /css\/lee-lee-diabetes\.css\?v=20260926-1/],
    [html, /js\/lee-lees-tracker-sync\.js\?v=20260917-1/],
    [html, /js\/lee-lee-diabetes-tracker\.js\?v=20260926-1/],
    [html, /js\/pwa-manager\.js\?v=20260916-3/],
    [html, /css\/sprints\.css\?v=20260825-1/],
    [html, /css\/violet-futbol-game-tracker\.css\?v=20260919-2/],
    [html, /js\/violet-futbol-game-tracker\.js\?v=20260919-2/],
    [dailyChiefBriefingCss, /\.daily_briefing_select \{[\s\S]*-webkit-appearance: none[\s\S]*appearance: none[\s\S]*background-image: linear-gradient[\s\S]*background-position: calc\(100% - 1\.45rem\) 50%, calc\(100% - 1\.05rem\) 50%[\s\S]*padding-inline-end: 3rem/],
    [leeLeeDiabetesCss, /\.lee_lee_diabetes_select \{[\s\S]*-webkit-appearance: none[\s\S]*appearance: none[\s\S]*background-image: linear-gradient[\s\S]*background-position: calc\(100% - 1\.45rem\) 50%, calc\(100% - 1\.05rem\) 50%[\s\S]*padding-inline-end: 3rem/],
    [sprintsCss, /\.sprints-select \{[\s\S]*-webkit-appearance: none[\s\S]*appearance: none[\s\S]*background-image: linear-gradient[\s\S]*background-position: calc\(100% - 1\.45rem\) 50%, calc\(100% - 1\.05rem\) 50%[\s\S]*padding-inline-end: 3rem/],
  ].forEach(([source, pattern]) => assert.match(source, pattern));
});

test('application cache cleanup is separated from localStorage user data', () => {
  assert.match(sw, /CLEAR_APPLICATION_CACHES/);
  assert.match(sw, /APPLICATION_CACHES_REBUILT/);
  assert.match(sw, /precacheApplicationShell\('rebuild'\)/);
  assert.match(sw, /key\.startsWith\(CACHE_PREFIX\)/);
  assert.doesNotMatch(sw, /localStorage|indexedDB|deleteDatabase/);
  assert.match(pwaManager, /Cache cleanup never deletes Lee-Lee's Tracker records/);
  assert.doesNotMatch(pwaManager, /localStorage\.clear\(\)/);
  assert.doesNotMatch(pwaManager, /setTimeout\(\(\) => window\.location\.reload/);
});

test('offline, install, update, and settings UI hooks are present and accessible', () => {
  assert.match(html, /id="pwa-network-status" role="status" aria-live="polite"/);
  assert.match(html, /id="pwa-toast" role="status" aria-live="polite"/);
  assert.match(html, /<button type="button" class="lando_settings_link digit_clock_menu_toggle" data-lando-settings-toggle aria-label="Lando's World Settings"/);
  assert.match(html, /id="lando-settings-view" hidden/);
  assert.match(html, /id="pwa-offline-settings" aria-live="polite"/);
  assert.match(pwaManager, /<section class="pwa_offline_panel" id="pwa-offline-panel" aria-labelledby="pwa-offline-title">/);
  assert.match(pwaManager, /beforeinstallprompt/);
  assert.match(pwaManager, /<h2 class="pwa_update_title">Update Available<\/h2>/);
  assert.match(pwaManager, /Lando’s World <span class="pwa_version_token">\$\{escapeHtml\(latestRelease\.releaseVersion\)\}<\/span> is ready/);
  assert.match(pwaManager, /data-pwa-action="update-now"/);
  assert.match(pwaManager, /data-pwa-action="later"/);
  assert.match(pwaManager, /registerUpdateBlocker/);
  assert.match(pwaManager, /The update is taking longer than expected/);
  assert.match(pwaManager, /cache: 'no-store'/);
  assert.match(pwaManager, /navigator\.storage\.persist/);
  assert.match(pwaManager, /navigator\.storage\.estimate/);
  assert.match(digitalClockCss, /\.pwa_network_status/);
  assert.match(digitalClockCss, /\.ecosystem_nav/);
  assert.match(digitalClockCss, /\.is-ecosystem-scrolled \.ecosystem_nav/);
  assert.match(digitalClockCss, /\.lando_settings_link/);
  assert.match(digitalClockCss, /\.lando_settings_shell/);
  assert.match(digitalClockCss, /\.pwa_offline_panel/);
});

test('network status is hidden by centralized child-app state without changing PWA ownership', () => {
  assert.match(html, /function updateEcosystemAppState\(route\)/);
  assert.match(html, /document\.body\.classList\.toggle\('is-child-app-active', isChildApp\)/);
  assert.match(html, /updateEcosystemAppState\(route\);/);
  assert.match(digitalClockCss, /body\.is-child-app-active \.pwa_network_status \{\s*display: none;/);
  assert.match(pwaManager, /navigator\.onLine/);
  assert.match(pwaManager, /window\.addEventListener\('online'/);
  assert.match(pwaManager, /window\.addEventListener\('offline'/);
  assert.match(pwaManager, /id="pwa-offline-panel"/);
});

test('Application Status lives in the ecosystem settings view outside Digital Clock', () => {
  const settingsViewStart = html.indexOf('id="lando-settings-view"');
  const dailyBriefingStart = html.indexOf('id="daily-chief-briefing-view"');
  const clockViewStart = html.indexOf('id="clock-view"');
  const sprintsViewStart = html.indexOf('id="sprints-view"');
  const settingsView = html.slice(settingsViewStart, dailyBriefingStart);
  const digitalClockView = html.slice(clockViewStart, sprintsViewStart);

  assert.ok(settingsViewStart > 0);
  assert.ok(dailyBriefingStart > settingsViewStart);
  assert.ok(sprintsViewStart > clockViewStart);
  assert.match(settingsView, /Lando's World Settings/);
  assert.match(settingsView, /id="pwa-offline-settings" aria-live="polite"/);
  assert.doesNotMatch(digitalClockView, /id="pwa-offline-settings"/);
  assert.match(html, /settings: document\.getElementById\('lando-settings-view'\)/);
  assert.match(html, /if \(viewName === 'settings'\) return "Lando's World Settings"/);
  assert.match(html, /'settings',/);
});

test('PWA settings panel renders directly on the settings screen', async () => {
  const { elements } = createPwaContext();
  await flushAsync();
  const settings = elements['pwa-offline-settings'];

  assert.match(settings.innerHTML, /<section class="pwa_offline_panel" id="pwa-offline-panel" aria-labelledby="pwa-offline-title">/);
  assert.match(settings.innerHTML, /Application Status/);
  assert.match(settings.innerHTML, /<dt>Running Version<\/dt>\s*<dd>Unknown<\/dd>/);
  assert.match(settings.innerHTML, /<dt>Build<\/dt>\s*<dd><code>Unknown<\/code><\/dd>/);
  assert.doesNotMatch(settings.innerHTML, /<dt>Running Build<\/dt>/);
  assert.match(settings.innerHTML, /<dt>Latest Version<\/dt>\s*<dd>Unknown<\/dd>/);
  assert.match(settings.innerHTML, /<dt>Update Status<\/dt>\s*<dd[^>]*>Unable to verify/);
  assert.match(settings.innerHTML, /<dt>Service Worker \/ Cache<\/dt>/);
  assert.match(settings.innerHTML, /Clear Application Cache/);
  assert.match(settings.innerHTML, /Cache cleanup never deletes Lee-Lee's Tracker records or other local app data/);
  assert.doesNotMatch(settings.innerHTML, /toggle-offline-settings|Show Application Status|Hide Application Status|hidden/);
});

test('deployed release is fetched with cache bypass and distinguished from the running build', async () => {
  const runningSha = 'a'.repeat(40);
  const latestSha = 'b'.repeat(40);
  const calls = [];
  const latest = {
    releaseVersion: '2026-09-26-42',
    commitFull: latestSha,
    shortCommit: latestSha.slice(0, 7),
    deploymentRun: '42',
  };
  const { context, elements } = createPwaContext({
    buildMetadata: {
      environment: 'production',
      releaseVersion: '2026-09-26-41',
      commit: runningSha.slice(0, 7),
      commitFull: runningSha,
    },
    fetchImplementation: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => latest };
    },
  });

  await context.LandosPWA.checkForUpdates();

  assert.equal(context.LandosPWA.getState().releaseStatus, 'available');
  assert.equal(context.LandosPWA.getState().latestRelease.commitFull, latestSha);
  assert.ok(elements['pwa-toast'].classList.values.has('pwa_toast--update'));
  assert.match(elements['pwa-toast'].innerHTML, /<h2 class="pwa_update_title">Update Available<\/h2>/);
  assert.match(elements['pwa-toast'].innerHTML, /Lando’s World <span class="pwa_version_token">2026-09-26-42<\/span> is ready/);
  assert.match(elements['pwa-toast'].innerHTML, /You’re currently using <span class="pwa_version_token">2026-09-26-41<\/span>/);
  assert.match(elements['pwa-toast'].innerHTML, /data-pwa-action="update-now"/);
  assert.match(elements['pwa-toast'].innerHTML, /data-pwa-action="later"/);
  assert.match(elements['pwa-offline-settings'].innerHTML, /<dt>Running Version<\/dt>\s*<dd>2026-09-26-41<\/dd>/);
  assert.match(elements['pwa-offline-settings'].innerHTML, new RegExp(`<dt>Build<\\/dt>\\s*<dd><code>${runningSha.slice(0, 7)}</code></dd>`));
  assert.doesNotMatch(elements['pwa-offline-settings'].innerHTML, /<dt>Running Build<\/dt>/);
  assert.match(elements['pwa-offline-settings'].innerHTML, /<dt>Latest Version<\/dt>\s*<dd>2026-09-26-42<\/dd>/);
  assert.match(elements['pwa-offline-settings'].innerHTML, /<dt>Update Status<\/dt>\s*<dd[^>]*>Update available/);
  assert.ok(calls.length >= 1);
  for (const call of calls) {
    assert.equal(call.options.cache, 'no-store');
    assert.equal(new URL(call.url).pathname, '/deployment-version.json');
    assert.ok(new URL(call.url).searchParams.has('check'));
  }
});

test('matching deployed SHA reports current, while offline and bad metadata remain unverified', async () => {
  const sha = 'c'.repeat(40);
  const metadata = {
    releaseVersion: '2026-09-26-7',
    commitFull: sha,
    shortCommit: sha.slice(0, 7),
    deploymentRun: '7',
  };
  const current = createPwaContext({
    buildMetadata: { environment: 'production', releaseVersion: metadata.releaseVersion, commitFull: sha, commit: sha.slice(0, 7) },
    fetchImplementation: async () => ({ ok: true, json: async () => metadata }),
  });
  await current.context.LandosPWA.checkForUpdates();
  assert.equal(current.context.LandosPWA.getState().releaseStatus, 'current');
  assert.match(current.elements['pwa-offline-settings'].innerHTML, /Up to date/);

  const offline = createPwaContext({ onLine: false, buildMetadata: { environment: 'production', releaseVersion: metadata.releaseVersion, commitFull: sha, commit: sha.slice(0, 7) } });
  await offline.context.LandosPWA.checkForUpdates();
  assert.equal(offline.context.LandosPWA.getState().releaseStatus, 'unverified');
  assert.equal(offline.context.LandosPWA.getState().latestRelease, null);
  assert.match(offline.elements['pwa-offline-settings'].innerHTML, /Unable to verify \/ Offline/);

  for (const fetchImplementation of [
    async () => { throw new Error('network failure'); },
    async () => ({ ok: true, json: async () => ({ releaseVersion: 'invalid', commitFull: 'bad' }) }),
    async () => ({ ok: false, status: 503 }),
  ]) {
    const failed = createPwaContext({
      buildMetadata: { environment: 'production', releaseVersion: metadata.releaseVersion, commitFull: sha, commit: sha.slice(0, 7) },
      fetchImplementation,
    });
    await failed.context.LandosPWA.checkForUpdates();
    assert.equal(failed.context.LandosPWA.getState().releaseStatus, 'unverified');
    assert.equal(failed.context.LandosPWA.getState().latestRelease, null);
  }
});

test('redeploying the same SHA with a new display run remains up to date', async () => {
  const sha = 'a'.repeat(40);
  const { context, elements } = createPwaContext({
    buildMetadata: { environment: 'production', releaseVersion: '2026-09-25-8', commit: sha.slice(0, 7), commitFull: sha },
    fetchImplementation: async () => ({ ok: true, json: async () => ({
      releaseVersion: '2026-09-26-9', commitFull: sha, shortCommit: sha.slice(0, 7), deploymentRun: '9',
    }) }),
  });
  await context.LandosPWA.checkForUpdates();
  assert.equal(context.LandosPWA.getState().releaseStatus, 'current');
  assert.equal(elements['pwa-toast'].hidden, true);
});

test('Later hides only the current notice and a foreground-style check can resurface it', async () => {
  const runningSha = 'd'.repeat(40);
  const latestSha = 'e'.repeat(40);
  const { context, elements } = createPwaContext({
    buildMetadata: { environment: 'production', releaseVersion: '2026-09-26-10', commit: runningSha.slice(0, 7), commitFull: runningSha },
    fetchImplementation: async () => ({ ok: true, json: async () => ({ releaseVersion: '2026-09-26-11', commitFull: latestSha, shortCommit: latestSha.slice(0, 7), deploymentRun: '11' }) }),
  });
  await context.LandosPWA.checkForUpdates();
  assert.equal(elements['pwa-toast'].hidden, false);
  context.LandosPWA.dismissUpdate();
  assert.equal(elements['pwa-toast'].hidden, true);
  await context.LandosPWA.checkForUpdates({ resurface: true });
  assert.equal(elements['pwa-toast'].hidden, false);
});

test('ordinary forms and focus are not mistaken for unsaved work', () => {
  const { context } = createPwaContext({ visibleForms: [{ open: true }] });
  context.document.activeElement = { tagName: 'INPUT', value: 'draft' };
  assert.equal(context.LandosPWA.getState().updateBlocked, false);
});

test('explicit update blockers defer activation until work is safe', async () => {
  const runningSha = 'f'.repeat(40);
  const latestSha = '1'.repeat(40);
  let blocked = true;
  let registrationUpdateCalls = 0;
  const registration = {
    update: async () => { registrationUpdateCalls += 1; throw new Error('no worker in unit fixture'); },
    addEventListener() {},
    removeEventListener() {},
  };
  const serviceWorker = {
    controller: null,
    register: async () => registration,
    ready: Promise.resolve(registration),
    addEventListener() {},
    removeEventListener() {},
  };
  const { context, elements } = createPwaContext({
    serviceWorker,
    caches: {},
    buildMetadata: { environment: 'production', releaseVersion: '2026-09-26-12', commit: runningSha.slice(0, 7), commitFull: runningSha },
    fetchImplementation: async () => ({ ok: true, json: async () => ({ releaseVersion: '2026-09-26-13', commitFull: latestSha, shortCommit: latestSha.slice(0, 7), deploymentRun: '13' }) }),
  });
  await flushAsync();
  const initialUpdateCalls = registrationUpdateCalls;
  const unregister = context.LandosPWA.registerUpdateBlocker('test editor', () => blocked && 'Save the test editor first.');
  await context.LandosPWA.checkForUpdates();
  await context.LandosPWA.updateNow();
  assert.equal(registrationUpdateCalls, initialUpdateCalls);
  assert.equal(context.location.reloadCount, 0);
  assert.match(elements['pwa-toast'].innerHTML, /Save the test editor first/);

  blocked = false;
  context.LandosPWA.notifyUpdateSafetyChanged();
  await flushAsync();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await flushAsync();
  assert.ok(registrationUpdateCalls > initialUpdateCalls);
  assert.equal(context.location.reloadCount, 0);
  unregister();
});

test('an update blocker callback failure fails closed', () => {
  const { context, elements } = createPwaContext();
  context.LandosPWA.registerUpdateBlocker('uncertain editor', () => { throw new Error('state unavailable'); });
  assert.equal(context.LandosPWA.getState().updateBlocked, true);
  assert.equal(elements['pwa-toast'].hidden, true);
});

test('repeated Update Now taps share one in-flight release operation', async () => {
  const runningSha = '6'.repeat(40);
  const latestSha = '7'.repeat(40);
  let fetchCalls = 0;
  const registration = { update: async () => { throw new Error('expected test worker absence'); } };
  const serviceWorker = {
    controller: null,
    register: async () => registration,
    ready: Promise.resolve(registration),
    addEventListener() {},
  };
  const { context } = createPwaContext({
    serviceWorker,
    caches: {},
    buildMetadata: { environment: 'production', releaseVersion: '2026-09-26-20', commit: runningSha.slice(0, 7), commitFull: runningSha },
    fetchImplementation: async () => {
      fetchCalls += 1;
      return { ok: true, json: async () => ({ releaseVersion: '2026-09-26-21', commitFull: latestSha, shortCommit: latestSha.slice(0, 7), deploymentRun: '21' }) };
    },
  });
  await flushAsync();
  await context.LandosPWA.checkForUpdates();
  const fetchCountBeforeTap = fetchCalls;
  const first = context.LandosPWA.updateNow();
  const second = context.LandosPWA.updateNow();
  assert.equal(first, second);
  await first;
  assert.equal(fetchCalls, fetchCountBeforeTap + 1);
});

test('a controller build mismatch never reloads another client until that client explicitly asks', async () => {
  const runningSha = '8'.repeat(40);
  const controllerSha = '9'.repeat(40);
  let blocked = true;
  let metadataRequests = 0;
  const controller = {
    postMessage(message, ports = []) {
      if (message.type === 'GET_BUILD_METADATA') {
        metadataRequests += 1;
        ports[0]?.postMessage({ type: 'BUILD_METADATA', requestId: message.requestId, metadata: {
          releaseVersion: '2026-09-26-31', commitFull: controllerSha, shortCommit: controllerSha.slice(0, 7), deploymentRun: '31',
        } });
      }
    },
  };
  const registration = { active: controller, update: async () => {}, addEventListener() {} };
  const serviceWorkerListeners = new Map();
  const serviceWorker = {
    controller,
    register: async () => registration,
    ready: Promise.resolve(registration),
    addEventListener(type, callback) { serviceWorkerListeners.set(type, callback); },
  };
  const { context, elements, documentListeners } = createPwaContext({
    serviceWorker,
    caches: {},
    buildMetadata: { environment: 'production', releaseVersion: '2026-09-26-30', commit: runningSha.slice(0, 7), commitFull: runningSha },
  });
  await flushAsync();
  await new Promise((resolve) => setTimeout(resolve, 10));
  await flushAsync();
  assert.ok(metadataRequests > 0);
  assert.equal(context.LandosPWA.getState().controllerBuildMismatch, controllerSha);
  assert.equal(context.location.reloadCount, 0);
  assert.match(elements['pwa-toast'].innerHTML, /Restart This Tab/);

  const unregister = context.LandosPWA.registerUpdateBlocker('draft', () => blocked && 'Save this draft first.');
  documentListeners.click({ target: { closest: () => ({ dataset: { pwaAction: 'restart-client' } }) } });
  assert.equal(context.location.reloadCount, 0);
  assert.equal(context.LandosPWA.getState().controllerReloadPending, true);
  blocked = false;
  context.LandosPWA.notifyUpdateSafetyChanged();
  await flushAsync();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await flushAsync();
  assert.equal(context.location.reloadCount, 1);
  assert.equal(context.sessionStorage.getItem('landos_world_update_reload_target_v1'), controllerSha);
  assert.ok(serviceWorkerListeners.has('controllerchange'));
  unregister();
});

test('Update Now activates the exact deployed worker before one guarded reload', async () => {
  const runningSha = '2'.repeat(40);
  const latestSha = '3'.repeat(40);
  const listeners = new Map();
  let registration;
  let serviceWorker;
  const makeWorker = (sha, label) => {
    const workerListeners = new Map();
    const worker = {
      state: 'installed',
      scriptURL: 'https://example.com/service-worker.js',
      addEventListener(type, callback) {
        workerListeners.set(type, [...(workerListeners.get(type) || []), callback]);
      },
      removeEventListener(type, callback) {
        workerListeners.set(type, (workerListeners.get(type) || []).filter((item) => item !== callback));
      },
      postMessage(message, ports = []) {
        if (message.type === 'GET_BUILD_METADATA') {
          ports[0]?.postMessage({
            type: 'BUILD_METADATA',
            requestId: message.requestId,
            metadata: { releaseVersion: label, commitFull: sha, shortCommit: sha.slice(0, 7), deploymentRun: label.endsWith('14') ? '14' : '13' },
          });
        }
        if (message.type === 'GET_CACHE_STATUS') {
          ports[0]?.postMessage({ type: 'CACHE_STATUS', requestId: message.requestId, status: { version: sha.slice(0, 7), appCacheReady: true } });
        }
        if (message.type === 'SKIP_WAITING') {
          registration.waiting = null;
          registration.active = worker;
          serviceWorker.controller = worker;
          worker.state = 'activated';
          (listeners.get('controllerchange') || []).forEach((callback) => callback());
          (workerListeners.get('statechange') || []).forEach((callback) => callback());
        }
      },
    };
    return worker;
  };
  const currentWorker = makeWorker(runningSha, '2026-09-26-13');
  const updatedWorker = makeWorker(latestSha, '2026-09-26-14');
  registration = {
    active: currentWorker,
    waiting: null,
    installing: null,
    addEventListener(type, callback) { listeners.set(type, [...(listeners.get(type) || []), callback]); },
    removeEventListener(type, callback) { listeners.set(type, (listeners.get(type) || []).filter((item) => item !== callback)); },
    async update() { this.waiting = updatedWorker; },
  };
  serviceWorker = {
    controller: currentWorker,
    register: async () => registration,
    ready: Promise.resolve(registration),
    addEventListener(type, callback) { listeners.set(type, [...(listeners.get(type) || []), callback]); },
    removeEventListener(type, callback) { listeners.set(type, (listeners.get(type) || []).filter((item) => item !== callback)); },
  };
  const { context } = createPwaContext({
    serviceWorker,
    caches: {},
    buildMetadata: { environment: 'production', releaseVersion: '2026-09-26-13', commit: runningSha.slice(0, 7), commitFull: runningSha },
    fetchImplementation: async () => ({ ok: true, json: async () => ({ releaseVersion: '2026-09-26-14', commitFull: latestSha, shortCommit: latestSha.slice(0, 7), deploymentRun: '14' }) }),
  });
  await flushAsync();
  await context.LandosPWA.checkForUpdates();
  await context.LandosPWA.updateNow();
  assert.equal(context.location.reloadCount, 1);
  assert.equal(serviceWorker.controller, updatedWorker);
  assert.equal(context.sessionStorage.getItem('landos_world_update_reload_target_v1'), latestSha);

  await context.LandosPWA.updateNow();
  assert.equal(context.location.reloadCount, 1);
});

test('worker control timeout offers retry without reloading the old page', async () => {
  const runningSha = '4'.repeat(40);
  const latestSha = '5'.repeat(40);
  const listeners = new Map();
  const worker = {
    state: 'installed',
    postMessage(message, ports = []) {
      if (message.type === 'GET_BUILD_METADATA') ports[0]?.postMessage({ type: 'BUILD_METADATA', requestId: message.requestId, metadata: { releaseVersion: '2026-09-26-16', commitFull: latestSha, shortCommit: latestSha.slice(0, 7), deploymentRun: '16' } });
      if (message.type === 'SKIP_WAITING') this.activationRequested = true;
    },
  };
  const currentWorker = {
    postMessage(message, ports = []) {
      if (message.type === 'GET_BUILD_METADATA') ports[0]?.postMessage({ type: 'BUILD_METADATA', requestId: message.requestId, metadata: { releaseVersion: '2026-09-26-15', commitFull: runningSha, shortCommit: runningSha.slice(0, 7), deploymentRun: '15' } });
      if (message.type === 'GET_CACHE_STATUS') ports[0]?.postMessage({ type: 'CACHE_STATUS', requestId: message.requestId, status: { version: runningSha.slice(0, 7), appCacheReady: true } });
    },
  };
  const registration = {
    active: currentWorker,
    waiting: worker,
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener() {},
    async update() {},
  };
  const serviceWorker = {
    controller: currentWorker,
    register: async () => registration,
    ready: Promise.resolve(registration),
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener() {},
  };
  const { context, elements } = createPwaContext({
    serviceWorker,
    caches: {},
    timerDelay: 2,
    buildMetadata: { environment: 'production', releaseVersion: '2026-09-26-15', commit: runningSha.slice(0, 7), commitFull: runningSha },
    fetchImplementation: async () => ({ ok: true, json: async () => ({ releaseVersion: '2026-09-26-16', commitFull: latestSha, shortCommit: latestSha.slice(0, 7), deploymentRun: '16' }) }),
  });
  await flushAsync();
  await context.LandosPWA.checkForUpdates();
  await context.LandosPWA.updateNow();
  assert.equal(worker.activationRequested, true);
  assert.equal(context.location.reloadCount, 0);
  assert.match(elements['pwa-toast'].innerHTML, /Retry Update/);
});

test('a worker with an unverified or different SHA is never activated', async () => {
  const runningSha = 'a'.repeat(40);
  const deployedSha = 'b'.repeat(40);
  let activationRequested = false;
  const wrongWorker = {
    state: 'installed',
    postMessage(message, ports = []) {
      if (message.type === 'GET_BUILD_METADATA') {
        ports[0]?.postMessage({ type: 'BUILD_METADATA', requestId: message.requestId, metadata: {
          releaseVersion: '2026-09-26-44', commitFull: 'c'.repeat(40), shortCommit: 'c'.repeat(7), deploymentRun: '44',
        } });
      }
      if (message.type === 'SKIP_WAITING') activationRequested = true;
    },
  };
  const registration = {
    waiting: wrongWorker,
    active: null,
    update: async () => {},
    addEventListener() {},
    removeEventListener() {},
  };
  const serviceWorker = {
    controller: null,
    register: async () => registration,
    ready: Promise.resolve(registration),
    addEventListener() {},
  };
  const { context } = createPwaContext({
    serviceWorker,
    caches: {},
    timerDelay: 2,
    buildMetadata: { environment: 'production', releaseVersion: '2026-09-26-43', commit: runningSha.slice(0, 7), commitFull: runningSha },
    fetchImplementation: async () => ({ ok: true, json: async () => ({
      releaseVersion: '2026-09-26-44', commitFull: deployedSha, shortCommit: deployedSha.slice(0, 7), deploymentRun: '44',
    }) }),
  });
  await flushAsync();
  await context.LandosPWA.checkForUpdates();
  await context.LandosPWA.updateNow();
  assert.equal(activationRequested, false);
  assert.equal(context.location.reloadCount, 0);
});

test('PWA panel reports browser connection separately from installation status', () => {
  const { context, elements, windowListeners } = createPwaContext({
    onLine: false,
    standalone: false,
  });

  assert.match(elements['pwa-offline-settings'].innerHTML, /<dt>Connection<\/dt>\s*<dd class="[^"]*">Offline<\/dd>/);
  assert.match(elements['pwa-offline-settings'].innerHTML, /<dt>Application Installed<\/dt>\s*<dd class="[^"]*">No<\/dd>/);
  assert.match(elements['pwa-offline-settings'].innerHTML, /<dt>Offline Ready<\/dt>\s*<dd class="[^"]*">Unavailable<\/dd>/);

  context.navigator.onLine = true;
  windowListeners.online[0]();
  assert.match(elements['pwa-offline-settings'].innerHTML, /<dt>Connection<\/dt>\s*<dd class="[^"]*">Online<\/dd>/);
  assert.match(elements['pwa-offline-settings'].innerHTML, /<dt>Application Installed<\/dt>\s*<dd class="[^"]*">No<\/dd>/);

  context.navigator.onLine = false;
  windowListeners.offline[0]();
  assert.match(elements['pwa-offline-settings'].innerHTML, /<dt>Connection<\/dt>\s*<dd class="[^"]*">Offline<\/dd>/);
});

test('PWA panel marks offline readiness from app-shell cache status', async () => {
  const messages = [];
  const serviceWorker = {
    controller: {
      postMessage(message, ports = []) {
        messages.push(message);
        ports[0]?.postMessage({
          type: 'CACHE_STATUS',
          requestId: message.requestId,
          status: {
            appCacheReady: true,
            cachedRequestCount: 42,
            version: '2026-08-05-1',
            updatedAt: '2026-08-04T22:45:00.000Z',
          },
        });
      },
    },
    ready: Promise.resolve({ active: true }),
    register: () => Promise.resolve({ active: true, addEventListener: () => {} }),
    addEventListener: () => {},
  };
  const { elements } = createPwaContext({
    serviceWorker,
    caches: {},
  });
  await flushAsync();

  assert.ok(messages.some((message) => message.type === 'GET_CACHE_STATUS'));
  assert.match(elements['pwa-offline-settings'].innerHTML, /<dt>Service Worker \/ Cache<\/dt>\s*<dd title="2026-08-05-1"><code>2026-08-05-1<\/code><\/dd>/);
  assert.match(elements['pwa-offline-settings'].innerHTML, /<dt>Offline Ready<\/dt>\s*<dd class="[^"]*">Ready<\/dd>/);
  assert.doesNotMatch(elements['pwa-offline-settings'].innerHTML, /Preparing<\/dd>/);
  assert.doesNotMatch(elements['pwa-offline-settings'].innerHTML, /<dt>Last Cache Update<\/dt>\s*<dd>Not available<\/dd>/);
});

test('PWA panel reports first active-but-uncontrolled load as Ready after refresh', async () => {
  const activeWorker = {
    state: 'activated',
    scriptURL: 'http://localhost:8000/service-worker.js',
    postMessage(message, ports = []) {
      ports[0]?.postMessage({
        type: 'CACHE_STATUS',
        requestId: message.requestId,
        status: {
          appCacheReady: true,
          cachedRequestCount: 42,
          updatedAt: '2026-08-04T22:45:00.000Z',
        },
      });
    },
  };
  const serviceWorker = {
    controller: null,
    ready: Promise.resolve({ active: activeWorker, scope: 'http://localhost:8000/' }),
    register: () => Promise.resolve({
      active: activeWorker,
      scope: 'http://localhost:8000/',
      addEventListener: () => {},
    }),
    addEventListener: () => {},
  };
  const { elements } = createPwaContext({
    serviceWorker,
    caches: {},
  });
  await flushAsync();

  assert.match(elements['pwa-offline-settings'].innerHTML, /<dt>Offline Ready<\/dt>\s*<dd class="[^"]*">Ready after refresh<\/dd>/);
  assert.match(elements['pwa-offline-settings'].innerHTML, /<dt>Last Cache Update<\/dt>\s*<dd>(?!Not available)/);
});

test('PWA panel reports registration and cache support failures instead of staying on Preparing', async () => {
  const failingServiceWorker = {
    ready: Promise.resolve({ active: true }),
    register: () => Promise.reject(new Error('registration failed')),
    addEventListener: () => {},
  };
  const failed = createPwaContext({
    serviceWorker: failingServiceWorker,
    caches: {},
  });
  await flushAsync();
  assert.match(failed.elements['pwa-offline-settings'].innerHTML, /<dt>Offline Ready<\/dt>\s*<dd class="[^"]*">Error<\/dd>/);

  const unsupported = createPwaContext({ serviceWorker: { addEventListener: () => {} } });
  assert.match(unsupported.elements['pwa-offline-settings'].innerHTML, /<dt>Offline Ready<\/dt>\s*<dd class="[^"]*">Unavailable<\/dd>/);
});

test('PWA panel reports service-worker cache lookup failures as Error', async () => {
  const serviceWorker = {
    controller: {
      postMessage(message, ports = []) {
        ports[0]?.postMessage({
          type: 'CACHE_STATUS_ERROR',
          requestId: message.requestId,
          message: 'Cache status unavailable.',
        });
      },
    },
    ready: Promise.resolve({ active: true }),
    register: () => Promise.resolve({ active: true, addEventListener: () => {} }),
    addEventListener: () => {},
  };
  const { elements } = createPwaContext({
    serviceWorker,
    caches: {},
  });
  await flushAsync();

  assert.match(elements['pwa-offline-settings'].innerHTML, /<dt>Offline Ready<\/dt>\s*<dd class="[^"]*">Error<\/dd>/);
  assert.match(sw, /CACHE_STATUS_ERROR/);
  assert.match(sw, /APPLICATION_CACHES_REBUILD_FAILED/);
});

test('PWA status handshake uses request IDs, a timeout, and controllerchange retry', () => {
  assert.match(pwaManager, /const requestId = `pwa-status-\$\{Date\.now\(\)\}-\$\{\+\+statusRequestSequence\}`/);
  assert.match(pwaManager, /if \(message\.requestId !== requestId\) return;/);
  assert.match(pwaManager, /setTimeout\(\(\) => \{/);
  assert.match(pwaManager, /STATUS_REQUEST_TIMEOUT_MS/);
  assert.match(pwaManager, /channel\.port1\.onmessage = null;/);
  assert.match(pwaManager, /requestServiceWorkerStatus\(activeRegistration\)/);
  assert.match(pwaManager, /target\.worker\.postMessage\(\{ type: 'GET_CACHE_STATUS', requestId \}, \[channel\.port2\]\)/);
  assert.match(pwaManager, /function trackInstallingWorker\(worker, registration\)/);
  assert.match(pwaManager, /worker\.state === 'redundant'/);
  assert.doesNotMatch(pwaManager, /registration\.update\?\.\(\)/);
});

test('PWA panel displays storage usage without huge browser quota values', async () => {
  const usage = 18.6 * 1024 * 1024;
  const quota = 951394.2 * 1024 * 1024;
  const { elements } = createPwaContext({
    storage: {
      estimate: () => Promise.resolve({ usage, quota }),
      persist: () => Promise.resolve(false),
    },
  });
  await flushAsync();

  assert.match(elements['pwa-offline-settings'].innerHTML, /<dt>Storage Used<\/dt>\s*<dd>18\.6 MB<\/dd>/);
  assert.doesNotMatch(elements['pwa-offline-settings'].innerHTML, /951394\.2 MB| of /);
});

test('service worker reports real cache metadata rather than current render time', () => {
  assert.match(sw, /const CACHE_METADATA_URL = '\.\/__landos-world-cache-metadata\.json'/);
  assert.match(sw, /async function writeCacheMetadata\(eventType\)/);
  assert.match(sw, /await writeCacheMetadata\(eventType\)/);
  assert.match(sw, /const metadata = await readCacheMetadata\(\)/);
  assert.match(sw, /updatedAt: metadata\?\.updatedAt \|\| null/);
  assert.doesNotMatch(sw, /updatedAt: new Date\(\)\.toISOString\(\),\n\s*};\n}/);
});

test('offline-first shell keeps Google font CSS limited to Digital Clock Orbitron', () => {
  assert.match(digitalClockCss, /@import url\('https:\/\/fonts\.googleapis\.com\/css\?family=Orbitron&display=swap'\);/);
  assert.doesNotMatch(sprintsCss, /fonts\.googleapis\.com/);
  assert.doesNotMatch(roadBikeCss, /fonts\.googleapis\.com/);
});

test('manifest is installable and exposes first-class app shortcuts', () => {
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'portrait-primary');
  const shortcutUrls = manifest.shortcuts.map((shortcut) => shortcut.url);
  assert.deepEqual(shortcutUrls, [
    '/landos-world/#/weather',
    '/landos-world/#/digital-clock',
    '/landos-world/#/lee-lees-tracker',
    '/landos-world/#/violet-sprints',
    '/landos-world/#/violet-futbol-game-tracker',
  ]);
  const vfgtShortcut = manifest.shortcuts.find((shortcut) => shortcut.url === '/landos-world/#/violet-futbol-game-tracker');
  assert.equal(vfgtShortcut.icons[0].src, '/landos-world/icons/violet-futbol-game-tracker.png');
});
