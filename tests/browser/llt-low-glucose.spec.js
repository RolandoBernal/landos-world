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
async function newEpisode(page, glucose = '53', carbs = '15') {
  const root = page.locator('#lee-lee-diabetes-root');
  await root.getByRole('button', { name: 'Log Entry', exact: true }).last().click();
  await root.locator('[name=type]').selectOption('Low Glucose');
  await expect(root.locator('[name=insulinUnits]')).toHaveCount(0);
  await expect(root.locator('[name=mealCarbs]')).toHaveValue('');
  await root.locator('[name=bloodSugar]').fill(glucose);
  if (carbs !== '') await root.locator('[name=mealCarbs]').fill(carbs);
  return root;
}
async function save(page) { await page.locator('[data-save-record]').click(); }
async function done(page) { await page.locator('[data-action=low-done]').click(); }
async function stored(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)).records, key); }
async function recheck(page, glucose, carbs = '') {
  await page.locator('[data-action=low-record-recheck]').click();
  await expect(page.getByRole('heading', { name: 'Record Recheck' })).toBeVisible();
  await expect(page.locator('[name=mealCarbs]')).toHaveValue('');
  await page.locator('[name=bloodSugar]').fill(glucose);
  if (carbs !== '') await page.locator('[name=mealCarbs]').fill(carbs);
  await save(page);
}

test('Low Glucose complete synthetic episode, explicit outcome, timeline and historical recheck editing', async ({ page }, testInfo) => {
  const remote = await open(page);
  const root = await newEpisode(page);
  await root.locator('[name=notes]').fill('Synthetic local software test');
  await page.screenshot({ path: testInfo.outputPath('01-new-low-glucose.png'), fullPage: true });
  await save(page); await expect(page.getByRole('heading', { name: 'Episode Saved' })).toBeVisible();
  await done(page);
  await expect(root.locator('[data-low-glucose-episode]')).toHaveCount(1);
  await expect(root.locator('[data-low-glucose-episode]')).toContainText('Open');
  await expect(root.locator('.lee_lee_diabetes_low_summary > div')).toHaveText(['Lowest documented 53 mg/dL', 'Total recorded treatment 15 g carbs', '0 rechecks']);
  let records = await stored(page); expect(records).toHaveLength(1); expect(records[0].insulinUnits).toBeNull(); expect(records[0].doseCalculationStatus).toBe('not-applicable');
  await page.screenshot({ path: testInfo.outputPath('02-open-episode.png'), fullPage: true });
  await recheck(page, '61', '15'); await done(page);
  records = await stored(page); expect(records).toHaveLength(1); expect(records[0].lowGlucoseEpisode.rechecks).toHaveLength(1);
  await recheck(page, '84', '0');
  await expect(page.getByRole('heading', { name: 'Recheck Saved' })).toBeVisible();
  expect((await stored(page))[0].lowGlucoseEpisode.closure).toBeNull();
  await page.screenshot({ path: testInfo.outputPath('06-recovery-eligible.png'), fullPage: true });
  await page.locator('[data-low-dialog] [data-action=low-confirm-recovery]').click();
  await page.locator('[data-action=low-close-recovery]').click();
  await expect(root.locator('[data-low-glucose-episode]')).toContainText('Recovery Confirmed');
  await expect(root.locator('.lee_lee_diabetes_low_summary > div')).toHaveText(['Lowest documented 53 mg/dL', 'Total recorded treatment 30 g carbs', '2 rechecks']);
  await root.getByText('Episode timeline', { exact: true }).click();
  await expect(root.locator('details')).toHaveAttribute('open', '');
  await expect(root.locator('details')).toContainText('Recheck');
  await page.screenshot({ path: testInfo.outputPath('07-completed-expanded.png'), fullPage: true });
  const roundId = (await stored(page))[0].lowGlucoseEpisode.rechecks[1].id;
  await root.locator(`[data-round-id="${roundId}"]`).click();
  await page.locator('[name=bloodSugar]').fill('62'); await save(page);
  expect((await stored(page))[0].lowGlucoseEpisode.closure).toBeNull();
  expect((await stored(page))[0].lowGlucoseEpisode.rechecks[1].id).toBe(roundId);
  await done(page);
  await root.locator('[data-action=edit-today-record]').click();
  await expect(page.locator('[name=insulinUnits]')).toHaveCount(0);
  await page.locator('[name=notes]').fill('Historical note edit without insulin snapshot'); await save(page);
  expect((await stored(page))[0].lowGlucoseEpisode.rechecks).toHaveLength(2);
  await root.locator('[data-action=history]').first().click();
  await expect(root).toContainText('Low Glucose');
  expect(remote).toEqual([]);
});

test('Low Glucose timer purpose, fixed duration, completion and cross-device stale schedule', async ({ page }, testInfo) => {
  await open(page);
  await page.evaluate(() => window.LeeLeePreMealTimer.saveSettings({ enabled: false, durationMinutes: 60 }));
  await newEpisode(page, '53', '0'); await save(page);
  await page.locator('[data-action=low-start-timer]').click();
  await expect(page.getByRole('heading', { name: 'Low Glucose Recheck' })).toBeVisible();
  await expect(page.locator('[data-low-dialog]')).not.toContainText('Ready to eat');
  const timer = await page.evaluate(() => window.LeeLeePreMealTimer.getTimer());
  expect(timer.purpose).toBe('low-glucose-recheck'); expect(timer.durationMinutes).toBe(15);
  expect((await stored(page))[0].lowGlucoseEpisode.pendingRecheck.id).toBe(timer.scheduleId);
  await page.screenshot({ path: testInfo.outputPath('03-recheck-timer.png'), fullPage: true });
  await page.evaluate(timerKey => { const timer = JSON.parse(localStorage.getItem(timerKey)); timer.endsAt = Date.now() - 1; localStorage.setItem(timerKey, JSON.stringify(timer)); }, timerKey);
  await expect(page.getByRole('heading', { name: 'Recheck Glucose', exact: true })).toBeVisible();
  await page.locator('[data-action=low-timer-recheck]').click();
  await expect(page.getByRole('heading', { name: 'Record Recheck' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('04-record-recheck.png'), fullPage: true });
  await page.locator('[name=bloodSugar]').fill('61'); await save(page); await done(page);
  expect((await stored(page))[0].lowGlucoseEpisode.pendingRecheck).toBeNull();
  await page.locator('[data-action=low-offer-timer]').click(); await page.locator('[data-action=low-start-timer]').click(); await done(page);
  const before = await stored(page);
  // Simulate the existing storage/hydration boundary receiving Device B's round.
  await page.evaluate(({ key, timerKey }) => {
    const data = JSON.parse(localStorage.getItem(key)); const rec = data.records[0];
    rec.lowGlucoseEpisode.rechecks.push({ id: 'device-b-round', bloodSugar: 62, carbs: 0, recordTimestamp: new Date().toISOString() }); rec.lowGlucoseEpisode.pendingRecheck = null;
    rec.version += 1; rec.updatedAt = new Date().toISOString(); localStorage.setItem(key, JSON.stringify(data));
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(data) }));
    const timer = JSON.parse(localStorage.getItem(timerKey)); if (timer) { timer.endsAt = Date.now() - 1; localStorage.setItem(timerKey, JSON.stringify(timer)); }
  }, { key, timerKey });
  await expect.poll(() => page.evaluate(() => window.LeeLeePreMealTimer.getTimer())).toBeNull();
  expect((await stored(page))[0].lowGlucoseEpisode.rechecks).toHaveLength(before[0].lowGlucoseEpisode.rechecks.length + 1);
  await expect(page.locator('[data-action=low-timer-recheck]')).toHaveCount(0);
});

test('manual ending, initial threshold confirmation, context restriction, dark mode and keyboard scroll', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const root = await newEpisode(page, '84', '');
  await save(page);
  await expect(page.getByRole('heading', { name: 'Save Low Glucose episode?' })).toBeVisible();
  expect(await stored(page)).toHaveLength(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('[name=bloodSugar]')).toHaveValue('84');
  expect(await stored(page)).toHaveLength(0);
  await save(page);
  await page.locator('[data-action=low-confirm-initial]').click(); await done(page);
  await root.locator('[data-action=edit-today-record]').click();
  await page.locator('[name=type]').selectOption('Breakfast');
  await expect(page.locator('[name=type]')).toHaveValue('Low Glucose');
  await expect(page.locator('[data-editor-error]')).toContainText('original context');
  if (testInfo.project.name === 'mobile-chromium') {
    await page.setViewportSize({ width: 390, height: 400 });
    for (const name of ['bloodSugar', 'mealCarbs', 'notes']) {
      await page.locator(`[name=${name}]`).focus();
      await page.locator(`[name=${name}]`).scrollIntoViewIfNeeded();
      await expect(page.locator(`[name=${name}]`)).toBeInViewport();
    }
  }
  await page.locator('[name=notes]').focus();
  await page.locator('[data-save-record]').scrollIntoViewIfNeeded(); await expect(page.locator('[data-save-record]')).toBeInViewport();
  await save(page);
  await root.locator('[data-action=low-end-episode]').click();
  expect((await stored(page))[0].lowGlucoseEpisode.closure).toBeNull();
  await page.locator('[data-action=low-close-manual]').click();
  await expect(root).toContainText('Ended Without Confirmed Recovery');
  if (testInfo.project.name === 'mobile-chromium') await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.screenshot({ path: testInfo.outputPath('08-manual-ending-dark.png'), fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test('Carb Calculator integrates treatment snapshots and new-context insulin state clears', async ({ page }) => {
  await open(page); const root = await newEpisode(page, '53', '');
  await root.getByRole('button', { name: 'Open Carb Calculator' }).click();
  await expect(page.getByRole('dialog', { name: 'Carb Calculator' })).toBeVisible();
  await page.locator('[data-action=open-carb-calculator-item-editor]').click();
  await page.locator('[name=carbItemCarbs]').fill('12');
  await page.locator('[data-action=save-carb-calculator-item-editor]').click();
  await page.locator('[data-action=use-carb-calculator-total]').click();
  await expect(page.locator('[name=mealCarbs]')).toHaveValue('12');
  await expect(page.locator('[name=insulinUnits]')).toHaveCount(0);
  await page.locator('[name=type]').selectOption('Correction');
  await expect(page.locator('[name=insulinUnits]')).toHaveValue('0');
  await page.locator('[name=insulinUnits]').fill('5');
  await page.locator('[name=type]').selectOption('Low Glucose');
  await save(page); await done(page);
  const record = (await stored(page))[0]; expect(record.administeredInsulinUnits).toBeNull(); expect(record.insulinPlanId).toBeNull();
  expect(record.lowGlucoseEpisode.rechecks).toEqual([]);
});

function seedEpisode({ version = 1, yesterday = false, threshold = 70 } = {}) {
  const start = new Date(); if (yesterday) start.setDate(start.getDate() - 1);
  return { id: 'synthetic-episode', version: 1, type: 'Low Glucose', eventType: 'check-insulin', recordTimestamp: start.toISOString(), createdAt: start.toISOString(), updatedAt: start.toISOString(),
    bloodSugar: 53, mealCarbs: 15, totalCarbs: 15, insulinUnits: null, administeredInsulinUnits: null,
    suggestedBaseUnits: null, suggestedCorrectionUnits: null, suggestedTotalUnits: null, insulinPlanId: null, insulinPlanSnapshot: null, doseCalculationStatus: 'not-applicable',
    lowGlucoseEpisode: { version, thresholdSnapshot: threshold == null ? null : { lowMgDl: threshold }, rechecks: [], closure: null, pendingRecheck: null } };
}

test('previous-day open episode remains reachable and midnight recheck stays in its original History group', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'chromium') await page.setViewportSize({ width: 1024, height: 768 });
  const seed = seedEpisode({ yesterday: true }); await open(page, [seed]);
  await expect(page.getByRole('heading', { name: 'Open Low Glucose Episodes' })).toBeVisible();
  await recheck(page, '61', '0'); await done(page);
  const record = (await stored(page))[0]; expect(record.recordTimestamp).toBe(seed.recordTimestamp); expect(record.lowGlucoseEpisode.rechecks).toHaveLength(1);
  await page.locator('[data-action=history]').first().click();
  await expect(page.locator('#lee-lee-diabetes-root')).toContainText('Low Glucose');
  await page.screenshot({ path: testInfo.outputPath('09-midnight-history.png'), fullPage: true });
  await page.locator('[data-action=reports]').first().click();
  await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
});

test('unavailable threshold permits factual recording and manual ending but never recovery confirmation', async ({ page }) => {
  const seed = seedEpisode({ threshold: null }); await open(page, [seed]);
  await expect(page.locator('[data-low-glucose-episode]')).toContainText('threshold unavailable');
  await recheck(page, '200', ''); await done(page);
  await expect(page.locator('[data-action=low-confirm-recovery]')).toHaveCount(0);
  await page.locator('[data-action=low-end-episode]').click(); await page.locator('[data-action=low-close-manual]').click();
  expect((await stored(page))[0].lowGlucoseEpisode.closure.kind).toBe('ended-without-confirmed-recovery');
});

test('future episode version remains preserved and its editor is read only', async ({ page }) => {
  const seed = seedEpisode({ version: 2 }); seed.lowGlucoseEpisode.future = { retained: 'synthetic' }; await open(page, [seed]);
  await expect(page.locator('#lee-lee-diabetes-root')).toContainText('Compatibility review required');
  await page.locator('[data-action=edit-today-record]').click();
  await expect(page.locator('#lee-lee-diabetes-root')).toContainText('cannot be edited safely');
  await expect(page.locator('[data-save-record]')).toHaveCount(0);
  expect((await stored(page))[0].lowGlucoseEpisode).toEqual(seed.lowGlucoseEpisode);
});

test('local persistence failure retains draft, starts no timer, and can retry safely as a new episode', async ({ page }) => {
  await open(page); await newEpisode(page, '53', '12');
  await page.evaluate(key => {
    const original = Storage.prototype.setItem; window.__restoreStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (name, value) { if (name === key) throw new Error('Synthetic quota failure'); return original.call(this, name, value); };
  }, key);
  await save(page); await expect(page.locator('[data-editor-error]')).toContainText('could not be saved locally');
  await expect(page.locator('[name=bloodSugar]')).toHaveValue('53'); await expect(page.locator('[name=mealCarbs]')).toHaveValue('12');
  expect(await stored(page)).toHaveLength(0); expect(await page.evaluate(() => window.LeeLeePreMealTimer.getTimer())).toBeNull();
  await page.evaluate(() => window.__restoreStorage()); await save(page); await done(page);
  expect(await stored(page)).toHaveLength(1);
});

test('existing pre-meal timer requires explicit choice; replacement leaves one purpose-aware timer', async ({ page }) => {
  await open(page); await page.evaluate(() => window.LeeLeePreMealTimer.start({ durationMinutes: 30, sourceEntryId: 'synthetic-meal' }));
  await newEpisode(page, '53', '15'); await save(page); await page.locator('[data-action=low-start-timer]').click();
  await expect(page.getByRole('heading', { name: 'Timer Already Running' })).toBeVisible();
  expect(await page.evaluate(() => window.LeeLeePreMealTimer.getTimer().purpose)).toBe('pre-meal');
  await page.keyboard.press('Tab'); expect(await page.evaluate(() => document.activeElement.closest('[data-low-dialog]') !== null)).toBe(true);
  await page.locator('[data-action=low-replace-timer]').click();
  expect(await page.evaluate(() => window.LeeLeePreMealTimer.getTimer().purpose)).toBe('low-glucose-recheck');
  const duplicateIds = await page.locator('#lee-lee-diabetes-root').evaluate(root => {
    const ids = [...root.querySelectorAll('[id]')].map(item => item.id); return ids.length !== new Set(ids).size;
  }); expect(duplicateIds).toBe(false);
  await done(page); expect((await stored(page))[0].lowGlucoseEpisode.closure).toBeNull();
});

test('saved initial and embedded recheck reuse Carb Calculator without losing episode state', async ({ page }) => {
  await open(page, [seedEpisode()]);
  const root = page.locator('#lee-lee-diabetes-root');
  await root.locator('[data-action=edit-today-record]').click();
  await page.locator('[data-action=open-carb-calculator]').click();
  await expect(page.getByRole('dialog', { name: 'Carb Calculator' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel Carb Calculator' }).click();
  await expect(page.locator('[name=mealCarbs]')).toHaveValue('15');
  await save(page);
  const initial = (await stored(page))[0];
  await root.locator('[data-action=low-record-recheck]').click();
  await page.locator('[name=bloodSugar]').fill('61');
  await page.locator('[data-action=open-carb-calculator]').click();
  await page.locator('[data-action=open-carb-calculator-item-editor]').click();
  await page.locator('[name=carbItemCarbs]').fill('12');
  await page.locator('[data-action=save-carb-calculator-item-editor]').click();
  await page.locator('[data-action=use-carb-calculator-total]').click();
  await expect(page.locator('[name=bloodSugar]')).toHaveValue('61');
  await save(page); await done(page);
  const saved = (await stored(page))[0]; expect(saved.id).toBe(initial.id); expect(saved.mealCarbs).toBe(15);
  expect(saved.lowGlucoseEpisode.rechecks[0].carbs).toBe(12); expect(saved.lowGlucoseEpisode.rechecks[0].carbComponents).toHaveLength(1);
});

test('a completed local reminder cannot open a stale duplicate after another device rechecks', async ({ page }) => {
  await open(page); await newEpisode(page); await save(page); await page.locator('[data-action=low-start-timer]').click();
  await page.evaluate(timerKey => { const timer = JSON.parse(localStorage.getItem(timerKey)); timer.endsAt = Date.now() - 1; localStorage.setItem(timerKey, JSON.stringify(timer)); }, timerKey);
  await expect(page.locator('[data-action=low-timer-recheck]')).toBeVisible();
  await page.evaluate(key => {
    const data = JSON.parse(localStorage.getItem(key)); const record = data.records[0];
    record.lowGlucoseEpisode.rechecks.push({ id: 'other-device', bloodSugar: 61, carbs: 0, recordTimestamp: new Date().toISOString() });
    record.lowGlucoseEpisode.pendingRecheck = null; record.version += 1; record.updatedAt = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(data)); window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(data) }));
  }, key);
  await page.locator('[data-action=low-timer-recheck]').click();
  await expect(page.getByRole('heading', { name: 'Record Recheck' })).toHaveCount(0);
  expect((await stored(page))[0].lowGlucoseEpisode.rechecks).toHaveLength(1);
});

test('Low Glucose secondary typography matches numeric text in both themes and responsive viewports', async ({ page }, testInfo) => {
  await open(page);
  await newEpisode(page, '63', '15');
  const initialNote = '0 units given. 15g of fast carbs to bring glucose level up to normal range.';
  const recheckNote = 'Glucose levels back to normal range';
  await page.locator('[name=notes]').fill(initialNote);
  await save(page); await done(page);
  await page.locator('[data-action=low-record-recheck]').click();
  await page.locator('[name=bloodSugar]').fill('72');
  await page.locator('[name=mealCarbs]').fill('0');
  await page.locator('[name=notes]').fill(recheckNote);
  await save(page); await done(page);
  const card = page.locator('[data-low-glucose-episode]');
  await card.locator('summary').click();
  await expect(card.locator('.lee_lee_diabetes_low_summary > div')).toHaveText(['Lowest documented 63 mg/dL', 'Total recorded treatment 15 g carbs', '1 recheck']);
  const positions = await card.locator('.lee_lee_diabetes_low_summary > div').evaluateAll(rows => rows.map(row => row.getBoundingClientRect().y));
  expect(positions[1]).toBeGreaterThan(positions[0]);
  expect(positions[2]).toBeGreaterThan(positions[1]);
  const original = await stored(page);
  for (const viewport of [{ width: 390, height: 844 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      await page.evaluate(() => document.fonts.ready);
      const family = await card.locator('.lee_lee_diabetes_numeric').first().evaluate(node => getComputedStyle(node).fontFamily);
      expect(family).toContain('Roboto Mono');
      for (const text of ['Episode threshold: 70 mg/dL.', initialNote, recheckNote]) {
        const element = card.getByText(text, { exact: true });
        await expect(element).toHaveText(text);
        expect(await element.evaluate(node => getComputedStyle(node).fontFamily)).toBe(family);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await card.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
      await card.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`typography-${viewport.width}-${theme}.png`), fullPage: true });
    }
  }
  expect(await stored(page)).toEqual(original);
});

test('multi-round timeline separates type and timestamp and sizes Edit Recheck by viewport', async ({ page }, testInfo) => {
  const record = seedEpisode();
  const initial = Date.now() - 3600000;
  record.recordTimestamp = new Date(initial).toISOString();
  record.bloodSugar = 65;
  record.notes = 'Synthetic initial observation note';
  record.lowGlucoseEpisode.rechecks = [61, 68, 74].map((bloodSugar, index) => ({
    id: `synthetic-round-${index}`, bloodSugar, carbs: index === 2 ? 0 : 15,
    recordTimestamp: new Date(initial + (index + 1) * 900000).toISOString(),
    notes: index === 0 ? 'Synthetic recheck note' : '',
  }));
  record.lowGlucoseEpisode.closure = { kind: 'recovery-confirmed', recheckId: 'synthetic-round-2', confirmedAt: new Date().toISOString() };
  await open(page, [record]);
  const card = page.locator('[data-low-glucose-episode]');
  await card.locator('summary').click();
  const rows = card.locator('ol > li');
  await expect(rows).toHaveCount(4);
  await expect(rows.locator(':scope > strong')).toHaveText(['Initial observation', 'Recheck', 'Recheck', 'Recheck']);
  await expect(card).toContainText('Recovery Confirmed');
  await expect(card.locator('.lee_lee_diabetes_low_summary > div')).toHaveText(['Lowest documented 61 mg/dL', 'Total recorded treatment 45 g carbs', '3 rechecks']);
  const timestamps = await rows.locator('.lee_lee_diabetes_low_timestamp').allTextContents();
  expect(new Set(timestamps).size).toBe(4);
  await expect(rows.nth(0).locator(':scope > p').first()).toHaveText('65 mg/dL · Treatment 15 g carbs');
  await expect(rows.nth(3).locator(':scope > p').first()).toHaveText('74 mg/dL · Treatment 0 g carbs');
  await expect(card.locator('.lee_lee_diabetes_timeline_notes')).toHaveText(['Synthetic initial observation note', 'Synthetic recheck note']);
  const original = await stored(page);
  for (const width of [320, 393, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      for (const row of await rows.all()) {
        const geometry = await row.evaluate(row => {
          const title = row.querySelector('strong').getBoundingClientRect();
          const timestamp = row.querySelector('.lee_lee_diabetes_low_timestamp').getBoundingClientRect();
          const button = row.querySelector('button'), b = button?.getBoundingClientRect(), r = row.getBoundingClientRect();
          return { titleBottom: title.bottom, timestampTop: timestamp.top, listStyle: getComputedStyle(row).listStyleType, overflow: row.scrollWidth > row.clientWidth + 1, width: r.width, buttonWidth: b?.width, buttonHeight: b?.height, contained: !b || b.left >= r.left && b.right <= r.right + 1 };
        });
        expect(geometry.timestampTop).toBeGreaterThanOrEqual(geometry.titleBottom);
        expect(geometry.listStyle).toBe('decimal');
        expect(geometry.overflow).toBe(false);
        expect(geometry.contained).toBe(true);
        if (geometry.buttonWidth) {
          expect(geometry.buttonHeight).toBeGreaterThanOrEqual(44);
          if (width <= 640) expect(Math.abs(geometry.buttonWidth - geometry.width)).toBeLessThan(2);
          else expect(geometry.buttonWidth).toBeLessThan(geometry.width);
        }
      }
      expect(await rows.locator('.lee_lee_diabetes_low_timestamp').allTextContents()).toEqual(timestamps);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`timeline-${width}-${theme}.png`), fullPage: true });
    }
  }
  await card.getByRole('button', { name: 'Edit Recheck', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Record Recheck', exact: true })).toBeVisible();
  await expect(page.locator('[name=bloodSugar]')).toHaveValue('61');
  expect(await stored(page)).toEqual(original);
});
