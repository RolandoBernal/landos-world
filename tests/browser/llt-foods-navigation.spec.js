import { expect, test } from '@playwright/test';
import { createIPhoneDevServer } from '../../scripts/dev-iphone.mjs';

let server;
let baseURL;
const key = 'lando-world:lee-lees-tracker:v1';
const timerKey = 'lando-world:lee-lees-tracker:pre-meal-timer:v1';
test.beforeAll(async () => {
  server = createIPhoneDevServer({ bindAddress: { address: '127.0.0.1', netmask: '255.0.0.0' }, getMetadata: async () => ({ environment: 'local-device', appVersion: '1.0.0', branch: 'feature/llt-shared-carb-calculator', commit: 'test', commitFull: 'test', dirty: true, sourceId: 'foods-switcher-test' }) });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  baseURL = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => { if (server?.listening) await new Promise(resolve => server.close(resolve)); });

async function open(page, seed = []) {
  const remote = [];
  page.on('request', request => { if (/supabase\.co|deployment-version\.json/.test(request.url())) remote.push(request.url()); });
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.addInitScript(({ key, seed }) => { localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, records: seed, settings: { glucoseTargetMin: 70, glucoseTargetMax: 180 }, insulinPlans: [], foodLibrary: [], savedMeals: [], metadata: {} })); }, { key, seed });
  await page.goto(`${baseURL}/#/lee-lees-tracker`);
  await expect(page.locator('#lws-local-dev-badge')).toHaveText('LOCAL DEV');
  return remote;
}


const root = page => page.locator('#lee-lee-diabetes-root');
const foodsTab = page => nav(page).getByRole('button', { name: 'Foods', exact: true });
const calcTab = page => nav(page).getByRole('button', { name: 'Carb Calc', exact: true });
const nav = page => root(page).getByRole('navigation', { name: 'Lee-Lee’s Tracker mobile navigation' });
async function foods(page) { await nav(page).getByRole('button', { name: 'Foods', exact: true }).click(); }
async function addManual(page, amount) {
  await root(page).getByRole('button', { name: '+ Add Manual Amount...' }).click();
  await root(page).locator('[name="carbItemCarbs"]').fill(amount);
  await root(page).getByRole('button', { name: 'Add Item', exact: true }).click();
}
async function data(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), key); }

test('New/Edit Entry calculators remain isolated from Foods navigation', async ({ page }) => {
  const seed = [{ id: 'synthetic-entry', type: 'Breakfast', bloodSugar: 120, mealCarbs: 21,
    insulinUnits: 3, administeredInsulinUnits: 3, notes: 'Preserve saved entry',
    recordTimestamp: new Date().toISOString(), timestamp: Date.now(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }];
  await open(page, seed); await foods(page); await calcTab(page).click(); await addManual(page, '18');
  const before = (await data(page)).records;
  await root(page).getByRole('button', { name: 'Done', exact: true }).click();
  await root(page).getByRole('button', { name: 'Log Entry', exact: true }).click();
  await expect(root(page).getByRole('heading', { name: 'Log Entry', exact: true })).toBeVisible();
  await expect(root(page).locator('[data-foods-view-switcher]')).toHaveCount(0);
  await root(page).locator('[name="type"]').selectOption('Snacks');
  await root(page).locator('[name="notes"]').fill('Keep this draft');
  await root(page).locator('[data-action="open-carb-calculator"]').click();
  await expect(root(page).getByRole('region', { name: 'Carb Calculator', exact: true })).toBeVisible();
  await expect(root(page).locator('[data-foods-view-switcher]')).toHaveCount(0);
  await expect(root(page).locator('[data-carb-calculator-row]')).toHaveCount(0);
  await addManual(page, '7');
  await root(page).locator('[data-action="use-carb-calculator-total"]').click();
  await expect(root(page).locator('[name="mealCarbs"]')).toHaveValue('7');
  await expect(root(page).locator('[name="notes"]')).toHaveValue('Keep this draft');
  expect((await data(page)).records).toEqual(before);
  await root(page).locator('[data-action="cancel"]').click();
  await root(page).locator('[data-action="edit-today-record"]').click();
  await root(page).locator('[data-action="open-carb-calculator"]').click();
  await expect(root(page).getByRole('region', { name: 'Carb Calculator', exact: true })).toBeVisible();
  await expect(root(page).locator('[data-foods-view-switcher]')).toHaveCount(0);
  await expect(root(page).locator('[data-carb-calculator-total]')).toHaveText('21 g');
  await root(page).getByRole('button', { name: 'Cancel Carb Calculator' }).click();
  await root(page).locator('[data-action="cancel"]').click();
  await foods(page); await calcTab(page).click();
  await expect(root(page).locator('[data-carb-calculator-total]')).toHaveText('18 g');
  expect((await data(page)).records).toEqual(before);
});
