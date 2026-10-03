import { expect, test } from '@playwright/test';
import { createIPhoneDevServer } from '../../scripts/dev-iphone.mjs';

let server;
let baseURL;

test.beforeAll(async () => {
  server = createIPhoneDevServer({
    bindAddress: { address: '127.0.0.1', netmask: '255.0.0.0' },
    getMetadata: async () => ({
      environment: 'local-device',
      appVersion: '1.0.0',
      branch: 'browser-test',
      commit: 'test',
      commitFull: 'test',
      dirty: true,
      sourceId: 'browser-test',
    }),
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseURL = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => {
  if (server?.listening) await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test('local-device environment shows its badge, bypasses LLT sign-in locally, and makes no PWA or Supabase requests', async ({ page }) => {
  const remoteRequests = [];
  const registrationCalls = [];
  await page.addInitScript(() => {
    window.__iphoneDevServiceWorkerCalls = [];
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        register: (...args) => { window.__iphoneDevServiceWorkerCalls.push(args); },
        getRegistrations: async () => [],
      },
    });
  });
  page.on('request', (request) => {
    const url = request.url();
    if (/supabase\.co|deployment-version\.json/.test(url)) remoteRequests.push(url);
  });

  await page.goto(`${baseURL}/#/lee-lees-tracker`);
  await expect(page.locator('#lws-local-dev-badge')).toHaveText('LOCAL DEV');
  await expect(page.locator('#lee-lee-diabetes-root')).not.toContainText('Sign In');
  await page.getByRole('button', { name: 'Log Entry' }).last().click();
  await expect(page.getByRole('heading', { name: 'Log Entry' })).toBeVisible();
  await page.getByRole('button', { name: /Carb Calculator/ }).click();
  await expect(page.getByRole('dialog', { name: 'Carb Calculator' })).toBeVisible();
  await page.context().setOffline(true);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('pageshow'));
    window.visualViewport.dispatchEvent(new Event('resize'));
  });
  expect(await page.evaluate(() => window.LeeLeeTrackerAccess.getState())).toBe('local-development-authorized');
  await expect(page.getByRole('dialog', { name: 'Carb Calculator' })).toBeVisible();

  registrationCalls.push(...await page.evaluate(() => window.__iphoneDevServiceWorkerCalls));
  expect(registrationCalls).toEqual([]);
  expect(remoteRequests).toEqual([]);
});

for (const originalContext of ['Breakfast', 'Lunch']) {
  test(`local-device ${originalContext} save establishes provenance for same-plan and Plan A historical edits`, async ({ page }) => {
    const remoteRequests = [];
    page.on('request', (request) => {
      if (/supabase\.co|deployment-version\.json|supabase-js/.test(request.url())) remoteRequests.push(request.url());
    });
    await page.goto(`${baseURL}/#/lee-lees-tracker`);
    await expect(page.locator('#lws-local-dev-badge')).toHaveText('LOCAL DEV');
    await page.evaluate(() => window.LeeLeeTrackerStorage.updateTrackerData((current) => ({
      ...current,
      insulinPlans: current.insulinPlans.map((plan) => ({ ...plan, insulinCarbRatioGrams: 10 })),
    })));
    await page.getByRole('button', { name: 'Log Entry', exact: true }).last().click();
    const form = page.locator('[data-lee-lee-editor]');
    await form.getByLabel('Context').selectOption(originalContext);
    await form.getByLabel('Blood Sugar').fill('190');
    await form.getByRole('spinbutton', { name: 'Total Carbs' }).fill('57');
    await form.getByLabel('Insulin Actually Given').fill('5');
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm and Save' }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    const saved = await page.evaluate(() => window.LeeLeeTrackerStorage.loadTrackerData().records[0]);
    expect(saved.doseCalculationStatus).toBe('local-development-calculated');
    expect(saved.insulinPlanId).toBeTruthy();
    expect(saved.insulinPlanSnapshot.insulinCarbRatioGrams).toBe(10);
    expect(await page.evaluate(() => window.LeeLeeTrackerVerification.getHistoricalPlanForRecord(window.LeeLeeTrackerStorage.loadTrackerData().records[0]) !== null)).toBe(true);

    const app = page.locator('#lee-lees-tracker-view');
    await app.getByRole('button', { name: 'Settings', exact: true }).click();
    const diagnostics = page.locator('[data-settings-key="sync-status"]');
    await diagnostics.locator('summary').click();
    await expect(diagnostics).toContainText('Recent Entry Plan Provenance');
    await expect(diagnostics).toContainText('COMPLETE');
    await expect(diagnostics).toContainText('LOCAL DEVELOPMENT — not Supabase verified');
    await app.getByRole('button', { name: 'Close Settings', exact: true }).click();

    async function reopen() {
      await page.getByRole('button', { name: 'History', exact: true }).last().click();
      await page.locator(`[data-action="history-date"][data-date="${saved.date}"]`).click();
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
    }
    async function assertAndSave(context, carbs, glucose) {
      await expect(form).not.toContainText('insulin plan used for');
      await expect(form.locator('.lee_lee_diabetes_dose_total')).toBeVisible();
      await expect(form.getByLabel('Insulin Actually Given')).toHaveValue('5');
      await form.getByRole('button', { name: 'Save', exact: true }).click();
      await page.getByRole('button', { name: 'Confirm and Save' }).click();
      const record = await page.evaluate(() => window.LeeLeeTrackerStorage.loadTrackerData().records[0]);
      const expected = await page.evaluate(({ snapshot, context, carbs, glucose, timestamp }) => window.LeeLeeTrackerDoseHelper.calculateMealInsulinDose({ entryType: context, totalCarbs: carbs, bloodSugar: glucose, recordTimestamp: Date.parse(timestamp), insulinPlan: snapshot }), { snapshot: saved.insulinPlanSnapshot, context, carbs, glucose, timestamp: record.recordTimestamp });
      expect(record.type).toBe(context);
      expect(record.insulinPlanSnapshot).toEqual(saved.insulinPlanSnapshot);
      expect(record.suggestedTotalUnits).toBe(expected.suggestedTotalUnits);
      expect(record.suggestedCorrectionUnits).toBe(expected.correctionUnits);
      expect(record.administeredInsulinUnits).toBe(5);
      expect(record.doseCalculationStatus).toBe('local-development-calculated');
    }
    await reopen();
    const context = originalContext === 'Breakfast' ? 'Dinner' : 'Snacks';
    await form.getByLabel('Context').selectOption(context);
    await assertAndSave(context, 57, 190);

    await page.evaluate(() => window.LeeLeeTrackerStorage.updateTrackerData((current) => ({
      ...current,
      insulinPlans: current.insulinPlans.map((plan) => ({ ...plan, id: 'local-plan-b', insulinCarbRatioGrams: 2 })),
      activeInsulinPlanId: 'local-plan-b',
    })));
    await reopen();
    await form.getByLabel('Context').selectOption('Lunch');
    await form.getByLabel('Blood Sugar').fill('250');
    await form.getByRole('spinbutton', { name: 'Total Carbs' }).fill('60');
    await form.getByRole('button', { name: 'Open Carb Calculator' }).click();
    const calculator = page.locator('[data-carb-calculator]');
    await calculator.getByRole('button', { name: /Add Manual Amount/ }).click();
    await page.locator('[name="carbItemCarbs"]').fill('20');
    await page.getByRole('button', { name: 'Add Item', exact: true }).click();
    await calculator.getByRole('button', { name: 'Use 20 g' }).click();
    await form.getByLabel('Context').selectOption('Snacks');
    await assertAndSave('Snacks', 20, 250);
    await reopen();
    await expect(form.getByLabel('Context')).toHaveValue('Snacks');
    expect(remoteRequests).toEqual([]);
  });
}
