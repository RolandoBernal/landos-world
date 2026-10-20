import { expect, test } from '@playwright/test';
import { createIPhoneDevServer } from '../../scripts/dev-iphone.mjs';

let server; let baseURL;
const trackerKey = 'lando-world:lee-lees-tracker:v1';
const queueKey = 'lando-world:lee-lees-tracker:shared-settings-queue:v1';
test.beforeAll(async () => {
  server = createIPhoneDevServer({ bindAddress: { address: '127.0.0.1', netmask: '255.0.0.0' },
    getMetadata: async () => ({ environment: 'production', appVersion: 'synthetic', commit: 'synthetic', sourceId: 'isolated-recovery-test' }) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => { if (server?.listening) await new Promise(resolve => server.close(resolve)); });

async function open(page, prompt = false) {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    // Isolate LLT from the unrelated launcher weather service without external IO.
    if (url.pathname === '/js/weather-service.js') return route.fulfill({ contentType: 'text/javascript',
      body: 'window.LandosWeatherService = { getCachedWeather: () => null, getWeather: async () => ({status: "error", snapshot: null}) };' });
    return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
  await page.addInitScript(({ trackerKey, queueKey, prompt }) => {
    let api;
    Object.defineProperty(window, 'LeeLeeTrackerSync', { configurable: true, get: () => api, set(value) {
      api = value;
      const uid = 'synthetic-user';
      const settings = value.normalizeSharedSettings({ version: 32 });
      const row = { ...value.sharedSettingsToRemote(settings, uid), version: 32 };
      const original = { id: crypto.randomUUID(), type: 'update-shared-settings', recordId: 'shared-settings', entityType: 'shared-settings',
        baseVersion: 32, payload: settings, auditEvent: null, lastErrorCode: '23502', retryCount: 28, coalescedCount: 2, state: 'pending', createdAt: '2026-10-19T20:00:00.000Z' };
      const existing = { id: 'synthetic-existing', type: 'Snacks', eventType: 'meal', mealCarbs: 11, totalCarbs: 11, bloodSugar: 112,
        administeredInsulinUnits: 2, insulinUnits: 2, recordTimestamp: '2026-10-18T12:00:00.000Z', createdAt: '2026-10-18T12:00:00.000Z', updatedAt: '2026-10-18T12:00:00.000Z' };
      localStorage.setItem(trackerKey, JSON.stringify({ schemaVersion: 1, records: [existing], settings: {}, insulinPlans: [settings.insulinPlan], activeInsulinPlanId: settings.insulinPlan.id, foodLibrary: [], savedMeals: [], metadata: {} }));
      localStorage.setItem(queueKey, JSON.stringify([original]));
      localStorage.setItem('lando-world:lee-lees-tracker:shared-settings-cache:v1', JSON.stringify(settings));
      localStorage.setItem('lando-world:lee-lees-tracker:device-identity:v1', 'Rolando');
      localStorage.setItem('lando-world:lee-lees-tracker:shared-settings-migration:v1', JSON.stringify({ completed: true }));
      localStorage.setItem(`${trackerKey}:shared-sync-migration:v1`, JSON.stringify({ migrationCompleted: !prompt, promptDismissed: !prompt }));
      const state = window.__recoveryServer = { row, original, existing, audits: [], calls: [], records: [], mode: 'success' };
      const session = { user: { id: uid }, expires_at: Date.now() / 1000 + 3600 };
      const client = {
        auth: { getSession: async () => ({ data: { session } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
        from(table) {
          const filters = {}; let inserted;
          const builder = { select() { return builder; }, eq(key, value) { filters[key] = value; return builder; },
            insert(value) { inserted = value; return builder; },
            single: async () => { state.records.push(inserted); return { data: inserted, error: null }; },
            order: async () => ({ data: table === 'lee_lee_settings_audit' ? state.audits : table === 'lee_lee_records' ? state.records : [], error: null }),
            maybeSingle: async () => ({ data: table === 'lee_lee_shared_settings' ? state.row
              : table === 'lee_lee_settings_audit' ? state.audits.find(event => event.event_id === filters.event_id) || null : null, error: null }) };
          return builder;
        },
        async rpc(name, args) {
          state.calls.push({ name, eventId: args.p_audit_event?.event_id });
          if (state.row.version !== args.p_expected_version) return { data: { status: 'conflict', settings: state.row }, error: null };
          const before = state.row.version;
          state.row = { user_id: uid, version: before + 1, patient_name: args.p_patient_name, patient_date_of_birth: args.p_patient_date_of_birth,
            clinic_name: args.p_clinic_name, clinic_phone: args.p_clinic_phone, payload: args.p_payload, app_schema_version: args.p_app_schema_version };
          state.audits.push({ event_id: args.p_audit_event.event_id, authorized_user_id: uid, status: 'Accepted', version_before: before, version_after: state.row.version });
          if (state.mode === 'lose-response') throw new Error('Synthetic interrupted response');
          return { data: { status: 'accepted', eventId: args.p_audit_event.event_id, settings: state.row, versionBefore: before, versionAfter: state.row.version }, error: null };
        },
        channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
      };
      window.supabase = { createClient: () => client };
      const create = value.createRepository;
      value.createRepository = (...args) => window.__recoveryRepo = create(...args);
    } });
  }, { trackerKey, queueKey, prompt });
  await page.goto(`${baseURL}/#/lee-lees-tracker`);
}

async function settings(page) {
  await page.locator('#lee_lee_settings_toggle').click();
  const section = page.locator('[data-settings-key="sync-diagnostics"]');
  await section.locator('summary').click(); return section;
}

async function saveManualEntry(page) {
  await page.getByRole('button', { name: 'Log Entry', exact: true }).click();
  await page.locator('[name="type"]').selectOption('Lunch');
  await page.locator('[name="bloodSugar"]').fill('123');
  await page.locator('[name="mealCarbs"]').fill('31');
  await page.locator('[name="insulinUnits"]').fill('3');
  await expect(page.locator('[data-save-record]')).toBeEnabled();
  await page.locator('[data-save-record]').click();
  await page.locator('[data-action="confirm-save"]').click();
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)).records.length, trackerKey)).toBe(2);
}

test('pending settings keep guidance blocked while actual observations and administered insulin can be saved', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await open(page);
  await expect.poll(() => page.evaluate(() => window.LeeLeeTrackerVerification.getInsulinPlanVerification().status)).toBe('NOT_VERIFIED');
  await saveManualEntry(page);
  const result = await page.evaluate(({ trackerKey, queueKey }) => ({ data: JSON.parse(localStorage.getItem(trackerKey)), queue: JSON.parse(localStorage.getItem(queueKey)), server: window.__recoveryServer }), { trackerKey, queueKey });
  const entry = result.data.records.find(record => record.id !== 'synthetic-existing');
  expect(entry.bloodSugar).toBe(123); expect(entry.mealCarbs).toBe(31); expect(entry.administeredInsulinUnits).toBe(3);
  expect(entry.suggestedTotalUnits).toBeNull(); expect(entry.doseCalculationStatus).toBe('manual');
  expect(await page.evaluate(() => window.LeeLeeTrackerVerification.getInsulinPlanVerification().status)).toBe('NOT_VERIFIED');
  expect(result.queue).toHaveLength(1); expect(result.queue[0].id).toBe(result.server.original.id);
  expect(result.data.records.find(record => record.id === 'synthetic-existing').mealCarbs).toBe(11);
  expect(errors).toEqual([]);
});

test('explicit recovery UI preserves backup, verifies authority, restores guidance and saves a new entry', async ({ page }) => {
  await open(page); const section = await settings(page);
  page.once('dialog', dialog => dialog.accept());
  await section.getByRole('button', { name: 'Recover Missing-Audit Settings', exact: true }).click();
  await expect(page.locator('[data-settings-recovery-status]')).toContainText('accepted and refreshed');
  await expect.poll(() => page.evaluate(() => window.LeeLeeTrackerVerification.getInsulinPlanVerification().status)).toBe('VERIFIED');
  const result = await page.evaluate(queueKey => {
    const server = window.__recoveryServer;
    return { server, queue: JSON.parse(localStorage.getItem(queueKey)), backup: JSON.parse(localStorage.getItem(`${queueKey}:recovery:${server.original.id}`)) };
  }, queueKey);
  expect(result.queue).toEqual([]); expect(result.server.audits).toHaveLength(1); expect(result.server.calls).toHaveLength(1);
  expect(result.backup.operation.id).toBe(result.server.original.id); expect(result.backup.operation.payload).toEqual(result.server.original.payload);
  expect(result.backup.operation.auditEvent).toBeNull(); expect(result.backup.candidate.auditEvent.eventId).toBe(result.server.audits[0].event_id);
  await page.getByRole('button', { name: 'Today', exact: true }).click(); await saveManualEntry(page);
  const entries = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).records, trackerKey);
  expect(entries).toHaveLength(2); expect(entries.find(record => record.id !== 'synthetic-existing').suggestedTotalUnits).not.toBeNull();
});

test('existing-history migration prompt no longer throws and Not Now permits entry registration', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await open(page, true);
  await expect(page.getByRole('heading', { name: 'We found existing records on this device.' })).toBeVisible();
  await page.getByRole('button', { name: 'Not Now', exact: true }).click(); await saveManualEntry(page);
  expect(errors).toEqual([]);
});
