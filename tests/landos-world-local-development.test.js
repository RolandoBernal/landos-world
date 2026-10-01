import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generateMetadata } from '../scripts/dev-local.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('authentication preview metadata generation does not overwrite ordinary development identity', async () => {
  const before = await read('.local/landos-world-build-metadata.js').catch(() => null);
  const metadata = await generateMetadata({ environment: 'local-auth-preview', includeUntracked: false, write: false });
  assert.equal(metadata.environment, 'local-auth-preview');
  assert.equal(await read('.local/landos-world-build-metadata.js').catch(() => null), before);
  const packageData = JSON.parse(await read('package.json'));
  assert.equal(packageData.scripts['dev:iphone:auth'], 'node scripts/dev-iphone.mjs --auth-preview');
});

test('canonical local development contract is explicit', async () => {
  const [server, packageJson, readme, playwright] = await Promise.all([
    read('scripts/dev-local.mjs'),
    read('package.json'),
    read('README.md'),
    read('playwright.config.js'),
  ]);
  const packageData = JSON.parse(packageJson);

  assert.equal(packageData.scripts.dev, 'node scripts/dev-local.mjs');
  assert.equal(packageData.scripts['dev:iphone'], 'node scripts/dev-iphone.mjs');
  assert.match(server, /const DEFAULT_PORT = 8000;/);
  assert.match(server, /Serving current working tree/);
  assert.match(server, /Cache-Control': 'no-store'/);
  assert.match(server, /EADDRINUSE/);
  assert.match(readme, /http:\/\/127\.0\.0\.1:8000\//);
  assert.match(playwright, /process\.env\.LANDOS_WORLD_SMOKE_PORT \|\| '8000'/);
  assert.match(playwright, /node scripts\/dev-local\.mjs --port/);
});

test('local metadata is loopback-only and App Information is read-only', async () => {
  const [html, tracker, fallback] = await Promise.all([
    read('index.html'),
    read('js/lee-lee-diabetes-tracker.js'),
    read('js/landos-world-build-metadata.js'),
  ]);

  assert.match(html, /js\/landos-world-build-metadata\.js/);
  assert.match(html, /127\.0\.0\.1/);
  assert.match(html, /\.local\/landos-world-build-metadata\.js/);
  assert.match(tracker, /renderSettingsAccordion\('App Information'/);
  assert.match(tracker, /Read-only source and runtime information/);
  assert.match(tracker, /window\.LandoWorldBuildMetadata/);
  assert.match(fallback, /environment: 'unknown'/);
  assert.doesNotMatch(tracker, /localStorage\.clear\(/);
});
