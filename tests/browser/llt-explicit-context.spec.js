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
  await expect(context(page).locator('option:checked')).toHaveText('Choose a context...');
}

test('new entry requires context, never focuses an input, and blocks missing or invalid writes', async ({ page }) => {
  const remote = await open(page);
  await newEntry(page);
  const before = await stored(page);
  await expect(context(page)).toBeEnabled();
  await expect(context(page)).not.toBeFocused();
  expect(await page.evaluate(() => document.activeElement.matches('input, textarea'))).toBe(false);
  for (const name of ['bloodSugar', 'mealCarbs', 'insulinUnits', 'notes', 'date', 'time']) {
    await expect(root(page).locator(`[name="${name}"]`)).toBeVisible();
    await expect(root(page).locator(`[name="${name}"]`)).toBeDisabled();
  }
  await expect(root(page).locator('[data-action=open-carb-calculator]')).toBeDisabled();
  await expect(save(page)).toBeDisabled();
  // Exercise the save guard even when native disabled-button protection is bypassed.
  for (const value of ['', 'invalid-context']) {
    await context(page).evaluate((select, value) => {
      if (value) select.add(new Option('Invalid', value));
      select.value = value;
      select.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }, value);
    await expect(root(page).locator('[data-context-error]')).toHaveText('Select a context before saving.');
    expect(await stored(page)).toBe(before);
  }
  await context(page).selectOption('Correction');
  await expect(root(page).locator('[name=bloodSugar]')).toBeEnabled();
  expect(await page.evaluate(() => document.activeElement.matches('input, textarea'))).toBe(false);
  await expect(save(page)).toBeEnabled();
  await root(page).locator('[data-action=cancel]').click();
  await root(page).locator('.lee_lee_diabetes_bottom_nav [data-action=history]').click();
  await root(page).locator('.lee_lee_diabetes_bottom_nav [data-action=today]').click();
  await newEntry(page);
  expect(await stored(page)).toBe(before);
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
  await expect(context(page).locator('option[value=""]')).toHaveCount(0);
  await expect(root(page).locator('[name=bloodSugar]')).toHaveValue('120');
  await expect(root(page).locator('[name=bloodSugar]')).toBeEnabled();
  const savedType = await context(page).inputValue();
  expect(['Breakfast','Lunch','Dinner','Bedtime']).toContain(savedType);
  await expect(context(page).locator(`option[value="${savedType}"]`)).toHaveJSProperty('disabled', false);
  await root(page).locator('[name=notes]').fill('note-only correction');
  await save(page).click();
  const after = JSON.parse(await stored(page)).records;
  expect(after).toHaveLength(4);
  expect(after.find(r => r.type === savedType).notes).toBe('note-only correction');
});

test('context fields and tools follow valid selections in light and dark mode', async ({ page }, info) => {
  await open(page);
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    await newEntry(page);
    await expect(root(page).locator('[name=bloodSugar]')).toBeDisabled();
    await page.screenshot({ path: info.outputPath(`pending-${theme}.png`), fullPage: true });
    await context(page).selectOption('Breakfast');
    await root(page).locator('[name=notes]').fill('Keep my draft');
    for (const type of ['Lunch', 'Dinner', 'Snacks', 'Low Glucose', 'Correction', 'Bedtime']) {
      await context(page).selectOption(type);
      expect(await page.evaluate(() => document.activeElement.matches('input, textarea'))).toBe(false);
      await expect(root(page).locator('[name=bloodSugar]')).toBeEnabled();
      const usesCalculator = !['Correction', 'Bedtime'].includes(type);
      await expect(root(page).locator('[data-action=open-carb-calculator]')).toHaveCount(usesCalculator ? 1 : 0);
      if (usesCalculator) await expect(root(page).locator('[data-action=open-carb-calculator]')).toBeEnabled();
      await expect(root(page).locator('[name=notes]')).toHaveValue('Keep my draft');
    }
    await page.screenshot({ path: info.outputPath(`selected-${theme}.png`), fullPage: true });
    await root(page).locator('[data-action=cancel]').click();
  }
});
