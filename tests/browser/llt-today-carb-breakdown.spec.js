import { expect, test } from '@playwright/test';

const fixtures = [
  { id: 'meal', type: 'Breakfast', mealCarbs: 36, rawCarbDose: 3 },
  { id: 'zero', type: 'Lunch', administeredInsulinUnits: 0, mealCarbs: 0, rawCarbDose: 0, temporaryEatingAdjustmentUnits: 0.5 },
  { id: 'snack', type: 'Snacks', mealCarbs: 24, rawCarbDose: 2, suggestedCorrectionUnits: null },
  { id: 'correction', type: 'Correction', mealCarbs: null, rawCarbDose: null },
  { id: 'bedtime', type: 'Bedtime', mealCarbs: null, rawCarbDose: null },
  { id: 'tea', type: 'Dinner', mealCarbs: 18, rawCarbDose: 1.5, temporaryEatingAdjustmentApplied: true, temporaryEatingAdjustmentUnits: 0.5 },
  { id: 'actual', type: 'Breakfast', mealCarbs: 36, rawCarbDose: 3, administeredInsulinUnits: 7, suggestedTotalUnits: 4 },
  { id: 'decimal', type: 'Lunch', mealCarbs: 20, rawCarbDose: 20 / 12 },
  { id: 'old', type: 'Dinner', mealCarbs: 36, rawCarbDose: 2.4, insulinCarbRatioGrams: 15 },
  { id: 'missing', type: 'Breakfast', mealCarbs: 999, rawCarbDose: null, suggestedCarbDoseUnits: 4, notes: 'Long notes about the saved entry. '.repeat(20) },
];

// Entry snapshots intentionally differ from the mutable library definitions.
const component = (nameSnapshot, carbTotal, extra = {}) => ({
  componentType: 'food', nameSnapshot, quantity: 1, carbsPerServing: carbTotal, carbTotal, ...extra,
});
fixtures.find(r => r.id === 'meal').mealComponents = [
  component('Saved sandwich', 18, { foodId: 'changed-food', emojiSnapshot: '🥪' }),
  component('Saved chips', 12, { quantity: 2, carbsPerServing: 6 }),
  component('Saved fruit', 6),
];
fixtures.find(r => r.id === 'snack').mealComponents = [component('Single snack', 24)];
fixtures.find(r => r.id === 'zero').mealComponents = [component('Lean Beef Jerky', 0)];
fixtures.find(r => r.id === 'tea').mealComponents = [component('Sports Drink', 18, { componentType: 'manual' })];
fixtures.find(r => r.id === 'decimal').mealComponents = [component('Fractional serving', 7.25), component('Remaining food', 12.75)];
fixtures.find(r => r.id === 'missing').mealComponents = [
  component('A very long saved food name that must wrap without losing its associated amount', 12.5),
  ...Array.from({ length: 5 }, (_, i) => component(`Saved meal component ${i + 1}`, i + 1)),
];

for (const width of [320, 393, 768, 1280, 852]) {
  test(`Today saved carb components and responsive cards at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 852 ? 393 : 900 });
    await page.goto('/#/lee-lees-tracker');
    await page.waitForFunction(() => Boolean(window.LeeLeeTrackerReports));
    await page.evaluate((fixtures) => {
      const timestamp = new Date().toISOString();
      const records = fixtures.map((r) => ({ eventType: 'check-insulin', bloodSugar: 124,
        doseCalculationStatus: 'calculated', administeredInsulinUnits: 3, suggestedTotalUnits: 3, suggestedCorrectionUnits: 0,
        recordTimestamp: timestamp, createdAt: timestamp, updatedAt: timestamp, notes: '', ...r }));
      const key = window.LeeLeeTrackerStorage.storageKey;
      const doc = JSON.parse(localStorage.getItem(key));
      doc.records = records;
      doc.foodLibrary = [{ id: 'changed-food', name: 'Changed library name', carbs: 1 }];
      doc.savedMeals = [{ id: 'changed-meal', name: 'Changed meal', totalCarbs: 1 }];
      localStorage.setItem(key, JSON.stringify(doc));
      window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(doc) }));
    }, fixtures);
    const cards = page.locator('.lee_lee_diabetes_timeline_item--today');
    await expect(cards).toHaveCount(10);
    const card = (id) => cards.filter({ has: page.locator(`[data-action="edit-today-record"][data-id="${id}"]`) });
    await expect(card('meal')).toContainText('Suggested carb coverage: 3 units');
    await expect(card('tea')).toContainText('Suggested carb coverage: 1.5 units');
    await expect(card('actual')).toContainText('Given: 7 units');
    await expect(card('actual')).toContainText('7 units given');
    await expect(card('actual')).not.toContainText('4 units given');
    await expect(card('actual')).toContainText('Suggested carb coverage: 3 units');
    await expect(card('old')).toContainText('Suggested carb coverage: 2.4 units');
    await expect(card('decimal')).toContainText('Suggested carb coverage: ≈ 1.67 units');
    await expect(card('missing')).toContainText('Suggested carb coverage unavailable');
    for (const id of ['zero', 'correction', 'bedtime']) await expect(card(id)).not.toContainText('Suggested carb coverage');
    await expect(card('meal').locator('.lee_lee_diabetes_food_contribution')).toHaveText(['🥪 Saved sandwich · 18 g', '2× Saved chips · 12 g', 'Saved fruit · 6 g']);
    await expect(card('snack').locator('.lee_lee_diabetes_food_contribution')).toHaveText(['Single snack · 24 g']);
    await expect(card('zero')).toContainText('Lean Beef Jerky · 0 g');
    await expect(card('zero')).toContainText('0 units given');
    await expect(card('tea')).toContainText('Sports Drink · 18 g');
    await expect(card('decimal').locator('.lee_lee_diabetes_food_contribution')).toHaveText(['Fractional serving · 7.25 g', 'Remaining food · 12.75 g']);
    await expect(card('missing').locator('.lee_lee_diabetes_food_contribution')).toHaveCount(6);
    await expect(card('actual').locator('.lee_lee_diabetes_food_contributions')).toHaveCount(0);
    expect(await card('meal').locator('.lee_lee_diabetes_food_contribution').evaluateAll(nodes => nodes.reduce((sum, n) => sum + Number(n.querySelector('.lee_lee_diabetes_numeric:last-child').textContent), 0))).toBe(36);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await cards.evaluateAll(nodes => nodes.every(n => n.scrollWidth <= n.clientWidth))).toBe(true);
    await page.screenshot({ path: `/tmp/llt13-food-${test.info().project.name}-${width}.png`, fullPage: true });
    await page.locator('[data-action="history"]').first().click();
    await page.locator('[data-action="history-date"]').first().click();
    await expect(page.locator('.lee_lee_diabetes_timeline_item--history').first()).toBeVisible();
    expect(await page.locator('.lee_lee_diabetes_timeline_item--history').allTextContents()).toEqual(expect.arrayContaining([expect.any(String)]));
    expect((await page.locator('.lee_lee_diabetes_timeline_item--history').allTextContents()).join('')).not.toContain('Suggested carb coverage');
    await expect(page.locator('.lee_lee_diabetes_timeline_item--history .lee_lee_diabetes_food_contributions')).toHaveCount(0);
  });
}

for (const startTimer of [false, true]) {
  test(`Issue 13 Entry Saved copy and actual insulin in local-device save, start timer ${startTimer}`, async ({ page }) => {
    await page.goto('/#/lee-lees-tracker');
    await expect(page.locator('#lws-local-dev-badge')).toHaveText('LOCAL DEV');
    await page.getByRole('button', { name: 'Log Entry', exact: true }).last().click();
    const form = page.locator('[data-lee-lee-editor]');
    await form.getByLabel('Context').selectOption('Breakfast');
    await form.getByLabel('Blood Sugar').fill('123');
    await form.getByRole('spinbutton', { name: 'Total Carbs' }).fill('142');
    await form.getByLabel('Insulin Actually Given').fill('11.5');
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm and Save' }).click();
    const modal = page.getByRole('dialog');
    await expect(modal.getByRole('heading', { name: 'Entry Saved', exact: true })).toBeVisible();
    await expect(modal).not.toContainText('Entry Saved!');
    await expect(modal).toContainText('Insulin given: 11.5 units');
    await expect(modal.getByRole('button', { name: 'Start 15-Min Timer', exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem(window.LeeLeePreMealTimer.STORAGE_KEY))).toBeNull();
    if (startTimer) {
      await modal.locator('[data-action="start-pre-meal-timer"]').click();
      await expect(page.getByRole('heading', { name: 'Entry Saved', exact: true })).toBeVisible();
      await expect(page.getByRole('dialog')).not.toContainText('Entry Saved!');
      const timer = await page.evaluate(() => JSON.parse(localStorage.getItem(window.LeeLeePreMealTimer.STORAGE_KEY)));
      expect(timer.status).toBe('active');
      await page.getByRole('button', { name: 'OK', exact: true }).click();
    } else await modal.getByRole('button', { name: 'Done', exact: true }).click();
    const card = page.locator('.lee_lee_diabetes_timeline_item--today');
    await expect(card).toContainText('11.5 units given');
    await expect(card).toContainText('Suggested carb coverage: ≈ 11.83 units');
    expect(await page.evaluate(() => window.LeeLeeTrackerStorage.loadTrackerData().records[0].administeredInsulinUnits)).toBe(11.5);
  });
}

async function saveModalEntry(page, actual) {
  await page.getByRole('button', { name: 'Log Entry', exact: true }).last().click();
  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Context').selectOption('Breakfast');
  await form.getByLabel('Blood Sugar').fill('123');
  await form.getByRole('spinbutton', { name: 'Total Carbs' }).fill('142');
  await form.getByLabel('Insulin Actually Given').fill(actual == null ? '' : String(actual));
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  const confirm = page.getByRole('button', { name: 'Confirm and Save' });
  if (await confirm.isVisible()) await confirm.click();
  return page.getByRole('dialog');
}

for (const [width, actual] of [[320, 0], [393, 10.5], [768, 8.5], [1280, null], [852, 10.5]]) {
  test(`Complete Issue 13 runtime modal at ${width}px actual ${actual}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 852 ? 393 : 900 });
    await page.goto('/#/lee-lees-tracker');
    const modal = await saveModalEntry(page, actual);
    await expect(modal.getByRole('heading', { name: 'Entry Saved', exact: true })).toBeVisible();
    for (const old of ['Entry Saved!', 'After insulin has been given', 'Insulin Given — Start', 'Not Now', 'undefined units', 'null units', 'NaN units']) await expect(modal).not.toContainText(old);
    if (actual == null) await expect(modal).not.toContainText('Insulin given:');
    else await expect(modal).toContainText(`Insulin given: ${actual} units`);
    const start = modal.getByRole('button', { name: 'Start 15-Min Timer', exact: true });
    await expect(start).toBeFocused();
    const done = modal.getByRole('button', { name: 'Done', exact: true });
    await page.keyboard.press('Tab');
    await expect(done).toBeFocused();
    const panel = modal.locator('section');
    expect(await panel.evaluate(n => { const r = n.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; })).toBe(true);
    expect(await start.evaluate(n => {
      const range = document.createRange(); range.selectNodeContents(n);
      return range.getClientRects().length <= 2 && n.getBoundingClientRect().height >= 44;
    })).toBe(true);
    await page.screenshot({ path: `/tmp/llt13-complete-modal-${test.info().project.name}-${width}.png` });
    await done.click();
    await expect(modal).toHaveCount(0);
    expect(await page.evaluate(() => window.LeeLeePreMealTimer.getTimer())).toBeNull();
  });
}

for (const choice of ['Keep Current Timer', 'Restart Timer', 'Cancel']) {
test(`Complete Issue 13 Start preserves existing timer conflict choice ${choice}`, async ({ page }) => {
  await page.goto('/#/lee-lees-tracker');
  await page.evaluate(() => window.LeeLeePreMealTimer.start({ durationMinutes: 15, sourceEntryId: 'existing-fixture', sourceEntry: { type: 'Breakfast', administeredInsulinUnits: 2 } }));
  const before = await page.evaluate(() => localStorage.getItem(window.LeeLeePreMealTimer.STORAGE_KEY));
  const offer = await saveModalEntry(page, 10.5);
  await offer.getByRole('button', { name: 'Start 15-Min Timer', exact: true }).click();
  const conflict = page.getByRole('dialog');
  await expect(conflict.getByRole('heading', { name: 'Timer Already Running' })).toBeVisible();
  for (const label of ['Keep Current Timer', 'Restart Timer', 'Cancel']) await expect(conflict.getByRole('button', { name: label, exact: true })).toBeVisible();
  await conflict.getByRole('button', { name: choice, exact: true }).click();
  const after = await page.evaluate(() => localStorage.getItem(window.LeeLeePreMealTimer.STORAGE_KEY));
  if (choice === 'Restart Timer') {
    expect(JSON.parse(after).sourceEntryId).not.toBe('existing-fixture');
    expect(JSON.parse(after).durationMinutes).toBe(15);
  } else expect(after).toBe(before);
});
}
