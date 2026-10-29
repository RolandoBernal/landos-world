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
const foodsTab = page => root(page).getByRole('tab', { name: 'Foods', exact: true });
const calcTab = page => root(page).getByRole('tab', { name: 'Carb Calc', exact: true });
const nav = page => root(page).getByRole('navigation', { name: 'Lee-Lee’s Tracker mobile navigation' });
async function foods(page) { await nav(page).getByRole('button', { name: 'Foods', exact: true }).click(); }
async function addManual(page, amount) {
  await root(page).getByRole('button', { name: '+ Add Manual Amount...' }).click();
  await root(page).locator('[name="carbItemCarbs"]').fill(amount);
  await root(page).getByRole('button', { name: 'Add Item', exact: true }).click();
}
async function data(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), key); }

test('Foods defaults and bottom navigation preserve scratch rows without clinical writes', async ({ page }) => {
  await open(page); await foods(page);
  await expect(foodsTab(page)).toHaveAttribute('aria-selected', 'true');
  await expect(calcTab(page)).toHaveAttribute('aria-selected', 'false');
  await expect(root(page).locator('[data-food-library-accordion]')).toHaveCount(2);
  const before = await data(page);
  await calcTab(page).click();
  await expect(calcTab(page)).toHaveAttribute('aria-selected', 'true');
  await expect(root(page).locator('[data-standalone-calculator]')).toBeVisible();
  await expect(root(page).locator('[data-carb-calculator]')).toHaveAttribute('role', 'region');
  await expect(root(page).locator('[data-dose-helper], [data-save-record], [name="insulinUnits"]')).toHaveCount(0);
  await addManual(page, '18');
  await foodsTab(page).click();
  await calcTab(page).click();
  await expect(root(page).locator('[data-carb-calculator-total]')).toHaveText('18 g');
  for (const destination of ['Today', 'History', 'Reports']) {
    await nav(page).getByRole('button', { name: destination, exact: true }).click();
    await foods(page);
    await expect(foodsTab(page)).toHaveAttribute('aria-selected', 'true');
    await calcTab(page).click();
    await expect(root(page).locator('[data-carb-calculator-total]')).toHaveText('18 g');
  }
  await page.locator('#lee_lee_settings_toggle').click();
  await foods(page);
  await expect(foodsTab(page)).toHaveAttribute('aria-selected', 'true');
  await calcTab(page).click();
  await expect(root(page).locator('[data-carb-calculator-total]')).toHaveText('18 g');
  await foods(page);
  await expect(foodsTab(page)).toHaveAttribute('aria-selected', 'true');
  await calcTab(page).click();
  await root(page).getByRole('button', { name: 'Done', exact: true }).click();
  await expect(foodsTab(page)).toHaveAttribute('aria-selected', 'true');
  await calcTab(page).click();
  await root(page).getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(root(page).locator('[data-carb-calculator-row]')).toHaveCount(0);
  expect(await data(page)).toEqual(before);
});

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

test('switcher uses accessible automatic-activation tabs without trapping standalone focus', async ({ page }) => {
  await open(page); await foods(page);
  await foodsTab(page).focus();
  await page.keyboard.press('ArrowRight');
  await expect(calcTab(page)).toBeFocused();
  await expect(calcTab(page)).toHaveAttribute('aria-selected', 'true');
  await expect(calcTab(page)).toHaveAttribute('tabindex', '0');
  await expect(foodsTab(page)).toHaveAttribute('tabindex', '-1');
  await page.keyboard.press('Tab');
  await expect(root(page).getByRole('searchbox', { name: 'Search foods & meals' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(calcTab(page)).toBeFocused();
  await page.keyboard.press('Home');
  await expect(foodsTab(page)).toBeFocused();
  await expect(foodsTab(page)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(calcTab(page)).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(foodsTab(page)).toBeFocused();
  await expect(root(page).locator('#lee-lee-foods-panel')).toBeVisible();
  await expect(root(page).locator('#lee-lee-carb-calc-panel')).toBeHidden();
});

test('standalone dedicated subviews retain unsaved manual input and search across view switches', async ({ page }) => {
  await open(page); await foods(page); await calcTab(page).click();
  await root(page).getByRole('button', { name: '+ Add Manual Amount...' }).click();
  await root(page).locator('[name="carbItemQty"]').fill('0.25');
  await root(page).locator('[name="carbItemCarbs"]').fill('20');
  await root(page).locator('[name="carbItemLabel"]').fill('Pending item');
  await foodsTab(page).click(); await calcTab(page).click();
  await expect(root(page).locator('[name="carbItemQty"]')).toHaveValue('0.25');
  await expect(root(page).locator('[name="carbItemCarbs"]')).toHaveValue('20');
  await expect(root(page).locator('[name="carbItemLabel"]')).toHaveValue('Pending item');
  await root(page).getByRole('button', { name: 'Add Item', exact: true }).click();
  await expect(root(page).locator('[data-carb-calculator-total]')).toHaveText('5 g');
  await root(page).locator('[name="carbFoodSearch"]').fill('banana');
  await foodsTab(page).click(); await calcTab(page).click();
  await expect(root(page).locator('[name="carbFoodSearch"]')).toHaveValue('banana');
  await root(page).getByRole('button', { name: /^Add Banana / }).click();
  await root(page).getByRole('button', { name: 'Save as My Meal', exact: true }).click();
  await root(page).locator('[name="savedMealName"]').fill('Pending reusable meal');
  await foodsTab(page).click(); await calcTab(page).click();
  await expect(root(page).locator('[name="savedMealName"]')).toHaveValue('Pending reusable meal');
  expect((await data(page)).savedMeals).toHaveLength(0);
  await root(page).locator('[data-action="cancel-carb-meal-editor"]').click();
  await root(page).getByRole('button', { name: 'Save as My Meal', exact: true }).click();
  await expect(root(page).locator('[name="savedMealName"]')).toHaveValue('');
  await expect(root(page).locator('[data-foods-view-switcher]')).toBeVisible();
  await expect(nav(page)).toBeVisible();
});

test('Foods accordions and management actions survive switching without resetting library state', async ({ page }) => {
  await open(page); await foods(page);
  await root(page).locator('[data-food-library-accordion="foods"] summary').click();
  await root(page).locator('[name="foodLibrarySearch"]').fill('banana');
  const before = await data(page);
  await calcTab(page).click(); await foodsTab(page).click();
  await expect(root(page).locator('[data-food-library-accordion="foods"]')).toHaveAttribute('open', '');
  await expect(root(page).locator('[name="foodLibrarySearch"]')).toHaveValue('banana');
  await expect(root(page).getByRole('button', { name: '+ Add New Food', exact: true })).toBeVisible();
  await root(page).locator('[data-food-library-accordion="meals"] summary').click();
  await expect(root(page).getByRole('button', { name: '+ Add New Meal', exact: true })).toBeVisible();
  await expect(root(page).locator('[name="savedMealsSearch"]')).toBeVisible();
  expect(await data(page)).toEqual(before);
});

test('view shell fits narrow screens, retains reachable controls on viewport shrink, and supports both themes', async ({ page }, testInfo) => {
  await open(page); await page.setViewportSize({ width: 320, height: 740 }); await foods(page);
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    await expect(foodsTab(page)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`foods-${theme}.png`) });
    await calcTab(page).click();
    const metrics = await root(page).locator('[data-foods-view-switcher]').evaluate(node => ({
      width: node.getBoundingClientRect().width,
      tabs: [...node.querySelectorAll('[role="tab"]')].map(tab => ({ height: tab.getBoundingClientRect().height, width: tab.getBoundingClientRect().width })),
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    expect(metrics.width).toBeLessThanOrEqual(320);
    expect(metrics.overflow).toBe(false);
    metrics.tabs.forEach(tab => { expect(tab.height).toBeGreaterThanOrEqual(44); expect(tab.width).toBeGreaterThan(44); });
    await root(page).getByRole('button', { name: '+ Add Manual Amount...' }).click();
    await page.setViewportSize({ width: 320, height: 420 });
    const input = root(page).locator('[name="carbItemCarbs"]');
    await input.fill('12');
    await input.evaluate(node => node.scrollIntoView({ block: 'center' }));
    const inputBounds = await input.boundingBox(); const navBounds = await nav(page).boundingBox();
    expect(inputBounds.bottom || inputBounds.y + inputBounds.height).toBeLessThan(navBounds.y);
    await expect(root(page).locator('[data-foods-view-switcher]')).toBeVisible();
    await root(page).getByRole('button', { name: 'Add Item', exact: true }).click();
    await page.setViewportSize({ width: 320, height: 740 });
    await root(page).getByRole('button', { name: 'Clear', exact: true }).click();
    await calcTab(page).evaluate(node => node.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: testInfo.outputPath(`carb-calc-${theme}.png`) });
    await root(page).getByRole('button', { name: 'Done', exact: true }).evaluate(node => node.scrollIntoView({ block: 'center' }));
    const done = await root(page).getByRole('button', { name: 'Done', exact: true }).boundingBox();
    expect(done.y + done.height).toBeLessThanOrEqual((await nav(page).boundingBox()).y);
    const switchBounds = await root(page).locator('[data-foods-view-switcher]').boundingBox();
    const ecosystemBounds = await page.locator('#lee-lees-tracker-view [data-ecosystem-nav]').boundingBox();
    expect(await root(page).locator('[data-foods-view-switcher]').evaluate(node => getComputedStyle(node).position)).toBe('static');
    await calcTab(page).evaluate(node => node.scrollIntoView({ block: 'center' }));
    expect(await calcTab(page).evaluate(node => {
      const rect = node.getBoundingClientRect();
      return node.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2));
    })).toBe(true);
    await foodsTab(page).click();
  }
});
