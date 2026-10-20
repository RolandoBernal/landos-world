import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
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
  await page.waitForFunction(() => Boolean(window.LeeLeeTrackerStorage));
  return remote;
}



const root = page => page.locator('#lee-lee-diabetes-root');
const foodId = '11111111-1111-4111-8111-111111111111';
const mealName = 'Cub Meal w/chow mein noodles + orange chicken';
async function seed(page, records = []) {
  await open(page, records);
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



async function mockKeyboard(page, height, offsetTop = 0) {
  await page.evaluate(({ height, offsetTop }) => {
    const listeners = window.__c1ViewportListeners ||= {};
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: {
      width: innerWidth, height, offsetTop, offsetLeft: 0, scale: 1,
      addEventListener(type, fn) { (listeners[type] ||= new Set()).add(fn); },
      removeEventListener(type, fn) { listeners[type]?.delete(fn); },
    } });
    dispatchEvent(new Event('resize'));
    listeners.resize?.forEach(fn => fn(new Event('resize')));
  }, { height, offsetTop });
}

test('history contains nested JSON and unbroken values without losing before/after data', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 320, height: 700 });
  // Exercise the production renderer with synthetic history; local-device mode intentionally has no sync repository.
  const source = readFileSync(new URL('../../js/lee-lee-diabetes-tracker.js', import.meta.url), 'utf8');
  const start = source.indexOf('  function formatSettingsAuditValue(');
  const end = source.indexOf('  const SETTINGS_DIAGNOSTIC_SECTION_BY_KEY', start);
  const renderer = source.slice(start, end);
  await page.evaluate(({ renderer }) => {
    const long = 'identifier'.repeat(80);
    const events = [2, 1].map(n => ({ status: 'Accepted', displayName: long, deviceLabel: long,
      clientCreatedAt: `2026-10-19T12:0${n}:00Z`, changes: [
        { label: 'Temporary eating adjustment', previousValue: { nested: [{ key: long }] }, newValue: { nested: { enabled: true, id: long } } },
        { label: long, previousValue: long, newValue: 'after' },
      ] }));
    const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const render = new Function('syncRepository', 'escapeHtml', 'isSettingsAccordionOpen', 'renderSettingsDiagnosticAction', renderer + ';return renderSettingsChangeHistory();');
    document.querySelector('#lee-lee-diabetes-root').innerHTML = render({ getSettingsAuditHistory: () => events }, escapeHtml, () => true, () => '');
  }, { renderer });
  const cards = page.locator('.lee_lee_diabetes_audit_event');
  await expect(cards).toHaveCount(2);
  await expect(cards.first().locator('pre')).toHaveCount(4);
  await expect(cards.first().locator('pre').first()).not.toBeVisible();
  for (const details of await cards.locator('details').all()) await details.locator('summary').click();
  await expect(cards.first().locator('pre').first()).toContainText('nested');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await cards.evaluateAll(nodes => nodes.every(card => [...card.querySelectorAll('pre, dt, dd')].every(node => node.getBoundingClientRect().right <= card.getBoundingClientRect().right)))).toBe(true);
  const boxes = await cards.evaluateAll(nodes => nodes.map(n => ({ top: n.getBoundingClientRect().top, bottom: n.getBoundingClientRect().bottom })));
  expect(boxes[0].bottom).toBeLessThanOrEqual(boxes[1].top);
});

for (const mode of ['new', 'edit']) test(`${mode} entry calculator permits vertical gestures, contains long content, and restores draft after cancel/use`, async ({ page }) => {
  const now = new Date().toISOString();
  await seed(page, mode === 'edit' ? [{ id: 'synthetic-snack', version: 1, type: 'Snacks', eventType: 'check-insulin', recordTimestamp: now, createdAt: now, updatedAt: now, mealCarbs: 20, totalCarbs: 20, notes: 'Saved synthetic note' }] : []);
  if (mode === 'new') await enter(page, 'entry');
  else {
    await root(page).locator('[data-action="history"]').first().click();
    await root(page).locator('[data-action="history-date"]').first().click();
    await root(page).locator('[data-action="edit-record"]').first().click();
    await root(page).locator('[name="notes"]').fill('Keep entry note');
    await root(page).locator('[data-action="open-carb-calculator"]').click();
  }
  const originalRecords = (await stored(page)).records;
  const calc = root(page).locator('[data-carb-calculator]');
  const body = calc.locator('[data-carb-calculator-body]');
  await expect(page.locator('body')).toHaveCSS('position', 'fixed');
  // Touch-action is intersected through ancestors before the browser handles a gesture.
  expect(await body.evaluate(n => { for (let p=n; p; p=p.parentElement) if (getComputedStyle(p).touchAction === 'none') return false; return true; })).toBe(true);
  await calc.locator('[name="carbFoodSearch"]').fill('Office');
  await calc.getByRole('button', { name: /^Add Office snack / }).click();
  await mockKeyboard(page, 360, 30);
  await calc.locator('[name="carbFoodSearch"]').focus();
  await expect(calc.locator('[name="carbFoodSearch"]')).toBeFocused();
  await calc.locator('[name="carbFoodSearch"]').blur();
  await mockKeyboard(page, 700);
  for (let i=0; i<8; i++) await manual(page, '5');
  expect(await body.evaluate(n => n.scrollHeight > n.clientHeight)).toBe(true);
  await body.evaluate(n => { n.scrollTop = n.scrollHeight; });
  await expect(calc.locator('[data-action="use-carb-calculator-total"]')).toBeInViewport();
  await calc.getByRole('button', { name: 'Cancel Carb Calculator' }).click();
  await expect(root(page).locator('[name="notes"]')).toHaveValue('Keep entry note');
  await expect(page.locator('body')).not.toHaveCSS('position', 'fixed');
  await root(page).locator('[data-action="open-carb-calculator"]').click();
  await manual(page, '12');
  await calc.locator('[data-action="use-carb-calculator-total"]').click();
  await expect(root(page).locator('[name="notes"]')).toHaveValue('Keep entry note');
  await expect(root(page).locator('[name="mealCarbs"]')).not.toHaveValue('');
  expect((await stored(page)).records).toEqual(originalRecords);
});
