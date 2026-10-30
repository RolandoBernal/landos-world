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

for (const theme of ['dark', 'light']) {
  for (const entry of [false, true]) {
    test(`${theme} ${entry ? 'entry' : 'standalone'} quantity controls and existing actions`, async ({ page }, testInfo) => {
      await open(page);
      await page.setViewportSize({ width: 320, height: 740 });
      await page.evaluate(theme => window.LandosTheme.setPreference(theme), theme);
      await page.evaluate(() => window.LeeLeeTrackerStorage.updateTrackerData(current => ({ ...current, foodLibrary: [...current.foodLibrary, { id: '90000000-0000-4000-8000-000000000001', name: 'Synthetic serving', carbs: 12.5, sourceType: 'user' }] })));
      if (entry) {
        await page.getByRole('button', { name: 'Log Entry', exact: true }).click();
        await page.locator('[name="type"]').selectOption('Snacks');
        await page.locator('[name="notes"]').fill('Synthetic draft');
        await page.locator('[data-action="open-carb-calculator"]').click();
      } else await scratch(page);
      await page.locator('[name="carbFoodSearch"]').fill('Synthetic serving');
      await page.locator('[data-action="add-food-to-carb-calculator"]').click();
      const row = page.locator('[data-carb-calculator-row]');
      const minus = page.getByRole('button', { name: 'Decrease quantity for Synthetic serving', exact: true });
      const plus = page.getByRole('button', { name: 'Increase quantity for Synthetic serving', exact: true });
      await expect(minus).toBeDisabled();
      await plus.click();
      await expect(row.locator('[aria-label="Quantity"]')).toHaveText('2');
      await expect(row.locator('[aria-label="Calculated row total"]')).toHaveText('25 g');
      await expect(page.locator('[data-carb-calculator-total]')).toHaveText('25 g');
      await minus.click();
      await expect(minus).toBeDisabled();
      await expect(page.locator('[data-carb-calculator-total]')).toHaveText('12.5 g');
      await page.getByRole('button', { name: 'Edit Synthetic serving', exact: true }).click();
      await page.locator('[name="carbItemQty"]').fill('1.5');
      await page.getByRole('button', { name: 'Save Item', exact: true }).click();
      await plus.click();
      await expect(page.locator('[data-carb-calculator-total]')).toHaveText('31.25 g');
      const boxes = await row.locator('button').evaluateAll(nodes => nodes.map(n => { const b=n.getBoundingClientRect(); return {left:b.left,right:b.right}; }));
      for (const box of boxes) { expect(box.left).toBeGreaterThanOrEqual(0); expect(box.right).toBeLessThanOrEqual(320); }
      await page.screenshot({ path: testInfo.outputPath('quantity.png'), fullPage: true });
      await page.getByRole('button', { name: 'Remove Synthetic serving', exact: true }).click();
      await expect(row).toHaveCount(0);
      await manual(page, '10');
      if (entry) {
        await page.locator('[data-action="use-carb-calculator-total"]').click();
        await expect(page.locator('[name="mealCarbs"]')).toHaveValue('10');
        await expect(page.locator('[name="notes"]')).toHaveValue('Synthetic draft');
      } else await page.getByRole('button', { name: 'Done', exact: true }).click();
      expect(await stored(page)).toHaveLength(0);
    });
  }
  test(`${theme} normal dose surface and warnings`, async ({ page }, testInfo) => {
    await open(page);
    await page.evaluate(theme => window.LandosTheme.setPreference(theme), theme);
    // Presentation-only fixture avoids bypassing any real insulin verification gate.
    await page.locator('#lee-lee-diabetes-root').evaluate(root => root.insertAdjacentHTML('beforeend', '<section class="lee_lee_diabetes_dose_card"><div class="lee_lee_diabetes_dose_label">Suggested dose</div><div class="lee_lee_diabetes_dose_total">Synthetic dose</div><p>Explanatory text</p></section><section class="lee_lee_diabetes_dose_card lee_lee_diabetes_dose_card--notice lee_lee_diabetes_dose_card--verification-warning">Warning</section>'));
    const colors = await page.locator('.lee_lee_diabetes_dose_card').evaluateAll(nodes => nodes.map(n => {const s=getComputedStyle(n); return {bg:s.backgroundColor,border:s.borderTopColor};}));
    expect(colors[0].bg).toBe(theme === 'dark' ? 'rgb(28, 28, 30)' : 'rgb(255, 255, 255)');
    expect(colors[0].border).not.toBe(colors[1].border);
    await page.screenshot({ path: testInfo.outputPath('dose.png'), fullPage: true });
  });
}
