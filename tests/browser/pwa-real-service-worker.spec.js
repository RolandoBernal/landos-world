import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};

let temporaryRoot;
let artifactRoot;
let server;
let baseUrl;
let serveDeployedWorker = false;
let isolateLoopbackGuard = false;
let deploymentRequests = 0;
let fixtureNetworkUnavailable = false;
const fullSha = 'c'.repeat(40);
const shortSha = fullSha.slice(0, 7);
const releaseVersion = '2026-09-26-99';
const builtAt = '2026-09-26T22:59:00.000Z';
const legacyWorker = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('message', (event) => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
`;

const expectedCacheNames = ['app', 'runtime', 'weather', 'images', 'fonts']
  .map((kind) => `landos-world-${kind}-${fullSha}`);

function expectCachesPreserved(before, after, requiredUrls) {
  const current = new Map(after);
  for (const [name] of [...before, ...after]) {
    expect(expectedCacheNames, `known cache identity: ${name}`).toContain(name);
  }
  for (const [name, urls] of before) {
    expect(current.has(name), `cache retained: ${name}`).toBe(true);
    expect(current.get(name), `entries retained in ${name}`).toEqual(expect.arrayContaining(urls));
  }
  const appCacheName = `landos-world-app-${fullSha}`;
  for (const snapshot of [before, after]) {
    expect(new Map(snapshot).get(appCacheName), 'required application assets').toEqual(expect.arrayContaining(requiredUrls));
  }
}

async function cacheSnapshot(page) {
  return page.evaluate(async () => Promise.all((await caches.keys()).map(async (name) => [
    name, (await (await caches.open(name)).keys()).map((request) => request.url),
  ])));
}

async function requiredAssetDigests(page, urls) {
  return page.evaluate(async ({ name, assets }) => {
    // Do not create a missing cache while measuring it.
    if (!(await caches.keys()).includes(name)) return null;
    const cache = await caches.open(name);
    return Promise.all(assets.map(async (url) => {
      const response = await cache.match(url);
      if (!response) return { url, missing: true };
      const body = await response.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', body);
      return { url, status: response.status, bytes: body.byteLength,
        digest: [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('') };
    }));
  }, { name: `landos-world-app-${fullSha}`, assets: urls });
}

test.beforeEach(() => {
  // Browser contexts are fresh, but this worker's HTTP fixture is shared.
  serveDeployedWorker = false;
  isolateLoopbackGuard = false;
  deploymentRequests = 0;
  fixtureNetworkUnavailable = false;
});

test.beforeAll(async () => {
  temporaryRoot = await mkdtemp(join(tmpdir(), 'landos-pages-build-'));
  artifactRoot = join(temporaryRoot, 'artifact');
  const build = spawnSync(process.execPath, [join(repoRoot, 'scripts/build-pages.mjs')], {
    cwd: repoRoot,
    env: {
      ...process.env,
      LANDOS_PAGES_OUTPUT_DIR: artifactRoot,
      LANDOS_BUILD_SHA: fullSha,
      LANDOS_RELEASE_VERSION: releaseVersion,
      LANDOS_BUILT_AT: builtAt,
      LANDOS_DEPLOYMENT_RUN: '99',
    },
    encoding: 'utf8',
  });
  if (build.status !== 0) throw new Error(`Pages artifact build failed: ${build.stderr}`);

  server = createServer(async (request, response) => {
    if (fixtureNetworkUnavailable) { request.socket.destroy(); return; }
    const pathname = new URL(request.url || '/', 'http://localhost').pathname;
    if (pathname === '/service-worker.js' && !serveDeployedWorker) {
      response.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': 'text/javascript; charset=utf-8' });
      response.end(legacyWorker);
      return;
    }
    if (pathname === '/__pwa-integration__.html') {
      const releaseAwareScripts = serveDeployedWorker
        ? '<script src="/js/landos-world-build-metadata.js"></script>'
        : '<script>window.LandoWorldBuildMetadata = Object.freeze({ environment: "legacy", commitFull: "" });</script>';
      response.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': 'text/html; charset=utf-8' });
      response.end(`<!doctype html><html><head><meta charset="utf-8">${releaseAwareScripts}</head><body>
        <button id="legacy-restart" type="button" hidden>Restart</button>
        <script>
          let legacyRestartRequested = false;
          const legacyRestartButton = document.querySelector('#legacy-restart');
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (legacyRestartRequested) location.reload();
          });
          navigator.serviceWorker.register('./service-worker.js').then(async (registration) => {
            window.testRegistration = registration;
            const showLegacyWaitingAction = () => { legacyRestartButton.hidden = !registration.waiting; };
            registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', showLegacyWaitingAction));
            await navigator.serviceWorker.ready;
            showLegacyWaitingAction();
          });
          legacyRestartButton.addEventListener('click', () => {
            legacyRestartRequested = true;
            window.testRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
          });
        </script>
      </body></html>`);
      return;
    }
    if (pathname === '/deployment-version.json') deploymentRequests += 1;
    const relativePath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
    const filePath = resolve(artifactRoot, relativePath);
    if (filePath !== artifactRoot && !filePath.startsWith(`${artifactRoot}/`)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }
    try {
      let body = await readFile(filePath);
      if (isolateLoopbackGuard && filePath.endsWith('index.html')) {
        // Keep the offline fixture shell from invoking loopback-only development behavior.
        body = Buffer.from(body.toString().replace(/<script src="js\/pwa-manager\.js[^"]*"><\/script>/, '')
          .replace("['localhost', '127.0.0.1', '[::1]', '::1']", "['offline-fixture-unused']"));
      }
      response.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404, { 'Cache-Control': 'no-store' });
      response.end('Not found');
    }
  });
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => {
  if (server) await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
});

test('legacy waiting-worker restart message migrates to the real deployed worker identity and network-only release endpoint', async ({ page }) => {
  await page.goto(`${baseUrl}/__pwa-integration__.html`);
  await page.evaluate(async () => {
    if (!window.testRegistration) window.testRegistration = await navigator.serviceWorker.register('./service-worker.js');
    await navigator.serviceWorker.ready;
  });
  expect(await page.evaluate(() => window.LandoWorldBuildMetadata.environment)).toBe('legacy');
  expect(await page.evaluate(() => Boolean(window.LandosPWA))).toBe(false);
  const lwvdRecord = {firstName:'Violet',balanceCents:10000,payday:'',frequency:'',onboarded:true,transactions:[{id:'preserved-income',type:'income',amountCents:350,label:'Gift',description:'Saved before update',createdAt:'2026-10-23T12:00:00.000Z'}]};
  await page.evaluate(record=>localStorage.setItem('lando-world:lwvd:v1',JSON.stringify(record)),lwvdRecord);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  serveDeployedWorker = true;
  await page.evaluate(() => window.testRegistration.update());
  await expect.poll(() => page.evaluate(() => window.testRegistration.waiting?.state)).toBe('installed');
  expect(await page.evaluate(() => window.testRegistration.waiting !== null)).toBe(true);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'load' }),
    page.getByRole('button', { name: 'Restart' }).click(),
  ]);
  await expect.poll(() => page.evaluate(() => window.LandoWorldBuildMetadata?.commitFull)).toBe(fullSha);

  const identity = await page.evaluate(async () => {
    const workerMetadata = await new Promise((resolveMetadata, rejectMetadata) => {
      const channel = new MessageChannel();
      const timeout = setTimeout(() => rejectMetadata(new Error('worker identity response timed out')), 5000);
      channel.port1.onmessage = ({ data }) => {
        clearTimeout(timeout);
        resolveMetadata(data.metadata);
      };
      navigator.serviceWorker.controller.postMessage({ type: 'GET_BUILD_METADATA', requestId: 'real-worker-test' }, [channel.port2]);
    });
    const staleIdentity = {
      releaseVersion: '2026-09-25-1',
      commitFull: 'd'.repeat(40),
      shortCommit: 'ddddddd',
      deploymentRun: '1',
    };
    const appCache = await caches.open(`landos-world-app-${workerMetadata.commitFull}`);
    await appCache.put(new Request(new URL('deployment-version.json', location.href)), new Response(JSON.stringify(staleIdentity), {
      headers: { 'Content-Type': 'application/json' },
    }));
    const releaseResponse = await fetch(`./deployment-version.json?integration=${Date.now()}`, { cache: 'no-store' });
    return {
      workerMetadata,
      pageMetadata: window.LandoWorldBuildMetadata,
      endpointMetadata: await releaseResponse.json(),
      endpointStatus: releaseResponse.status,
    };
  });

  expect(identity.endpointStatus).toBe(200);
  for (const metadata of [identity.workerMetadata, identity.pageMetadata, identity.endpointMetadata]) {
    expect(metadata.releaseVersion).toBe(releaseVersion);
    expect(metadata.commitFull).toBe(fullSha);
    expect(metadata.shortCommit).toBe(shortSha);
    expect(metadata.commit).toBe(shortSha);
    expect(metadata.deploymentRun).toBe('99');
  }
  expect(identity.workerMetadata.commitFull).not.toBe('d'.repeat(40));
  expect(deploymentRequests).toBeGreaterThan(0);
  expect(identity.endpointMetadata.commitFull).toBe(identity.pageMetadata.commitFull);
  expect(identity.pageMetadata.commitFull === identity.endpointMetadata.commitFull ? 'current' : 'available').toBe('current');
  fixtureNetworkUnavailable = true;
  expect(await page.evaluate(async () => {
    const font = new FontFace('Offline Geist Probe', 'url(./fonts/geist-mono-variable.woff2)');
    await font.load(); return font.status;
  })).toBe('loaded');
  fixtureNetworkUnavailable = false;
  await page.goto(`${baseUrl}/violet-dineros/index.html`);
  await expect(page.locator('.story')).toHaveText('You have$103.50right now.');
  expect(await page.evaluate(async()=>{const faces=await document.fonts.load('16px "Geist Mono"');return faces.length>0&&faces.every(face=>face.status==='loaded');})).toBe(true);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('lando-world:lwvd:v1')))).toEqual(lwvdRecord);

});

test('cache preservation invariant accepts additions but rejects asset loss and unexpected identities', () => {
  const app = `landos-world-app-${fullSha}`;
  const asset = 'https://fixture.invalid/js/lee-lee-diabetes-tracker.js';
  const original = [[app, [asset, 'https://fixture.invalid/index.html']]];
  expectCachesPreserved(original, [[app, [...original[0][1]].reverse().concat('https://cdn.jsdelivr.net/dependency.js')]], [asset]);
  expect(() => expectCachesPreserved(original, [[app, [asset]]], [asset])).toThrow();
  expect(() => expectCachesPreserved(original, [], [asset])).toThrow();
  expect(() => expectCachesPreserved(original, [...original, ['unexpected-cache', []]], [asset])).toThrow();
  expect(() => expectCachesPreserved([[app, []]], [[app, []]], [asset])).toThrow();
});

test('personalized launcher survives an offline reload and hiding preserves cached child assets', async ({ page }) => {
  serveDeployedWorker = true;
  // The production manager intentionally unregisters workers on loopback hosts.
  // Isolate that development guard; use the real built worker and full shell here.
  isolateLoopbackGuard = true;
  await page.goto(`${baseUrl}/#/settings`);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('./service-worker.js');
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.getByRole('button', { name: 'Use Recommended Apps' }).click();
  const requiredUrls = ['/js/lee-lee-diabetes-tracker.js', '/js/launcher-preferences.js']
    .map((path) => new URL(path, baseUrl).href);
  const before = await cacheSnapshot(page);
  const beforeAssets = await requiredAssetDigests(page, requiredUrls);
  expect(beforeAssets).toHaveLength(requiredUrls.length);
  for (const asset of beforeAssets) {
    expect(asset.status).toBe(200);
    expect(asset.bytes).toBeGreaterThan(0);
  }
  await page.locator('[data-my-app-id="lee-lees-tracker"]').uncheck();
  const after = await cacheSnapshot(page);
  // Dependency requests can legitimately add entries during initialization.
  // Hiding an app must retain every previous entry and required asset body.
  expectCachesPreserved(before, after, requiredUrls);
  expect(await requiredAssetDigests(page, requiredUrls)).toEqual(beforeAssets);
  await page.locator('[data-my-app-for="weather"][data-my-app-move="up"]').click();
  // Make the fixture origin unreachable: exercise real worker fallback in both
  // engines without WebKit's context-offline reload API error.
  fixtureNetworkUnavailable = true;
  await page.goto(`${baseUrl}/#/`);
  await page.reload();
  await expect(page.locator('#lando-launcher .clock_utility_card')).toHaveCount(2);
  expect(await page.locator('#lando-launcher [data-route]').evaluateAll((buttons) => buttons.map((button) => button.dataset.route))).toEqual(['weather', 'digital-clock']);
  await page.goto(`${baseUrl}/#/settings`);
  await page.locator('[data-my-app-for="digital-clock"][data-my-app-move="up"]').click();
  await page.reload();
  expect(await page.locator('#my-apps-list > li').evaluateAll((rows) => rows.slice(0, 2).map((row) => row.dataset.myAppRow))).toEqual(['digital-clock', 'weather']);
  await expect(page.locator('[data-my-app-id="lee-lees-tracker"]')).not.toBeChecked();
  expectCachesPreserved(before, await cacheSnapshot(page), requiredUrls);
  expect(await requiredAssetDigests(page, requiredUrls)).toEqual(beforeAssets);
  await page.goto(`${baseUrl}/#/lee-lees-tracker`);
  await expect(page.locator('#lee-lees-tracker-view')).toBeVisible();
});
