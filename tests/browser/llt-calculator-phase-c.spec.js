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
    await root(page).getByRole('button', { name: 'Carb Calc', exact: true }).click();
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
  test(`${context}: successful reference, custom and meal additions reset discovery without replacing input`, async ({ page }, info) => {
    await seed(page); await enter(page, context);
    const query = root(page).locator('[name="carbFoodSearch"]');
    const input = await query.elementHandle();
    for (const [term, name] of [['banana', /^Add Banana /], ['Office', /^Add Office snack /], ['Cub', /^Add meal Cub Meal/]]) {
      await query.fill(term);
      await page.screenshot({ path: info.outputPath(`search-${term}-before.png`) });
      await root(page).getByRole('button', { name }).click();
      await expect(query).toHaveValue('');
      await expect(query).not.toBeFocused();
      await expect(root(page).locator('[data-action="add-food-to-carb-calculator"], [data-action="add-saved-meal-to-carb-calculator"]')).toHaveCount(0);
      expect(await query.evaluate((node, original) => node === original, input)).toBe(true);
      await page.screenshot({ path: info.outputPath(`search-${term}-after.png`) });
    }
    await query.fill('Office');
    const retry = await root(page).locator(`[data-action="add-food-to-carb-calculator"][data-id="${foodId}"]`).elementHandle();
    await retry.evaluate(n => { n.dataset.id = 'missing-food'; });
    await retry.click();
    await expect(query).toHaveValue('Office');
    await root(page).getByRole('button', { name: '+ Add Manual Amount...' }).click();
    await root(page).getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(query).toHaveValue('Office');
    await expect(root(page).locator('[data-carb-calculator-row]')).toHaveCount(3);
    expect((await stored(page)).records).toHaveLength(0);
  });

  test(`${context}: favorites/recent toggle, bounded long lists keep every item accessible`, async ({ page }, info) => {
    await seed(page);
    await page.evaluate(() => window.LeeLeeTrackerStorage.updateTrackerData(current => ({ ...current, foodLibrary: [...current.foodLibrary, ...Array.from({ length: 65 }, (_, i) => ({ id: `33333333-3333-4333-8333-${String(i).padStart(12, '0')}`, name: `Long list ${String(i).padStart(2, '0')}`, carbs: 1, favorite: true, lastUsedAt: '2026-10-15T12:00:00Z', sourceType: 'user' }))] })));
    await enter(page, context); await page.setViewportSize({ width: 390, height: 844 });
    const list = root(page).locator('[data-carb-library-list]');
    const favorites = root(page).getByRole('button', { name: 'Favorites', exact: true });
    const recent = root(page).getByRole('button', { name: 'Recent', exact: true });
    for (const [button, other, title] of [[favorites, recent, 'favorites'], [recent, favorites, 'recent']]) {
      await button.click(); await expect(button).toHaveAttribute('aria-expanded', 'true');
      await expect(other).toHaveAttribute('aria-expanded', 'false');
      const metrics = await list.evaluate(n => ({ height: n.clientHeight, scroll: n.scrollHeight, viewport: innerHeight }));
      expect(metrics.scroll).toBeGreaterThan(metrics.height); expect(metrics.height).toBeLessThanOrEqual(metrics.viewport * 0.45 + 1);
      expect(await list.locator('[data-action="add-food-to-carb-calculator"]').count()).toBeGreaterThan(60);
      await page.screenshot({ path: info.outputPath(`${title}-open.png`) });
      await list.evaluate(n => { n.scrollTop = n.scrollHeight; });
      await expect(button).toBeVisible();
      await button.click(); await expect(button).toHaveAttribute('aria-expanded', 'false');
      await expect(list.locator('[data-action="add-food-to-carb-calculator"]')).toHaveCount(0);
      await page.screenshot({ path: info.outputPath(`${title}-closed.png`) });
    }
    await favorites.click(); await recent.click(); await expect(favorites).toHaveAttribute('aria-expanded', 'false');
    const query = root(page).locator('[name="carbFoodSearch"]');
    await query.fill('Office'); await expect(root(page).locator('[data-picker=recent]')).toHaveAttribute('aria-expanded', 'false');
    await query.fill(''); await expect(list.locator('[data-action="add-food-to-carb-calculator"]')).toHaveCount(0);
    await favorites.click(); await list.getByRole('button', { name: /^Add Long list 64 / }).click();
    await expect(favorites).toHaveAttribute('aria-expanded', 'false');
    await expect(root(page).locator('[data-carb-calculator-total]')).toHaveText('1 g');
  });

  test(`${context}: manual fields stay compact, preview shares arithmetic and rejects invalid values`, async ({ page }, info) => {
    await seed(page); await enter(page, context);
    await root(page).locator('[name="carbFoodSearch"]').fill('Office');
    await root(page).getByRole('button', { name: /^Add Office snack / }).click();
    await root(page).getByRole('button', { name: '+ Add Manual Amount...' }).click();
    const carbs = root(page).locator('[name="carbItemCarbs"]');
    const qty = root(page).locator('[name="carbItemQty"]');
    const preview = root(page).locator('[data-carb-item-preview]');
    await expect(qty).toHaveValue('1'); await expect(preview).toHaveText('—');
    await carbs.fill('27.5'); await expect(preview).toHaveText('27.5 g');
    await qty.fill('2'); await expect(preview).toHaveText('55 g');
    await carbs.fill('27.555'); await expect(preview).toHaveText('55.12 g');
    await carbs.fill('27.5');
    for (const value of ['', '0', '-1', '1.234']) { await qty.fill(value); await expect(preview).toHaveText('—'); await expect(root(page).getByRole('button', { name: 'Add Item', exact: true })).toBeDisabled(); }
    await qty.fill('2'); await carbs.fill('-1'); await expect(preview).toHaveText('—');
    await carbs.fill('27.5');
    for (const viewport of [{width: 390, height: 844}, {width: 844, height: 390}, {width: 320, height: 420}]) {
      await page.setViewportSize(viewport); await qty.focus();
      const gaps = await root(page).locator('[data-carb-item-editor] label').evaluateAll(nodes => nodes.map(n => { const input = n.querySelector('input'); const range = document.createRange(); range.selectNodeContents(n.firstChild); return input.getBoundingClientRect().top - range.getBoundingClientRect().bottom; }));
      for (const gap of gaps) expect(gap).toBeLessThan(35);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`manual-${viewport.width}-${viewport.height}.png`) });
    }
    await root(page).getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(root(page).locator('[data-carb-calculator-total]')).toHaveText('10 g');
    await manual(page, '27.555', '2');
    await expect(root(page).locator('[data-carb-calculator-total]')).toHaveText('65.12 g');
    expect((await stored(page)).records).toHaveLength(0);
  });

  test(`${context}: production inline actions, metadata and mixed rows fit both themes`, async ({ page }, info) => {
    await seed(page); await enter(page, context);
    for (const [term, name] of [['Office', /^Add Office snack /], ['Cub', /^Add meal Cub Meal/]]) {
      await root(page).locator('[name="carbFoodSearch"]').fill(term); await root(page).getByRole('button', { name }).click();
    }
    await manual(page, '3', '2');
    await expect(root(page).locator('.lee_lee_diabetes_carb_sources')).toHaveCount(0);
    for (const theme of ['light', 'dark']) {
      await page.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
      for (const width of [320, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        const metrics = await root(page).locator('[data-carb-calculator-row]').evaluateAll(nodes => nodes.map(n => {
          const parts = ['item','row_total','actions'].map(c => n.querySelector(`.lee_lee_diabetes_carb_calc_${c}`).getBoundingClientRect());
          return { parts: parts.map(r => ({left:r.left,right:r.right,top:r.top,bottom:r.bottom})), buttons: [...n.querySelectorAll('button')].map(b => ({w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height})) };
        }));
        for (const row of metrics) { expect(row.parts[0].right).toBeLessThanOrEqual(row.parts[1].left+1); expect(row.parts[2].top).toBeGreaterThanOrEqual(row.parts[0].bottom); for (const b of row.buttons) { expect(b.w).toBeGreaterThanOrEqual(44); expect(b.h).toBeGreaterThanOrEqual(44); } }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await root(page).locator('[data-carb-calculator-selection]').scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath(`selected-${theme}-${width}.png`) });
      }
    }
    await root(page).getByRole('button', { name: 'Edit Office snack', exact: true }).click();
    await root(page).locator('[name="carbItemQty"]').fill('2');
    await root(page).getByRole('button', { name: 'Save Item', exact: true }).click();
    await expect(root(page).locator('[data-carb-calculator-total]')).toHaveText('94 g');
    await root(page).getByRole('button', { name: `Remove ${mealName}`, exact: true }).click();
    await expect(root(page).locator('[data-carb-calculator-total]')).toHaveText('26 g');
    expect((await stored(page)).foodLibrary.find(f => f.id === foodId).servingLabel).toBe('1 portion');
  });
}
