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
