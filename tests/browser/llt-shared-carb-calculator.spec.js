import { expect, test } from '@playwright/test';
import { createIPhoneDevServer } from '../../scripts/dev-iphone.mjs';

let server;
let baseURL;
const key = 'lando-world:lee-lees-tracker:v1';
const timerKey = 'lando-world:lee-lees-tracker:pre-meal-timer:v1';
test.beforeAll(async () => {
  server = createIPhoneDevServer({ bindAddress: { address: '127.0.0.1', netmask: '255.0.0.0' }, getMetadata: async () => ({ environment: 'local-device', appVersion: '1.0.0', branch: 'feature/llt-low-glucose-episodes', commit: 'test', commitFull: 'test', dirty: true, sourceId: 'low-glucose-test' }) });
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

async function stored(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)).records, key); }
async function manual(page, carbs, label = 'Test item') {
  const calculator = page.locator('[data-carb-calculator]');
  await calculator.getByRole('button', { name: '+ Add Manual Amount...' }).click();
  await calculator.getByLabel('Label (optional)', { exact: true }).fill(label);
  await calculator.getByLabel('Carbs per serving').fill(carbs);
  await calculator.getByRole('button', { name: 'Add Item' }).click();
}
async function scratch(page) {
  await page.locator('[data-action="foods"]').click();
  await page.locator('[data-action="open-standalone-carb-calculator"]').click();
}
test('standalone scratch retains state, stays separate from entry, clears and resets on reload', async ({ page }) => {
  await open(page);
  await scratch(page);
  const before = await page.evaluate(key => localStorage.getItem(key), key);
  await manual(page, '18', 'Scratch');
  await expect(page.locator('[data-carb-calculator-total]')).toHaveText('18 g');
  await expect(page.locator('[data-action="use-carb-calculator-total"]')).toHaveCount(0);
  await expect(page.locator('[data-dose-helper], [name="insulinUnits"], [data-save-record]')).toHaveCount(0);
  await page.locator('[data-standalone-calculator]').evaluate(form => form.requestSubmit());
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(before);
  await page.locator('[data-action="close-carb-calculator"]').first().click();
  await page.getByRole('button', { name: 'Log Entry', exact: true }).click();
  await page.locator('[name="type"]').selectOption('Snacks');
  await page.locator('[name="notes"]').fill('Draft stays here');
  await page.locator('[data-action="open-carb-calculator"]').click();
  await expect(page.locator('[data-carb-calculator-row]')).toHaveCount(0);
  await manual(page, '7', 'Entry');
  await page.locator('[data-action="use-carb-calculator-total"]').click();
  await expect(page.locator('[name="mealCarbs"]')).toHaveValue('7');
  await expect(page.locator('[name="notes"]')).toHaveValue('Draft stays here');
  expect(await stored(page)).toHaveLength(0);
  await page.locator('[data-lee-lee-editor] [data-action="cancel"]').click();
  await scratch(page);
  await expect(page.locator('[data-carb-calculator-total]')).toHaveText('18 g');
  await page.locator('[data-action="clear-standalone-carb-calculator"]').click();
  await expect(page.locator('[data-carb-calculator-row]')).toHaveCount(0);
  await manual(page, '12');
  await page.reload();
  await scratch(page);
  await expect(page.locator('[data-carb-calculator-row]')).toHaveCount(0);
});

test('invalid item edits cannot complete and cancel preserves entry carbs', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Log Entry', exact: true }).click();
  await page.locator('[name="type"]').selectOption('Snacks');
  await page.locator('[name="mealCarbs"]').fill('30');
  await page.locator('[data-action="open-carb-calculator"]').click();
  await expect(page.locator('[data-carb-calculator-total]')).toHaveText('30 g');
  await manual(page, '8', 'First');
  await manual(page, '9', 'Second');
  await page.getByRole('button', { name: 'Edit Second', exact: true }).click();
  await page.locator('[name="carbItemQty"]').fill('');
  await expect(page.getByRole('button', { name: 'Save Item', exact: true })).toBeDisabled();
  await expect(page.locator('[data-carb-item-editor]')).toBeVisible();
  await page.locator('[data-action="cancel-carb-calculator-item-editor"]').first().click();
  await page.locator('[data-action="close-carb-calculator"]').click();
  await expect(page.locator('[name="mealCarbs"]')).toHaveValue('30');
  expect(await stored(page)).toHaveLength(0);
});

test('standalone reuses all library lists and saves reusable meals without clinical records', async ({ page }, testInfo) => {
  await open(page);
  await page.evaluate(() => window.LeeLeeTrackerStorage.updateTrackerData(current => ({
    ...current,
    foodLibrary: [...current.foodLibrary, { id: '11111111-1111-4111-8111-111111111111', name: 'Synthetic Food', carbs: 12, servingLabel: '1 serving', favorite: true, lastUsedAt: '2026-10-01T12:00:00Z', createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-01T12:00:00Z' }],
  })));
  await scratch(page);
  for (const list of ['Favorites', 'Recent']) {
    await page.getByRole('button', { name: list, exact: true }).click();
    await expect(page.locator('[data-action="add-food-to-carb-calculator"][data-id="11111111-1111-4111-8111-111111111111"]')).toBeVisible();
  }
  await page.locator('[name="carbFoodSearch"]').fill('Synthetic Food');
  await page.locator('[data-action="add-food-to-carb-calculator"][data-id="11111111-1111-4111-8111-111111111111"]').click();
  await expect(page.locator('[data-carb-calculator-total]')).toHaveText('12 g');
  await page.getByRole('button', { name: 'Edit Synthetic Food', exact: true }).click();
  await page.locator('[name="carbItemQty"]').focus();
  await page.locator('[name="carbItemQty"]').fill('');
  await page.locator('[name="carbItemQty"]').fill('0.5');
  await page.getByRole('button', { name: 'Save Item', exact: true }).click();
  await expect(page.locator('[data-carb-calculator-total]')).toHaveText('6 g');
  await page.getByRole('button', { name: 'Save as My Meal', exact: true }).click();
  await page.locator('[name="savedMealName"]').fill('Synthetic Meal');
  await page.getByRole('button', { name: 'Save My Meal', exact: true }).click();
  await page.locator('[name="carbFoodSearch"]').fill('Synthetic Meal');
  await expect(page.locator('[data-carb-library-list]')).toContainText('Synthetic Meal');
  expect(await stored(page)).toHaveLength(0);
  await page.setViewportSize({ width: 320, height: 740 });
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    await page.screenshot({ path: testInfo.outputPath(`shared-calculator-${theme}.png`) });
    const bounds = await page.locator('[data-carb-calculator]').boundingBox();
    expect(bounds.width).toBeLessThanOrEqual(page.viewportSize().width);
    await expect(page.locator('.lee_lee_diabetes_bottom_nav')).toHaveCount(0);
    await expect(page.locator('[data-carb-calculator]')).not.toHaveAttribute('aria-modal', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.locator('[data-action="close-carb-calculator"]').first().click();
  await page.getByRole('button', { name: '+ Add New Meal', exact: true }).click();
  const builder = page.locator('[data-meal-builder]');
  await expect(builder.getByLabel('Meal Name', { exact: true })).toBeFocused();
  await builder.getByLabel('Meal Name', { exact: true }).fill('Foods-created Meal');
  await builder.getByLabel('Meal Carbs', { exact: true }).fill('25');
  await builder.getByRole('button', { name: 'Save Meal', exact: true }).click();
  const meals = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).savedMeals, key);
  expect(meals.map(meal => meal.name)).toEqual(expect.arrayContaining(['Synthetic Meal', 'Foods-created Meal']));
  expect(await stored(page)).toHaveLength(0);

});

test('entry full-page calculator preserves every draft field across cancel, use and reopening', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await page.getByRole('button', { name: 'Log Entry', exact: true }).click();
  await page.locator('[name="type"]').selectOption('Snacks');
  const values = { date: '2026-10-28', time: '13:42', bloodSugar: '143', mealCarbs: '30', notes: 'Unsaved iPhone draft', insulinUnits: '2' };
  for (const [name, value] of Object.entries(values)) await page.locator('[name="' + name + '"]').fill(value);
  const before = await page.evaluate(key => localStorage.getItem(key), key);
  const assertDraft = async (carbs = '30') => {
    for (const [name, value] of Object.entries({ ...values, mealCarbs: carbs })) await expect(page.locator('[name="' + name + '"]')).toHaveValue(value);
    await expect(page.locator('[name="type"]')).toHaveValue('Snacks');
  };
  await page.locator('[data-action="open-carb-calculator"]').click();
  await expect(page.locator('dialog[data-carb-calculator-layer]')).toHaveCount(0);
  await expect(page.locator('[data-editor-main]')).toBeHidden();
  await expect(page.locator('.lee_lee_diabetes_bottom_nav')).toHaveCount(0);
  await expect(page.locator('[data-carb-calculator]')).toHaveClass(/--embedded/);
  await manual(page, '4.5', 'Extra');
  await expect(page.locator('[data-action="use-carb-calculator-total"]')).toHaveText('Use 34.5 g');
  // A software-keyboard-sized viewport still uses ordinary document scrolling.
  await page.setViewportSize({ width: 390, height: 430 });
  await page.locator('[name="carbFoodSearch"]').focus();
  await expect(page.locator('[name="carbFoodSearch"]')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => document.body.style.position)).not.toBe('fixed');
  await page.locator('[data-lee-lee-editor]').evaluate(form => form.requestSubmit());
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(before);
  await page.getByRole('button', { name: 'Cancel Carb Calculator', exact: true }).click();
  await assertDraft();
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(before);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-action="open-carb-calculator"]').click();
  await expect(page.locator('[data-carb-calculator-row]')).toHaveCount(2);
  await expect(page.locator('[data-action="use-carb-calculator-total"]')).toHaveText('Use 34.5 g');
  await page.screenshot({ path: testInfo.outputPath('entry-fullscreen-iphone.png'), fullPage: true });
  await page.locator('[data-action="use-carb-calculator-total"]').click();
  await assertDraft('34.5');
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(before);
  await page.locator('[data-action="open-carb-calculator"]').click();
  await expect(page.locator('[data-carb-calculator-row]')).toHaveCount(2);
  await expect(page.locator('[data-carb-calculator-total]')).toHaveText('34.5 g');
  await page.getByRole('button', { name: 'Cancel Carb Calculator', exact: true }).click();
  await assertDraft('34.5');
  await page.locator('[name="mealCarbs"]').fill('50');
  await page.locator('[data-action="open-carb-calculator"]').click();
  await expect(page.locator('[data-carb-calculator-row]')).toHaveCount(1);
  await expect(page.locator('[data-carb-calculator-total]')).toHaveText('50 g');
  await page.getByRole('button', { name: 'Cancel Carb Calculator', exact: true }).click();
  await assertDraft('50');
  expect(await stored(page)).toHaveLength(0);
});

for (const theme of ['light', 'dark']) {
  test('matching full-page calculator presentation in ' + theme, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    const presentation = () => page.locator('[data-carb-calculator]').evaluate(calc => {
      const properties = node => {
        const css = getComputedStyle(node), rect = node.getBoundingClientRect();
        return { x: rect.x, width: rect.width, font: css.font, color: css.color, padding: css.padding, margin: css.margin };
      };
      return {
        heading: (() => { const { width, ...style } = properties(document.querySelector('.lee_lee_diabetes_top h1')); return style; })(),
        support: (() => { const node = document.querySelector('.lee_lee_diabetes_page_support'); const { width, ...style } = properties(node); return { ...style, height: node.getBoundingClientRect().height }; })(),
        intro: properties(calc.querySelector('.lee_lee_diabetes_carb_intro')),
        search: properties(calc.querySelector('[name="carbFoodSearch"]')),
        selection: properties(calc.querySelector('[data-carb-calculator-selection]')),
        total: properties(calc.querySelector('[data-carb-calculator-total]')),
      };
    });
    await scratch(page);
    await manual(page, '12', 'Test amount');
    await expect(page.locator('.lee_lee_diabetes_bottom_nav')).toHaveCount(0);
    const standalone = await presentation();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: '/private/tmp/llt-visual-' + testInfo.project.name + '-' + theme + '-standalone.png' });
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: 'Log Entry', exact: true }).click();
    await page.locator('[name="type"]').selectOption('Snacks');
    await page.locator('[data-action="open-carb-calculator"]').click();
    await manual(page, '12', 'Test amount');
    await expect(page.locator('.lee_lee_diabetes_bottom_nav, [data-foods-view-switcher]')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Carb Calculator', exact: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Cancel Carb Calculator' })).toBeVisible();
    await expect(page.locator('[data-action="use-carb-calculator-total"]')).toHaveText('Use 12 g');
    expect(await presentation()).toEqual(standalone);
    await expect(page.locator('[data-lee-lee-editor]')).toHaveCSS('border-top-width', '0px');
    await expect(page.locator('[data-lee-lee-editor]')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: '/private/tmp/llt-visual-' + testInfo.project.name + '-' + theme + '-entry.png' });
    await page.setViewportSize({ width: 390, height: 430 });
    await page.locator('[name="carbFoodSearch"]').focus();
    await page.locator('[name="carbFoodSearch"]').scrollIntoViewIfNeeded();
    await expect(page.locator('[name="carbFoodSearch"]')).toBeInViewport();
    await page.locator('[name="carbFoodSearch"]').blur();
    await page.locator('[data-action="use-carb-calculator-total"]').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-action="use-carb-calculator-total"]')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
