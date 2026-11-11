// Regression coverage for the Violet Dineros sheet-page draft loss on
// history restoration (pre-merge correction for PR #232, finding 2).
//
// The app's pageshow handler re-renders, and the render used to rebuild
// an open sheet page from its pristine markup — erasing typed draft
// values and the submit/cancel handlers wired against the live DOM —
// whenever the browser restored the page from the back/forward cache.
// These tests therefore exercise a GENUINE bfcache restore: they serve
// the app without Cache-Control: no-store (both repo dev servers send
// no-store, which makes pages ineligible for bfcache), launch the full
// Chromium build without Playwright's default --disable-back-forward-cache
// launch arg, and assert the recorded pageshow event reports
// persisted === true before checking the draft. A synthetic pageshow
// event is not a substitute. The final test covers the ordinary
// non-persisted navigation path.
import { test, expect, chromium } from '@playwright/test';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.ico': 'image/x-icon' };
const KEY = 'lando-world:lwvd:v1';

let server;
let base;
test.beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/__away.html') {
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' });
      return res.end('<!doctype html><title>Away</title><p>away</p>');
    }
    try {
      const file = normalize(join(ROOT, path.endsWith('/') ? `${path}index.html` : path));
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(body);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => { await new Promise((resolve) => server.close(resolve)); });

// The default headless shell cannot enter bfcache; drive the full
// Chromium build from the same Playwright registry install instead.
function fullChromiumPath() {
  const shell = chromium.executablePath();
  const registry = dirname(dirname(dirname(shell))); // .../chromium_headless_shell-<rev>/<platform>/<binary>
  for (const entry of readdirSync(registry)) {
    if (!/^chromium-\d+$/.test(entry)) continue;
    const dir = join(registry, entry);
    for (const platform of readdirSync(dir)) {
      const candidate = join(dir, platform, 'chrome');
      if (existsSync(candidate)) return candidate;
    }
  }
  return shell;
}

async function openApp() {
  const browser = await chromium.launch({
    executablePath: fullChromiumPath(),
    ignoreDefaultArgs: ['--disable-back-forward-cache'],
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const date = new Date(); date.setDate(date.getDate() + 3);
  const payday = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  await page.addInitScript(({ KEY, payday }) => {
    window.__persistedEvents = [];
    addEventListener('pageshow', (event) => window.__persistedEvents.push(event.persisted));
    localStorage.setItem(KEY, JSON.stringify({ firstName: 'Max', balanceCents: 15000, payday, frequency: 'monthly', onboarded: true }));
  }, { KEY, payday });
  await page.goto(`${base}/#/violet-dineros`);
  await expect(page.getByRole('heading', { name: 'Hey, Max!' })).toBeVisible();
  return { browser, page };
}

async function openExpenseDraft(page) {
  await page.locator('#quick-actions-toggle').click();
  await page.getByRole('button', { name: 'Add Expense', exact: true }).click();
  await page.getByLabel('How much?', { exact: true }).fill('12.34');
  await page.getByLabel('What was it? (optional)', { exact: true }).fill('DraftCheck');
}

async function awayAndBack(page) {
  await page.goto(`${base}/__away.html`, { waitUntil: 'domcontentloaded' });
  // A bfcache-restored document does not re-fire the load states
  // Playwright waits for by default; commit is the reliable signal,
  // and the assertions below poll for the restored state.
  await page.goBack({ waitUntil: 'commit' });
  await expect.poll(() => page.evaluate(() => window.__persistedEvents.length)).toBe(2);
  const persisted = await page.evaluate(() => window.__persistedEvents);
  expect(persisted[1]).toBe(true); // the restore genuinely came from bfcache
}

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'drives its own full-Chromium instance');
});

test('bfcache restore preserves an expense draft and its submit handler', async () => {
  const { browser, page } = await openApp();
  try {
    await openExpenseDraft(page);
    await awayAndBack(page);
    await expect(page.getByLabel('How much?', { exact: true })).toHaveValue('12.34');
    await expect(page.getByLabel('What was it? (optional)', { exact: true })).toHaveValue('DraftCheck');
    // The handlers wired when the page opened must still be live.
    await page.getByLabel('Category', { exact: true }).selectOption({ label: 'Food' });
    await page.getByRole('button', { name: 'Save expense' }).click();
    await expect(page.locator('#notice')).toContainText('Expense saved.');
    await expect(page.locator('.balance')).toContainText('$137.66');
    const stored = await page.evaluate((KEY) => JSON.parse(localStorage.getItem(KEY)), KEY);
    expect(stored.transactions).toHaveLength(1);
    expect(stored.transactions[0].amountCents).toBe(1234);
  } finally { await browser.close(); }
});

test('bfcache restore preserves the cancel handler', async () => {
  const { browser, page } = await openApp();
  try {
    await openExpenseDraft(page);
    await awayAndBack(page);
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Hey, Max!' })).toBeVisible();
    await expect(page.locator('.balance')).toContainText('$150.00');
    const stored = await page.evaluate((KEY) => JSON.parse(localStorage.getItem(KEY)), KEY);
    expect(stored.transactions || []).toHaveLength(0);
  } finally { await browser.close(); }
});

test('ordinary fresh navigation still boots cleanly', async () => {
  const { browser, page } = await openApp();
  try {
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Hey, Max!' })).toBeVisible();
    await expect(page.locator('.balance')).toContainText('$150.00');
    const persisted = await page.evaluate(() => window.__persistedEvents);
    expect(persisted).toEqual([false]); // a reload builds a fresh document; no restore event
  } finally { await browser.close(); }
});
