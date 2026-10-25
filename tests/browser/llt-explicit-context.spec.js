import { expect, test } from '@playwright/test';
import { createIPhoneDevServer } from '../../scripts/dev-iphone.mjs';

let server;
let baseURL;
const key = 'lando-world:lee-lees-tracker:v1';
test.beforeAll(async () => {
  server = createIPhoneDevServer({ bindAddress: { address: '127.0.0.1', netmask: '255.0.0.0' }, getMetadata: async () => ({ environment: 'local-device', appVersion: '1.0.0', branch: 'fix/llt-explicit-context', commit: 'test', commitFull: 'test', dirty: true, sourceId: 'explicit-context-test' }) });
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
const context = page => root(page).locator('[name=type]');
const save = page => root(page).locator('[data-save-record]');
const stored = page => page.evaluate(key => localStorage.getItem(key), key);
async function newEntry(page) {
  await root(page).getByRole('button', { name: 'Log Entry', exact: true }).last().click();
  await expect(context(page)).toHaveValue('');
  await expect(context(page).locator('option:checked')).toHaveText('Select a context…');
}

test('every new entry is unset; missing context blocks all writes with accessible inline feedback', async ({ page }, info) => {
  const remote = await open(page);
  await newEntry(page);
  const before = await stored(page);
  await root(page).locator('[name=notes]').fill('Keep my draft');
  await root(page).locator('[name=date]').fill('2020-01-02');
  await expect(context(page)).toHaveValue('');
  await expect(save(page)).toHaveJSProperty('disabled', false);
  expect((await context(page).boundingBox()).height).toBeGreaterThanOrEqual(44);
  expect((await save(page).boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.setViewportSize({ width: 390, height: 400 });
  await save(page).click();
  await expect(root(page).locator('[data-context-error]')).toHaveText('Select a context before saving.');
  await expect(context(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(context(page)).toBeFocused();
  await expect(root(page).locator('[name=notes]')).toHaveValue('Keep my draft');
  expect(await stored(page)).toBe(before);
  await page.screenshot({ path: info.outputPath('context-error.png') });
  await root(page).locator('[name=date]').fill('');
  await expect(save(page)).toBeEnabled();
  await save(page).click();
  await expect(root(page).locator('[data-context-error]')).toBeVisible();
  expect(await stored(page)).toBe(before);
  await root(page).locator('[name=date]').fill('2020-01-02');
  await context(page).selectOption('Correction');
  await expect(root(page).locator('[data-context-error]')).toBeHidden();
  await expect(context(page)).not.toHaveAttribute('aria-invalid', 'true');
  await root(page).locator('[name=insulinUnits]').fill('');
  await save(page).click();
  await newEntry(page);
  await root(page).locator('[data-action=cancel]').click();
  await newEntry(page);
  expect(remote).toEqual([]);
});

test('scheduled contexts remain disabled without fallback; edit retains saved context and note-only safety', async ({ page }) => {
  const today = await page.evaluate(() => { const d = new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-'); });
  const timestamp = today + 'T12:00:00';
  await open(page, ['Breakfast', 'Lunch', 'Dinner', 'Bedtime'].map((type, i) => ({ id: `scheduled-${i}`, type, eventType: 'check-insulin', recordTimestamp: timestamp, createdAt: timestamp, updatedAt: timestamp, bloodSugar: 120, mealCarbs: 10, notes: 'original' })));
  await newEntry(page);
  for (const type of ['Breakfast', 'Lunch', 'Dinner', 'Bedtime']) await expect(context(page).locator(`option[value="${type}"]`)).toHaveJSProperty('disabled', true);
  for (const type of ['Snacks', 'Correction', 'Low Glucose']) await expect(context(page).locator(`option[value="${type}"]`)).toHaveJSProperty('disabled', false);
  await context(page).selectOption('Correction');
  await root(page).locator('[name=date]').fill('2020-01-02');
  await expect(context(page)).toHaveValue('Correction');
  await context(page).selectOption('Dinner');
  await root(page).locator('[name=date]').fill(today);
  await expect(context(page)).toHaveValue('Dinner');
  await root(page).locator('[name=mealCarbs]').fill('10');
  const before = await stored(page);
  await save(page).click();
  await expect(root(page).locator('[data-editor-error]')).toContainText('Dinner has already been logged');
  expect(await stored(page)).toBe(before);
  await root(page).locator('[data-action=cancel]').click();
  await root(page).locator('[data-action=edit-today-record]').first().click();
  await expect(root(page).locator('[data-context-help], [data-context-calculator-placeholder]')).toHaveCount(0);
  const savedType = await context(page).inputValue();
  expect(['Breakfast','Lunch','Dinner','Bedtime']).toContain(savedType);
  await expect(context(page).locator(`option[value="${savedType}"]`)).toHaveJSProperty('disabled', false);
  await root(page).locator('[name=notes]').fill('note-only correction');
  await save(page).click();
  const after = JSON.parse(await stored(page)).records;
  expect(after).toHaveLength(4);
  expect(after.find(r => r.type === savedType).notes).toBe('note-only correction');
});

test('unset Context explains calculator availability; chosen contexts keep their original fields', async ({ page }, info) => {
  await open(page);
  await newEntry(page);
  const helper = root(page).locator('[data-context-help]');
  const placeholder = root(page).locator('[data-context-calculator-placeholder]');
  await expect(helper).toHaveText('Choose a context to show the fields for this entry.');
  await expect(context(page)).toHaveAttribute('aria-describedby', /lee-lee-context-help/);
  await expect(placeholder.getByRole('button')).toBeDisabled();
  await expect(placeholder).toContainText('meal, snack, or Low Glucose');
  await expect(root(page).locator('[name=mealCarbs]')).toHaveCount(0);
  // Investigate native select focus without adding an automatic-focus policy.
  const before = await page.evaluate(() => window.scrollY);
  await context(page).evaluate(el => el.focus({ preventScroll: true }));
  await expect(context(page)).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  await root(page).locator('[name=notes]').fill('Keep focus and draft');
  await expect(root(page).locator('[name=notes]')).toBeFocused();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 700 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      await context(page).scrollIntoViewIfNeeded();
      await expect(helper).toBeVisible();
      await expect(placeholder).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`unset-context-${width}-${theme}.png`), fullPage: true });
    }
  }
  await context(page).focus();
  await page.keyboard.press('Tab');
  await expect(root(page).locator('[name=bloodSugar]')).toBeFocused();
  for (const type of ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Low Glucose', 'Correction', 'Bedtime']) {
    await context(page).selectOption(type);
    await expect(helper).toHaveCount(0);
    await expect(placeholder).toHaveCount(0);
    const usesCalculator = !['Correction', 'Bedtime'].includes(type);
    await expect(root(page).locator('[data-action=open-carb-calculator]')).toHaveCount(usesCalculator ? 1 : 0);
    await expect(root(page).locator('[name=mealCarbs]')).toHaveCount(usesCalculator ? 1 : 0);
    if (usesCalculator) await expect(root(page).locator('[data-carb-entry] h2')).toHaveText(type === 'Low Glucose' ? 'Treatment Carbs' : 'Meal Carbs');
    await expect(root(page).locator('[name=notes]')).toHaveValue('Keep focus and draft');
  }
  await root(page).locator('[data-action=cancel]').click();
  await newEntry(page);
  await expect(helper).toBeVisible();
});
