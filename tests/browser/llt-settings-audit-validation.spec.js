import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const syncSource = readFileSync(new URL('../../js/lee-lees-tracker-sync.js', import.meta.url), 'utf8');

async function install(page) {
  await page.addScriptTag({ content: syncSource });
  await page.evaluate(async () => {
    const uid = 'synthetic-user';
    const api = window.LeeLeeTrackerSync;
    const baseline = api.sharedSettingsToRemote(api.normalizeSharedSettings({ clinicName: 'Synthetic baseline' }), uid);
    window.__settingsServer = { row: { ...baseline, version: 32 }, audits: [], calls: [], mode: 'success' };
    const server = window.__settingsServer;
    window.LandoWorldBuildMetadata = { environment: 'synthetic-test' };
    window.LEE_LEE_TRACKER_SUPABASE_CONFIG = { url: 'https://example.supabase.co', publishableKey: 'publishable-key-for-browser-tests-123' };
    const client = {
      auth: { getSession: async () => ({ data: { session: { user: { id: uid }, expires_at: Date.now() / 1000 + 3600 } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
      from(table) {
        const filters = {};
        const builder = { select() { return builder; }, eq(key, value) { filters[key] = value; return builder; },
          order: async () => ({ data: table === 'lee_lee_settings_audit' ? server.audits : [], error: null }),
          maybeSingle: async () => table === 'lee_lee_settings_audit' && server.auditReadError
            ? ({ data: null, error: server.auditReadError }) : ({ data: table === 'lee_lee_shared_settings' ? server.row
            : server.audits.find(row => row.event_id === filters.event_id && row.authorized_user_id === filters.authorized_user_id) || null, error: null }) };
        return builder;
      },
      async rpc(name, args) {
        server.calls.push({ name, eventId: args.p_audit_event?.event_id, expected: args.p_expected_version });
        if (server.mode === 'network') return { data: null, error: { message: 'Failed to fetch' } };
        if (server.mode === 'permanent') return { data: null, error: { code: '23502', message: 'Synthetic server not-null rejection' } };
        if (server.row.version !== args.p_expected_version) return { data: { status: 'conflict', settings: server.row, versionAfter: server.row.version }, error: null };
        const before = server.row.version;
        server.row = { user_id: uid, version: before + 1, patient_name: args.p_patient_name, patient_date_of_birth: args.p_patient_date_of_birth,
          clinic_name: args.p_clinic_name, clinic_phone: args.p_clinic_phone, payload: args.p_payload, app_schema_version: args.p_app_schema_version };
        server.audits.push({ event_id: args.p_audit_event.event_id, authorized_user_id: uid, status: 'Accepted', version_before: before, version_after: server.row.version });
        if (server.mode === 'lose-response') throw new Error('Network connection interrupted after acceptance');
        return { data: { status: 'accepted', eventId: args.p_audit_event.event_id, settings: server.row, versionBefore: before, versionAfter: server.row.version }, error: null };
      },
      channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
    };
    window.supabase = { createClient: () => client };
    let document = { schemaVersion: 1, records: [], settings: {}, insulinPlans: [], metadata: {} };
    window.__settingsRepo = api.createRepository({ getDocument: () => document, saveDocument: value => { document = value; return { ok: true, data: value }; },
      mergeDocuments: (base, incoming) => ({ ...base, ...incoming }), normalizeRecord: value => value });
    await window.__settingsRepo.initialize();
  });
}

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).pathname === '/issue17-fixture'
    ? route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Synthetic settings sync fixture</title>' }) : route.abort());
  await page.goto('/issue17-fixture');
  await install(page);
});

test('unchanged saves do nothing and unsent changes coalesce with one valid event', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const repository = window.__settingsRepo;
    const before = JSON.stringify(Object.fromEntries(Object.entries(localStorage)));
    const unchanged = repository.saveSharedSettings(repository.getSharedSettings());
    const noMutation = before === JSON.stringify(Object.fromEntries(Object.entries(localStorage)));
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const first = repository.saveSharedSettings({ ...repository.getSharedSettings(), clinicName: 'Synthetic first' });
    const second = repository.saveSharedSettings({ ...repository.getSharedSettings(), clinicName: 'Synthetic final' });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    await repository.processSharedSettingsQueue();
    return { unchanged, noMutation, firstId: first.id, secondId: second.id, eventId: first.auditEvent.eventId,
      secondEventId: second.auditEvent.eventId, count: repository.getSharedSettingsStatus().pendingCount, server: window.__settingsServer };
  });
  expect(result.unchanged).toBeNull(); expect(result.noMutation).toBe(true);
  expect(result.firstId).toBe(result.secondId); expect(result.eventId).toBe(result.secondEventId);
  expect(result.eventId).toMatch(/^[0-9a-f-]{36}$/i); expect(result.count).toBe(0);
  expect(result.server.calls).toHaveLength(1); expect(result.server.audits).toHaveLength(1);
  expect(result.server.row.clinic_name).toBe('Synthetic final');
});

test('legacy null audit stays preserved across restart and cannot be silently coalesced or uploaded', async ({ page }) => {
  const original = await page.evaluate(() => {
    const repository = window.__settingsRepo;
    const payload = { ...repository.getSharedSettings(), clinicName: 'Synthetic retained pending intent' };
    const operation = { id: crypto.randomUUID(), recordId: 'shared-settings', entityType: 'shared-settings', type: 'update-shared-settings', baseVersion: 32,
      payload, auditEvent: null, retryCount: 28, coalescedCount: 2, state: 'pending', createdAt: '2026-10-19T20:00:00.000Z', lastErrorCode: '23502' };
    localStorage.setItem(repository.keys.sharedSettingsCache, JSON.stringify(payload));
    localStorage.setItem(repository.keys.sharedSettingsQueue, JSON.stringify([operation]));
    return operation;
  });
  await page.reload(); await install(page);
  const result = await page.evaluate(async () => {
    const repository = window.__settingsRepo;
    await repository.processSharedSettingsQueue();
    repository.saveSharedSettings({ ...repository.getSharedSettings(), clinicName: 'Synthetic later change' });
    await repository.processSharedSettingsQueue();
    return { queue: JSON.parse(localStorage.getItem(repository.keys.sharedSettingsQueue)), calls: window.__settingsServer.calls, status: repository.getSharedSettingsStatus() };
  });
  expect(result.queue).toHaveLength(2); expect(result.queue[0].id).toBe(original.id);
  expect(result.queue[0].payload).toEqual(original.payload); expect(result.queue[0].auditEvent).toBeNull();
  expect(result.queue[0].retryCount).toBe(28); expect(result.queue[0].state).toBe('needs-attention');
  expect(result.queue[1].auditEvent.eventId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(result.calls).toEqual([]); expect(result.status.state).toBe('needs-attention');
});

test('network retries keep event identity while SQL 23502 stops automatic attempts', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const repository = window.__settingsRepo; const server = window.__settingsServer;
    server.mode = 'network';
    const operation = repository.saveSharedSettings({ ...repository.getSharedSettings(), clinicName: 'Synthetic retry' });
    await repository.processSharedSettingsQueue();
    const network = JSON.parse(localStorage.getItem(repository.keys.sharedSettingsQueue))[0];
    server.mode = 'success'; await repository.processSharedSettingsQueue();
    server.mode = 'permanent';
    repository.saveSharedSettings({ ...repository.getSharedSettings(), clinicName: 'Synthetic permanent rejection' });
    await repository.processSharedSettingsQueue();
    const callsBefore = server.calls.length;
    await repository.processSharedSettingsQueue(); await repository.syncSharedSettings();
    return { eventId: operation.auditEvent.eventId, network, calls: server.calls, callsBefore,
      pending: JSON.parse(localStorage.getItem(repository.keys.sharedSettingsQueue))[0], audits: server.audits };
  });
  expect(result.network.state).toBe('pending'); expect(result.network.retryCount).toBe(1);
  expect(result.calls[0].eventId).toBe(result.eventId); expect(result.calls[1].eventId).toBe(result.eventId);
  expect(result.calls.length).toBe(result.callsBefore); expect(result.pending.state).toBe('needs-attention');
  expect(result.pending.lastErrorCode).toBe('23502'); expect(result.pending.retryCount).toBe(1); expect(result.audits).toHaveLength(1);
});

test('accepted response loss preserves review state without replaying an event or trusting equal values', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const repository = window.__settingsRepo; const server = window.__settingsServer;
    server.mode = 'lose-response';
    const operation = repository.saveSharedSettings({ ...repository.getSharedSettings(), clinicName: 'Synthetic accepted change' });
    await repository.processSharedSettingsQueue();
    server.mode = 'success'; await repository.processSharedSettingsQueue();
    const cleaned = repository.cleanupIdenticalConflicts();
    return { operation, conflict: repository.getConflicts()[0], cleaned, status: repository.getSharedSettingsStatus(), server };
  });
  expect(result.server.calls).toHaveLength(1); expect(result.server.audits).toHaveLength(1);
  expect(result.conflict.operation.id).toBe(result.operation.id); expect(result.conflict.operation.payload).toEqual(result.operation.payload);
  expect(result.status.conflictCount).toBe(1); expect(result.cleaned).toBe(0); expect(result.server.row.version).toBe(33);
});


for (const code of ['40001', '23502']) {
  test(`audit READ ${code} stays pending without write classification and recovers with the same event`, async ({ page }) => {
    const result = await page.evaluate(async code => {
      const repository = window.__settingsRepo; const server = window.__settingsServer;
      server.auditReadError = { code, message: 'Synthetic audit read failure' };
      const operation = repository.saveSharedSettings({ ...repository.getSharedSettings(), clinicName: 'Synthetic read recovery' });
      await repository.processSharedSettingsQueue(); await repository.processSharedSettingsQueue();
      const pending = JSON.parse(localStorage.getItem(repository.keys.sharedSettingsQueue))[0];
      const diagnostics = repository.getPendingSharedSettingsDiagnostics(); const callsBefore = server.calls.length;
      server.auditReadError = null; await repository.processSharedSettingsQueue(); await repository.processSharedSettingsQueue();
      return { operation, pending, diagnostics, callsBefore, server, status: repository.getSharedSettingsStatus() };
    }, code);
    expect(result.callsBefore).toBe(0); expect(result.pending.state).toBe('pending');
    expect(result.pending.lastFailureStage).toBe('audit-lookup'); expect(result.pending.lastWriteRejected).toBe(false);
    expect(result.pending.payload).toEqual(result.operation.payload);
    expect(result.diagnostics.operations[0].lastFailureClassification).toBe('audit-lookup-failed');
    expect(result.server.calls).toHaveLength(1); expect(result.server.audits).toHaveLength(1);
    expect(result.server.calls[0].eventId).toBe(result.operation.auditEvent.eventId);
    expect(result.status.pendingCount).toBe(0);
  });
}
