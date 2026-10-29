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
const foodId = '11111111-1111-4111-8111-111111111111';
const mealName = 'Cub Meal w/chow mein noodles + orange chicken';
async function seed(page) {
  await open(page);
  await page.evaluate(({ foodId, mealName }) => window.LeeLeeTrackerStorage.updateTrackerData(current => ({ ...current,
    foodLibrary: [...current.foodLibrary,
      { id: foodId, name: 'Office snack', carbs: 10, servingLabel: '1 portion', sourceType: 'user', favorite: true, lastUsedAt: '2026-10-13T12:00:00Z' },
    ],
    savedMeals: [{ id: '22222222-2222-4222-8222-222222222222', name: mealName, favorite: true, totalCarbs: 999, components: [
      { componentType: 'food', foodId, nameSnapshot: 'Noodles', quantity: 2, carbsPerServing: 20, carbTotal: 40 },
      { componentType: 'manual', nameSnapshot: 'Chicken', carbTotal: 28 },
    ] }],
  })), { foodId, mealName });
}
async function enter(page, context) {
  if (context === 'standalone') {
    await root(page).getByRole('button', { name: 'Foods', exact: true }).click();
    await root(page).getByRole('tab', { name: 'Carb Calc', exact: true }).click();
  } else {
    await root(page).getByRole('button', { name: 'Log Entry', exact: true }).click();
    await root(page).locator('[name="type"]').selectOption('Snacks');
    await root(page).locator('[name="notes"]').fill('Keep entry note');
    await root(page).locator('[data-action="open-carb-calculator"]').click();
  }
}
async function stored(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), key); }
async function manual(page, carbs, qty = '1') {
  await root(page).getByRole('button', { name: '+ Add Manual Amount...' }).click();
  await root(page).locator('[name="carbItemCarbs"]').fill(carbs);
  await root(page).locator('[name="carbItemQty"]').fill(qty);
  await root(page).getByRole('button', { name: 'Add Item', exact: true }).click();
}

for (const context of ['standalone', 'entry']) {
  test(`${context}: integrated search finds reference foods, custom foods and saved meals without a dropdown`, async ({ page }) => {
    await seed(page); await enter(page, context);
    const query = root(page).getByRole('searchbox', { name: 'Search foods & meals' });
    await expect(root(page).locator('[data-carb-library-view]')).toHaveCount(0);
    await query.fill('banana');
    await expect(root(page).getByRole('button', { name: /^Add Banana / })).toBeVisible();
    await expect(root(page).locator('[data-carb-library-list]')).toContainText('FOOD · Reference');
    await query.fill('OFFICE');
    await expect(root(page).locator(`[data-action="add-food-to-carb-calculator"][data-id="${foodId}"]`)).toHaveCount(1);
    await expect(root(page).locator('[data-carb-library-list]')).toContainText('FOOD · My Foods');
    await query.fill('cUb Me');
    await expect(root(page).getByRole('button', { name: /^Add meal Cub Meal/ })).toHaveCount(1);
    await expect(root(page).locator('[data-carb-library-list]')).toContainText('MEAL · My Meals');
    await expect(root(page).locator('[data-carb-library-list]')).toContainText('68 g per saved amount');
    await expect(root(page).getByRole('heading', { name: 'Food Search', exact: true })).toHaveCount(0);
    await expect(query).toBeFocused();
    await query.fill('not a food or meal');
    await expect(root(page).locator('[data-carb-library-list]')).toContainText('No foods or meals found');
    await query.fill('');
    await expect(root(page).getByRole('button', { name: 'Favorites', exact: true })).toBeVisible();
    await root(page).getByRole('button', { name: 'Favorites', exact: true }).click();
    await expect(root(page).getByRole('button', { name: /^Add meal Cub Meal/ })).toBeVisible();
    await root(page).getByRole('button', { name: 'Recent', exact: true }).click();
    await expect(root(page).locator('[data-carb-library-list]')).toContainText('Office snack');
  });

  test(`${context}: meal quantity, food/manual combinations and removal use a frozen saved total`, async ({ page }) => {
    await seed(page); await enter(page, context);
    const before = await stored(page);
    const query = root(page).locator('[name="carbFoodSearch"]');
    await query.fill('Cub Meal');
    await root(page).getByRole('button', { name: /^Add meal Cub Meal/ }).click();
    await expect(root(page).locator('[data-carb-calculator-row]')).toHaveCount(1);
    await expect(root(page).locator('[data-carb-calculator-total]')).toHaveText('68 g');
    await expect(query).toHaveValue(''); await expect(query).not.toBeFocused();
    await root(page).getByRole('button', { name: `Edit ${mealName}`, exact: true }).click();
    await expect(root(page).getByRole('heading', { name: 'Edit Meal Amount' })).toBeVisible();
    await expect(root(page).locator('[name="carbItemCarbs"]')).toHaveAttribute('readonly', '');
    await root(page).locator('[name="carbItemQty"]').fill('2');
    await root(page).getByRole('button', { name: 'Save Item', exact: true }).click();
    await expect(root(page).locator('[data-carb-calculator-total]')).toHaveText('136 g');
    await query.fill('Office');
    await root(page).locator(`[data-action="add-food-to-carb-calculator"][data-id="${foodId}"]`).click();
    await manual(page, '3', '2');
    await expect(root(page).locator('[data-carb-calculator-total]')).toHaveText('152 g');
    await root(page).getByRole('button', { name: `Remove ${mealName}`, exact: true }).click();
    await expect(root(page).locator('[data-carb-calculator-total]')).toHaveText('16 g');
    expect((await stored(page)).savedMeals).toEqual(before.savedMeals);
    expect((await stored(page)).records).toEqual(before.records);
    if (context === 'entry') {
      await root(page).locator('[data-action="use-carb-calculator-total"]').click();
      await expect(root(page).locator('[name="mealCarbs"]')).toHaveValue('16');
      await expect(root(page).locator('[name="notes"]')).toHaveValue('Keep entry note');
      expect((await stored(page)).records).toEqual(before.records);
    }
  });
}

test('dynamic headings are unique and the switcher stays in document flow at top/middle/bottom', async ({ page }, testInfo) => {
  await seed(page); await page.setViewportSize({ width: 320, height: 740 });
  await root(page).getByRole('button', { name: 'Foods', exact: true }).click();
  await expect(root(page).getByRole('heading', { name: 'Foods', exact: true })).toBeVisible();
  await expect(root(page).locator('.lee_lee_diabetes_date')).toHaveText('Food Library');
  await root(page).getByRole('tab', { name: 'Carb Calc', exact: true }).click();
  await expect(root(page).getByRole('heading', { name: 'Carb Calculator', exact: true })).toHaveCount(1);
  await expect(root(page).locator('.lee_lee_diabetes_page_support')).toHaveText('Calculate carbs without logging an entry.');
  await expect(root(page).getByRole('button', { name: 'Back to Foods', exact: true })).toHaveCount(0);
  await manual(page, '10');
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    const anchor = await root(page).locator('[data-foods-view-switcher]').evaluate(node => node.getBoundingClientRect().top + scrollY);
    for (const fraction of [0, 0.5, 1]) {
      await page.evaluate(fraction => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * fraction), fraction);
      const metrics = await root(page).locator('[data-foods-view-switcher]').evaluate(node => ({
        top: node.getBoundingClientRect().top + scrollY, position: getComputedStyle(node).position,
        bottom: node.getBoundingClientRect().bottom,
        contentTop: document.querySelector('#lee-lee-carb-calc-panel').getBoundingClientRect().top,
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      expect(metrics.position).toBe('static'); expect(metrics.top).toBeCloseTo(anchor, 0);
      expect(metrics.bottom).toBeLessThanOrEqual(metrics.contentTop);
      expect(metrics.overflow).toBe(false);
    }
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath(`unified-${theme}.png`), fullPage: true });
  }
  await root(page).getByRole('tab', { name: 'Foods', exact: true }).click();
  await expect(root(page).getByRole('heading', { name: 'Foods', exact: true })).toBeVisible();
});

test('inline result selection retains the search input, and standalone never affects entry drafts', async ({ page }) => {
  await seed(page); await enter(page, 'standalone');
  const query = root(page).locator('[name="carbFoodSearch"]');
  await query.fill('Cub');
  await query.evaluate(node => { window.__originalSearchInput = node; });
  await page.setViewportSize({ width: 390, height: 420 });
  await root(page).getByRole('button', { name: /^Add meal Cub Meal/ }).click();
  expect(await query.evaluate(node => node === window.__originalSearchInput)).toBe(true);
  await expect(query).not.toBeFocused();
  await expect(query).toHaveValue('');
  await expect(root(page).locator('[data-carb-calculator-total]')).toHaveText('68 g');
  await root(page).getByRole('button', { name: 'Done', exact: true }).click();
  await root(page).getByRole('button', { name: 'Log Entry', exact: true }).click();
  await root(page).locator('[name="type"]').selectOption('Snacks');
  await root(page).locator('[data-action="open-carb-calculator"]').click();
  await expect(root(page).locator('[data-foods-view-switcher]')).toHaveCount(0);
  await expect(root(page).locator('[data-carb-calculator-row]')).toHaveCount(0);
  await root(page).getByRole('button', { name: 'Cancel Carb Calculator' }).click();
  expect((await stored(page)).records).toHaveLength(0);
});


test('compact selected-item table and equal segments fit phone, tablet and desktop widths', async ({ page }) => {
  await seed(page); await enter(page, 'standalone');
  await root(page).locator('[name="carbFoodSearch"]').fill('Cub');
  await root(page).getByRole('button', { name: /^Add meal Cub Meal/ }).click();
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    const tabs = await root(page).locator('[role="tab"]').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
    expect(tabs[0]).toBeCloseTo(tabs[1], 0);
    const row = root(page).locator('[data-carb-calculator-row]');
    const metrics = await row.evaluate(node => {
      const classes = ['qty', 'item', 'operator', 'carbs', 'row_total'];
      return classes.map(part => { const rect = node.querySelector(`.lee_lee_diabetes_carb_calc_${part}`).getBoundingClientRect(); return { left: rect.left, right: rect.right }; });
    });
    for (let index = 1; index < metrics.length; index++) expect(metrics[index - 1].right).toBeLessThanOrEqual(metrics[index].left + 1);
    await expect(row.locator('.lee_lee_diabetes_carb_calc_item_name')).toHaveText(mealName);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
