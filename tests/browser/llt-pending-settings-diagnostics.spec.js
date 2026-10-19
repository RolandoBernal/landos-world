import { expect, test } from '@playwright/test';
import { createIPhoneDevServer } from '../../scripts/dev-iphone.mjs';

let server;
let baseURL;
const queueKey = 'lando-world:lee-lees-tracker:shared-settings-queue:v1';
const operationId = '11111111-1111-4111-8111-111111111111';

test.beforeAll(async () => {
  server = createIPhoneDevServer({ bindAddress: { address: '127.0.0.1', netmask: '255.0.0.0' }, getMetadata: async () => ({ environment: 'local-device', appVersion: '1.0.0', branch: 'feature/llt-issue17-diagnostics', commit: 'synthetic', dirty: true, sourceId: 'synthetic-diagnostic-test' }) });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  baseURL = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => { if (server?.listening) await new Promise(resolve => server.close(resolve)); });

async function setup(page, clipboardMode = 'success', trapStorage = true) {
  const remote = [];
  page.on('request', request => { if (/supabase\.co/.test(request.url())) remote.push(request.url()); });
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.addInitScript(({ queueKey, operationId, clipboardMode }) => {
    const operation = {
      id: operationId, type: 'update-shared-settings', baseVersion: 31, auditEvent: null,
      state: 'pending', retryCount: 1, createdAt: '2026-10-19T17:03:49.130Z', lastAttemptAt: '2026-10-19T18:16:34Z',
      lastErrorCategory: 'validation', lastErrorCode: '23502',
      lastErrorMessage: 'null value in column "event_id" of relation "lee_lee_settings_audit" violates not-null constraint SENSITIVE_CANARY',
      payload: { patientName: 'SENSITIVE_CANARY', access_token: 'SENSITIVE_CANARY', clinicalValue: 999 },
    };
    localStorage.setItem(queueKey, JSON.stringify([operation]));
    localStorage.setItem('unrelated-storage-canary', 'SENSITIVE_CANARY');
    let syncApi;
    Object.defineProperty(window, 'LeeLeeTrackerSync', { configurable: true, get: () => syncApi, set(value) {
      syncApi = value;
      const create = value.createRepository;
      value.createRepository = (...args) => { const repository = create(...args); window.__diagnosticRepository = repository; return repository; };
    } });
    window.__diagnosticCopies = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboardMode === 'missing' ? undefined : {
      writeText: async text => { if (clipboardMode === 'rejected') throw new Error('SENSITIVE_CANARY'); window.__diagnosticCopies.push(text); },
    } });
  }, { queueKey, operationId, clipboardMode });
  await page.goto(`${baseURL}/#/lee-lees-tracker`);
  const app = page.locator('#lee-lee-diabetes-root');
  await page.locator('#lee_lee_settings_toggle').click();
  const diagnostics = app.locator('[data-settings-key="sync-diagnostics"]');
  await diagnostics.locator('summary').click();
  await expect(diagnostics.getByRole('button', { name: 'Copy Pending Settings Metadata', exact: true })).toBeVisible();
  // Settle the existing scroll/toggle UI persistence before observing the copy itself.
  await diagnostics.getByRole('button', { name: 'Copy Pending Settings Metadata', exact: true }).scrollIntoViewIfNeeded();
  await diagnostics.getByRole('button', { name: 'Copy Pending Settings Metadata', exact: true }).focus();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  // Trap every storage write/removal, repository action, and fetch after setup.
  const before = await page.evaluate(trapStorage => {
    const snapshot = { local: Object.fromEntries(Object.entries(localStorage)), session: Object.fromEntries(Object.entries(sessionStorage)) };
    window.__diagnosticSideEffects = [];
    for (const method of ['syncNow', 'syncSharedSettings', 'processSharedSettingsQueue', 'saveSharedSettings', 'initialize']) {
      window.__diagnosticRepository[method] = () => { window.__diagnosticSideEffects.push(method); throw new Error('Unexpected synchronization'); };
    }
    if (trapStorage) for (const method of ['setItem', 'removeItem', 'clear']) {
      Storage.prototype[method] = () => { window.__diagnosticSideEffects.push(method); throw new Error('Unexpected storage mutation'); };
    }
    window.fetch = () => { window.__diagnosticSideEffects.push('fetch'); throw new Error('Unexpected fetch'); };
    return snapshot;
  }, trapStorage);
  return { diagnostics, before, remote };
}

test('pending settings copy exports metadata only, preserves storage and leaves verification blocked', async ({ page }) => {
  const { diagnostics, before, remote } = await setup(page);
  const gateBefore = await page.evaluate(() => window.LeeLeeTrackerVerification.getInsulinPlanVerification({ refresh: false }));
  // Dispatch the action without adding browser focus/scroll persistence to the observation.
  await diagnostics.getByRole('button', { name: 'Copy Pending Settings Metadata', exact: true }).dispatchEvent('click');
  await expect(diagnostics.locator('[data-pending-settings-copy-status]')).toHaveText('Pending settings metadata copied.');
  const result = await page.evaluate(() => ({
    copies: window.__diagnosticCopies, effects: window.__diagnosticSideEffects,
    storage: { local: Object.fromEntries(Object.entries(localStorage)), session: Object.fromEntries(Object.entries(sessionStorage)) },
    all: window.LeeLeeTrackerVerification.buildSettingsDiagnosticsPackage().sections.syncDiagnostics,
    gate: window.LeeLeeTrackerVerification.getInsulinPlanVerification({ refresh: false }),
  }));
  expect(result.copies).toHaveLength(1);
  expect(result.copies[0]).not.toContain('SENSITIVE_CANARY');
  const exported = JSON.parse(result.copies[0]);
  expect(exported.operations).toHaveLength(1);
  expect(exported.operations[0]).toMatchObject({ operationId, baseVersion: 31, auditEventState: 'null', auditEventId: null,
    retryCount: 1, state: 'pending', lastFailureClassification: 'audit-event-id-required', lastAttemptAt: '2026-10-19T18:16:34.000Z', acknowledgmentState: 'unavailable' });
  expect(result.all.pendingSharedSettings.operations).toEqual(exported.operations);
  expect(result.all.queue.operations).toEqual([]);
  expect(result.gate.status).toBe('NOT_VERIFIED'); expect(result.gate.status).toBe(gateBefore.status);
  expect(result.storage).toEqual(before); expect(result.effects).toEqual([]); expect(remote).toEqual([]);
});

for (const mode of ['missing', 'rejected']) {
  test(`pending settings copy ${mode} clipboard gives safe feedback without mutations`, async ({ page }) => {
    const { diagnostics, before, remote } = await setup(page, mode);
    // Dispatch the action without adding browser focus/scroll persistence to the observation.
    await diagnostics.getByRole('button', { name: 'Copy Pending Settings Metadata', exact: true }).dispatchEvent('click');
    await expect(diagnostics.locator('[data-pending-settings-copy-status]')).toHaveText('Metadata could not be copied. Clipboard access is required.');
    const result = await page.evaluate(() => ({ storage: { local: Object.fromEntries(Object.entries(localStorage)), session: Object.fromEntries(Object.entries(sessionStorage)) }, effects: window.__diagnosticSideEffects, copies: window.__diagnosticCopies }));
    expect(result.storage).toEqual(before); expect(result.effects).toEqual([]); expect(result.copies).toEqual([]); expect(remote).toEqual([]);
    await expect(diagnostics).not.toContainText('SENSITIVE_CANARY');
  });
}


test('native copy button preserves all local data and performs no synchronization', async ({ page }) => {
  const { diagnostics, before, remote } = await setup(page, 'success', false);
  await diagnostics.getByRole('button', { name: 'Copy Pending Settings Metadata', exact: true }).click();
  await expect(diagnostics.locator('[data-pending-settings-copy-status]')).toHaveText('Pending settings metadata copied.');
  const result = await page.evaluate(() => ({ local: Object.fromEntries(Object.entries(localStorage)),
    effects: window.__diagnosticSideEffects, copies: window.__diagnosticCopies }));
  expect(result.local).toEqual(before.local); expect(result.effects).toEqual([]); expect(remote).toEqual([]);
  expect(result.copies).toHaveLength(1); expect(result.copies[0]).not.toContain('SENSITIVE_CANARY');
});
