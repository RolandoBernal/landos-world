import { expect, test } from '@playwright/test';
import { createIPhoneDevServer } from '../../scripts/dev-iphone.mjs';

let server;
let baseURL;
const key = 'lando-world:lee-lees-tracker:v1';
test.beforeAll(async () => {
  server = createIPhoneDevServer({ bindAddress: { address: '127.0.0.1', netmask: '255.0.0.0' }, getMetadata: async () => ({ environment: 'local-device', appVersion: '1.0.0', branch: 'feature/llt-issue-20-my-meals', commit: 'test', commitFull: 'test', dirty: true, sourceId: 'issue-20-test' }) });
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

for (const context of ['standalone', 'entry', 'edit']) {
  test(`${context}: My Meals adds frozen meals once per tap and combines with foods/manual amounts`, async ({ page }) => {
    await seed(page);
    await page.evaluate(() => window.LeeLeeTrackerStorage.updateTrackerData(current => ({ ...current,
      savedMeals: [...current.savedMeals, { id: 'decimal-meal', name: 'Decimal meal', components: [
        { componentType: 'food', nameSnapshot: 'Saved portion', quantity: 1.5, carbsPerServing: 2.5, carbTotal: 3.75 },
      ] }],
    })));
    if (context === 'edit') {
      await page.evaluate(() => window.LeeLeeTrackerStorage.updateTrackerData(current => ({ ...current, records: [{
        id: 'synthetic-snack', version: 1, type: 'Snacks', eventType: 'check-insulin',
        recordTimestamp: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), mealCarbs: 20, totalCarbs: 20, notes: 'saved',
      }] })));
      await root(page).locator('[data-action="history"]').first().click();
      await root(page).locator('[data-action="history-date"]').first().click();
      await root(page).locator('[data-action="edit-record"]').first().click();
      await root(page).locator('[name="notes"]').fill('Keep entry note');
      await root(page).locator('[data-action="open-carb-calculator"]').click();
    } else await enter(page, context);
    // Edit begins with the entry's existing carb snapshot; clear only this scratch selection.
    if (context === 'edit') await root(page).locator('[data-action="remove-carb-calculator-row"]').click();
    const before = await stored(page);
    const meals = root(page).getByRole('button', { name: 'My Meals', exact: true });
    await meals.click();
    await expect(meals).toHaveAttribute('aria-pressed', 'true');
    const list = root(page).locator('[data-carb-library-list]');
    await expect(list).toContainText('68 g per saved amount');
    await expect(list).toContainText('3.75 g per saved amount');
    await expect(list.locator('[data-action="add-food-to-carb-calculator"]')).toHaveCount(0);
    const add = root(page).getByRole('button', { name: /^Add meal Cub Meal/ });
    // Synchronous rapid taps exercise the duplicate guard, without an auto-wait delay.
    await add.evaluate(node => { node.click(); document.querySelector('[data-action="carb-search-shortcut"][data-picker="meals"]').click(); document.querySelector('[data-action="add-saved-meal-to-carb-calculator"][data-id="22222222-2222-4222-8222-222222222222"]').click(); });
    await expect(root(page).locator('[data-carb-calculator-row]')).toHaveCount(1);
    await expect(root(page).locator('[data-carb-calculator-total]')).toHaveText('68 g');
    await expect(meals).toHaveAttribute('aria-pressed', 'true');
    await expect(add).toContainText('✓');
    await root(page).getByRole('button', { name: /^Add meal Decimal meal/ }).click();
    await expect(meals).toHaveAttribute('aria-pressed', 'false');
    await expect(list.locator('[data-action="add-saved-meal-to-carb-calculator"]')).toHaveCount(0);
    await expect(root(page).locator('[data-carb-calculator-total]')).toHaveText('71.75 g');
    await expect(root(page).locator('[data-carb-calculator-row]')).toHaveCount(2);
    await root(page).locator('[name="carbFoodSearch"]').fill('Office');
    await root(page).locator(`[data-action="add-food-to-carb-calculator"][data-id="${foodId}"]`).click();
    await manual(page, '1.25');
    await expect(root(page).locator('[data-carb-calculator-total]')).toHaveText('83 g');
    await root(page).getByRole('button', { name: 'Remove Decimal meal', exact: true }).click();
    await expect(root(page).locator('[data-carb-calculator-total]')).toHaveText('79.25 g');
    expect((await stored(page)).savedMeals).toEqual(before.savedMeals);
    expect((await stored(page)).foodLibrary).toEqual(before.foodLibrary);
    expect((await stored(page)).records).toEqual(before.records);
    if (context !== 'standalone') {
      await root(page).locator('[data-action="use-carb-calculator-total"]').click();
      await expect(root(page).locator('[name="mealCarbs"]')).toHaveValue('79.25');
      await expect(root(page).locator('[name="notes"]')).toHaveValue('Keep entry note');
      await root(page).locator('[data-action="open-carb-calculator"]').click();
      await root(page).getByRole('button', { name: 'My Meals', exact: true }).click();
      await root(page).getByRole('button', { name: 'Cancel Carb Calculator' }).click();
      await expect(root(page).locator('[name="mealCarbs"]')).toHaveValue('79.25');
      await expect(root(page).locator('[name="notes"]')).toHaveValue('Keep entry note');
      expect((await stored(page)).records).toEqual(before.records);
    }
  });
}

test('empty My Meals directs meal management to Foods and search remains available', async ({ page }) => {
  await open(page); await enter(page, 'entry');
  await root(page).getByRole('button', { name: 'My Meals', exact: true }).click();
  await expect(root(page).locator('[data-carb-library-list]')).toContainText('No saved meals on this device yet.');
  await expect(root(page).locator('[data-carb-library-list]')).toContainText('Foods → My Meals');
  await expect(root(page).locator('[data-carb-library-list] [data-action="open-carb-food-editor"]')).toHaveCount(0);
  await root(page).locator('[name="carbFoodSearch"]').fill('banana');
  await expect(root(page).getByRole('button', { name: /^Add Banana / })).toBeVisible();
});

test('intentional repeat adds one saved amount to the existing meal quantity', async ({ page }) => {
  await seed(page); await enter(page, 'entry');
  await root(page).getByRole('button', { name: 'My Meals', exact: true }).click();
  const add = root(page).getByRole('button', { name: /^Add meal Cub Meal/ });
  await add.click();
  await expect(root(page).getByRole('button', { name: 'My Meals', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await root(page).getByRole('button', { name: 'My Meals', exact: true }).click();
  await expect(add).toContainText('✓');
  await page.waitForTimeout(400); // Exceed the existing 350 ms accidental-double-tap guard.
  await add.click();
  await expect(root(page).locator('[data-carb-calculator-row]')).toHaveCount(1);
  await expect(root(page).locator('[data-carb-calculator-total]')).toHaveText('136 g');
  await root(page).getByRole('button', { name: `Edit ${mealName}`, exact: true }).click();
  await expect(root(page).locator('[name="carbItemQty"]')).toHaveValue('2');
});

test('Issue 20.1: shared plus controls, collapse/reopen, and failed addition preserve the open calculator', async ({ page }) => {
  await seed(page); await enter(page, 'entry');
  const meals = root(page).getByRole('button', { name: 'My Meals', exact: true });
  const list = root(page).locator('[data-carb-library-list]');
  await root(page).getByRole('button', { name: 'Favorites', exact: true }).click();
  const food = root(page).locator(`[data-action="add-food-to-carb-calculator"][data-id="${foodId}"]`);
  const foodClasses = await food.getAttribute('class');
  const glyphClasses = await food.locator('[aria-hidden="true"]').last().getAttribute('class');
  await expect(food.locator('.lee_lee_diabetes_carb_pick_state')).toHaveText('+');
  await meals.click();
  const add = root(page).getByRole('button', { name: /^Add meal Cub Meal/ });
  expect(await add.getAttribute('class')).toBe(foodClasses);
  expect(await add.locator('.lee_lee_diabetes_carb_pick_state').getAttribute('class')).toBe(glyphClasses);
  await expect(add.locator('.lee_lee_diabetes_carb_pick_state')).toHaveText('+');
  // A stale/missing library ID must leave discovery open and totals untouched.
  await add.evaluate(node => { node.dataset.id = 'synthetic-missing-meal'; });
  await add.click();
  await expect(meals).toHaveAttribute('aria-pressed', 'true');
  await expect(root(page).locator('[data-carb-calculator-total]')).toHaveText('0 g');
  await expect(root(page).locator('[data-carb-calculator-row]')).toHaveCount(0);
  await add.evaluate(node => { node.dataset.id = '22222222-2222-4222-8222-222222222222'; });
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    const rect = await add.boundingBox();
    expect(rect.width).toBeGreaterThanOrEqual(44); expect(rect.height).toBeGreaterThanOrEqual(44);
    expect(await list.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  }
  await add.click();
  await expect(meals).toHaveAttribute('aria-pressed', 'false');
  await expect(list.locator('[data-action="add-saved-meal-to-carb-calculator"]')).toHaveCount(0);
  await expect(root(page).locator('[data-carb-calculator-row]')).toHaveCount(1);
  await expect(root(page).locator('[data-carb-calculator-total]')).toHaveText('68 g');
  await expect(root(page).locator('[data-carb-calculator]')).toBeVisible();
  await expect(root(page).locator('[name="mealCarbs"]')).toHaveValue('');
  await meals.click();
  await expect(add).toBeVisible();
  await expect(add.locator('.lee_lee_diabetes_carb_pick_state')).toHaveText('✓');
  for (const shortcut of ['Favorites', 'Recent']) {
    await page.waitForTimeout(400); // Intentional repeated food adds must exceed the existing 350 ms guard.
    await root(page).getByRole('button', { name: shortcut, exact: true }).click();
    await food.click();
    await expect(root(page).getByRole('button', { name: shortcut, exact: true })).toHaveAttribute('aria-pressed', 'false');
  }
  await expect(root(page).locator('[data-carb-calculator-total]')).toHaveText('88 g');
});
