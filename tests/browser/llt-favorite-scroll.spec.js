import { expect, test } from '@playwright/test';
import { createIPhoneDevServer } from '../../scripts/dev-iphone.mjs';

let server;
let baseURL;
const key = 'lando-world:lee-lees-tracker:v1';
test.beforeAll(async () => {
  server = createIPhoneDevServer({ bindAddress: { address: '127.0.0.1', netmask: '255.0.0.0' }, getMetadata: async () => ({ environment: 'local-device', appVersion: '1.0.0', branch: 'fix/llt-favorite-scroll', commit: 'test', commitFull: 'test', dirty: true, sourceId: 'favorite-scroll-test' }) });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  baseURL = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => { if (server?.listening) await new Promise(resolve => server.close(resolve)); });

const foods = Array.from({ length: 30 }, (_, i) => ({
  id: `food-${String(i + 1).padStart(2, '0')}`,
  name: `Food ${String(i + 1).padStart(2, '0')}`,
  carbs: 10 + i,
  servingLabel: '1 serving',
}));
const meals = ['Meal Alpha', 'Meal Bravo', 'Meal Charlie'].map((name, i) => ({
  id: `meal-${i + 1}`,
  name,
  totalCarbs: 30 + i * 5,
  components: [],
}));

async function open(page) {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.addInitScript(({ key, foods, meals }) => {
    localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, records: [], settings: { glucoseTargetMin: 70, glucoseTargetMax: 180 }, insulinPlans: [], foodLibrary: foods, savedMeals: meals, metadata: {} }));
  }, { key, foods, meals });
  await page.goto(`${baseURL}/#/lee-lees-tracker`);
  await expect(page.locator('#lws-local-dev-badge')).toHaveText('LOCAL DEV');
  const nav = page.getByRole('navigation', { name: 'Lee-Lee’s Tracker mobile navigation' });
  await nav.getByRole('button', { name: 'Foods', exact: true }).click();
  await expect(page.locator('[data-food-library-discovery]')).toBeVisible();
  // Seeded items render alongside the starter library; reveal every row.
  for (let i = 0; i < 10; i += 1) {
    const more = page.getByRole('button', { name: 'Show More' });
    if (await more.count() === 0) break;
    await more.click();
  }
  await expect(page.locator('[data-action="toggle-food-favorite"][data-id="food-25"]')).toBeVisible();
}

test('starring a food deep in the Foods list keeps the scroll position', async ({ page }) => {
  await open(page);
  const star = page.locator('[data-action="toggle-food-favorite"][data-id="food-25"]');
  await star.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(400);
  await star.click();
  await expect(star).toHaveAttribute('aria-label', 'Remove favorite');
  const after = await page.evaluate(() => window.scrollY);
  expect(Math.abs(after - before)).toBeLessThanOrEqual(150);
  const stored = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
  expect(stored.foodLibrary.find(f => f.id === 'food-25').favorite).toBe(true);
});

test('starring a meal deep in the Foods list keeps the scroll position', async ({ page }) => {
  await open(page);
  const star = page.locator('[data-action="toggle-saved-meal-favorite"][data-id="meal-3"]');
  await star.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(400);
  await star.click();
  await expect(star).toHaveAttribute('aria-label', 'Remove meal favorite');
  const after = await page.evaluate(() => window.scrollY);
  expect(Math.abs(after - before)).toBeLessThanOrEqual(150);
  const stored = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
  expect(stored.savedMeals.find(m => m.id === 'meal-3').favorite).toBe(true);
});

// Exercise the actual tracker callbacks used by production sync, without
// connecting a test browser to a user's Supabase account.
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

for (const [action, id] of [['toggle-food-favorite', 'food-25'], ['toggle-saved-meal-favorite', 'meal-3']]) {
  test(`favorite survives delayed sync acknowledgement: ${action}`, async ({ page }) => {
    await exposeSyncCallbacks(page);
    await open(page);
    const star = page.locator(`[data-action="${action}"][data-id="${id}"]`);
    await star.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => scrollY);
    await star.tap();
    // Let the local toggle settle before delivering the separate network
    // acknowledgement. The original tests only covered the local save.
    await page.waitForTimeout(200);
    const search = await page.locator('[name="foodLibrarySearch"]').elementHandle();
    await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('lando-world:lee-lees-tracker:v1'));
      window.testRemoteLibrary({ foodLibrary: data.foodLibrary.map(food => ({ ...food, version: (food.version || 0) + 1 })) });
      // Force layout between remote acknowledgement and status notification,
      // as occurs when those arrive in different browser tasks.
      void document.documentElement.offsetHeight;
    });
    const afterRemote = await page.evaluate(() => scrollY);
    expect(Math.abs(afterRemote - before)).toBeLessThanOrEqual(150);
    expect(await search.evaluate(element => element.isConnected)).toBe(true);
    await page.evaluate(() => window.testSyncStatus({ configured: true, signedIn: true, state: 'syncing', message: 'Syncing...' }));
    await expect(page.locator('.lee_lee_diabetes_top .lee_lee_diabetes_save_status')).toContainText('Syncing...');
    await page.evaluate(() => window.testSyncStatus({ configured: true, signedIn: true, state: 'idle', pendingCount: 0, realtimeStatus: 'connected', lastSuccessfulSyncAt: new Date().toISOString() }));
    expect(await search.evaluate(element => element.isConnected)).toBe(true);
    await expect(page.locator('.lee_lee_diabetes_top .lee_lee_diabetes_save_status')).toContainText('Synced');
  });
}

test('remote library edits still reach Foods after the document has been saved', async ({ page }) => {
  await exposeSyncCallbacks(page);
  await open(page);
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('lando-world:lee-lees-tracker:v1'));
    window.testRemoteLibrary({
      foodLibrary: data.foodLibrary.map(food => food.id === 'food-25' ? { ...food, name: 'Updated remote food' } : food),
      savedMeals: data.savedMeals.map(meal => meal.id === 'meal-3' ? { ...meal, name: 'Updated remote meal' } : meal),
    });
  });
  await expect(page.locator('[data-food-library-discovery]')).toContainText('Updated remote food');
  await expect(page.locator('[data-food-library-discovery]')).toContainText('Updated remote meal');
});
