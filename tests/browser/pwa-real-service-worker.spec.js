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
let deploymentRequests = 0;
const fullSha = 'c'.repeat(40);
const shortSha = fullSha.slice(0, 7);
const releaseVersion = '2026-09-26-99';
const builtAt = '2026-09-26T22:59:00.000Z';
const legacyWorker = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('message', (event) => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
`;

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
      const body = await readFile(filePath);
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

});
