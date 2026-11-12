import { expect, test } from '@playwright/test';
import { createIPhoneDevServer } from '../../scripts/dev-iphone.mjs';

let server;
let baseURL;
const key = 'lando-world:lee-lees-tracker:v1';
test.beforeAll(async () => {
  server = createIPhoneDevServer({ bindAddress: { address: '127.0.0.1', netmask: '255.0.0.0' }, getMetadata: async () => ({ environment: 'local-device', appVersion: '1.0.0', branch: 'fix/llt-history-reports-scroll', commit: 'test', commitFull: 'test', dirty: true, sourceId: 'history-reports-scroll-test' }) });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  baseURL = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => { if (server?.listening) await new Promise(resolve => server.close(resolve)); });

// Enough entries over the last two days that History and Reports both
// run well past one screen at phone size.
const now = Date.now();
const records = Array.from({ length: 40 }, (_, i) => ({
  id: `scroll-record-${i}`,
  eventType: 'note',
  type: 'Other',
  notes: `Scroll record ${i}`,
  recordTimestamp: new Date(now - i * 3600000).toISOString(),
  timestamp: now - i * 3600000,
  createdAt: new Date(now).toISOString(),
  updatedAt: new Date(now).toISOString(),
}));

// Exercise the actual tracker callbacks used by production sync, without
// connecting a test browser to a user's Supabase account. Same harness as
// llt-favorite-scroll.spec.js.
async function exposeSyncCallbacks(page) {
  await page.addInitScript(() => {
    let api;
    Object.defineProperty(window, 'LeeLeeTrackerSync', {
      configurable: true,
      get: () => api,
      set(value) {
        api = { ...value, createRepository(options) {
          const repository = value.createRepository(options);
          window.testRemoteLibrary = (patch = {}) => {
            const data = options.getDocument();
            const next = { ...data, ...patch };
            options.saveDocument(next, { keepStatus: true });
            options.onRemoteChange(next);
          };
          return { ...repository, subscribe(listener) {
            window.testSyncStatus = (status = {}) => listener({ ...repository.getSyncStatus(), ...status });
            return repository.subscribe(listener);
          } };
        } };
      },
    });
  });
}

async function open(page, view) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.addInitScript(({ key, records }) => {
    localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, records, settings: { glucoseTargetMin: 70, glucoseTargetMax: 180 }, insulinPlans: [], foodLibrary: [], savedMeals: [], metadata: {} }));
  }, { key, records });
  await page.goto(`${baseURL}/#/lee-lees-tracker`);
  await expect(page.locator('#lws-local-dev-badge')).toHaveText('LOCAL DEV');
  const nav = page.getByRole('navigation', { name: 'Lee-Lee’s Tracker mobile navigation' });
  await nav.getByRole('button', { name: view, exact: true }).click();
  if (view === 'History') {
    // History opens as a day list; drill into today so the long timeline
    // the reader actually scrolls is on screen.
    await page.locator('[data-action="history-date"]').first().click();
    await expect(page.locator('#lee-lee-diabetes-root')).toContainText('Scroll record 0');
  }
}

async function scrollDeep(page) {
  await page.evaluate(() => window.scrollTo(0, Math.floor(document.documentElement.scrollHeight * 0.6)));
  await page.waitForTimeout(150);
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(400);
  return before;
}

async function fireSyncStatuses(page) {
  await page.evaluate(() => window.testSyncStatus({ configured: true, signedIn: true, state: 'syncing', message: 'Syncing...' }));
  await page.waitForTimeout(200);
  await page.evaluate(() => window.testSyncStatus({ configured: true, signedIn: true, state: 'idle', pendingCount: 0, realtimeStatus: 'connected', lastSuccessfulSyncAt: new Date().toISOString() }));
  await page.waitForTimeout(200);
}

test('History day view keeps its scroll position when remote changes arrive', async ({ page }) => {
  await exposeSyncCallbacks(page);
  await open(page, 'History');
  const before = await scrollDeep(page);
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('lando-world:lee-lees-tracker:v1'));
    window.testRemoteLibrary({ records: data.records.map(record => record.id === 'scroll-record-5' ? { ...record, notes: 'Updated remotely' } : record) });
  });
  await page.waitForTimeout(200);
  // The remote edit still arrives; the reader just does not lose their place.
  await expect(page.locator('#lee-lee-diabetes-root')).toContainText('Updated remotely');
  const after = await page.evaluate(() => window.scrollY);
  expect(Math.abs(after - before)).toBeLessThanOrEqual(150);
});

test('Reports keeps its scroll position when two remote callbacks land in the same task', async ({ page }) => {
  await exposeSyncCallbacks(page);
  await open(page, 'Reports');
  const before = await scrollDeep(page);
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('lando-world:lee-lees-tracker:v1'));
    // Reconciliation can call the remote handler back-to-back (foods,
    // then saved meals). Both renders land before the first restore's
    // frame runs, so the second render must not capture the position
    // the first render already reset.
    window.testRemoteLibrary({ records: data.records.map(record => record.id === 'scroll-record-5' ? { ...record, notes: 'Updated remotely' } : record) });
    window.testRemoteLibrary({ savedMeals: data.savedMeals });
  });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.scrollY);
  expect(Math.abs(after - before)).toBeLessThanOrEqual(150);
});

test('History day view keeps its scroll position when two remote callbacks land in the same task', async ({ page }) => {
  await exposeSyncCallbacks(page);
  await open(page, 'History');
  const before = await scrollDeep(page);
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('lando-world:lee-lees-tracker:v1'));
    window.testRemoteLibrary({ records: data.records.map(record => record.id === 'scroll-record-5' ? { ...record, notes: 'Updated remotely' } : record) });
    window.testRemoteLibrary({ foodLibrary: data.foodLibrary });
  });
  await page.waitForTimeout(300);
  await expect(page.locator('#lee-lee-diabetes-root')).toContainText('Updated remotely');
  const after = await page.evaluate(() => window.scrollY);
  expect(Math.abs(after - before)).toBeLessThanOrEqual(150);
});

test('a queued Reports restore does not scroll the launcher after a route exit', async ({ page }) => {
  await exposeSyncCallbacks(page);
  await open(page, 'Reports');
  const before = await scrollDeep(page);
  expect(before).toBeGreaterThan(1000);
  // Hold the restore's frame, the way a controlled probe can: capture
  // whatever the sync render queues, exit to the launcher (which lands
  // at the top through the shell's own route reset), then release the
  // held callback. LLT's internal mode does not change when the shell
  // hides the tracker, so only an active-view check can stop the held
  // restore from scrolling the launcher.
  await page.evaluate(() => {
    window.heldRestoreFrames = [];
    const realRaf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => { window.heldRestoreFrames.push(callback); return window.heldRestoreFrames.length; };
    const data = JSON.parse(localStorage.getItem('lando-world:lee-lees-tracker:v1'));
    window.testRemoteLibrary({ records: data.records.map(record => record.id === 'scroll-record-5' ? { ...record, notes: 'Updated remotely' } : record) });
    window.requestAnimationFrame = realRaf;
  });
  const held = await page.evaluate(() => window.heldRestoreFrames.length);
  expect(held).toBeGreaterThanOrEqual(1);
  await page.locator('#lee-lees-tracker-view [data-ecosystem-nav] a[href="#/"]').click();
  await expect(page.locator('#lee-lees-tracker-view')).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => { const frames = window.heldRestoreFrames.splice(0); frames.forEach(callback => callback(performance.now())); });
  await page.waitForTimeout(300);
  const launcherScroll = await page.evaluate(() => window.scrollY);
  expect(launcherScroll).toBeLessThanOrEqual(150);
});

test('Reports keeps its scroll position across sync refreshes', async ({ page }) => {
  await exposeSyncCallbacks(page);
  await open(page, 'Reports');
  const before = await scrollDeep(page);
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('lando-world:lee-lees-tracker:v1'));
    window.testRemoteLibrary({ records: data.records.map(record => record.id === 'scroll-record-5' ? { ...record, notes: 'Updated remotely' } : record) });
  });
  await page.waitForTimeout(200);
  const afterRemote = await page.evaluate(() => window.scrollY);
  expect(Math.abs(afterRemote - before)).toBeLessThanOrEqual(150);
  await fireSyncStatuses(page);
  const afterStatus = await page.evaluate(() => window.scrollY);
  expect(Math.abs(afterStatus - before)).toBeLessThanOrEqual(150);
});
