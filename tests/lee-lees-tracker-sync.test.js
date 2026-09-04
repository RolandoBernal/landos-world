import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const syncSource = readFileSync(new URL('../js/lee-lees-tracker-sync.js', import.meta.url), 'utf8');
const migrationSource = readFileSync(
  new URL('../supabase/migrations/202608030001_create_lee_lee_tracker_records.sql', import.meta.url),
  'utf8',
);
const sharedSettingsMigrationSource = readFileSync(
  new URL('../supabase/migrations/202608040001_create_lee_lee_shared_settings.sql', import.meta.url),
  'utf8',
);
const sharedSettingsEditorMigrationSource = readFileSync(
  new URL('../supabase/migrations/202608140001_allow_family_shared_settings_editors.sql', import.meta.url),
  'utf8',
);
const recordEditorMigrationSource = readFileSync(
  new URL('../supabase/migrations/202608150001_allow_family_record_editors.sql', import.meta.url),
  'utf8',
);
const rpcCoalesceRepairMigrationSource = readFileSync(
  new URL('../supabase/migrations/202608150002_fix_versioned_rpc_coalesce.sql', import.meta.url),
  'utf8',
);
const foodLibraryMigrationSource = readFileSync(
  new URL('../supabase/migrations/202608310001_create_lee_lee_food_library.sql', import.meta.url),
  'utf8',
);

function createLocalStorage(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem: (key) => store.get(key) || null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    dump: () => Object.fromEntries(store),
  };
}

function createSyncContext({ localStorage = createLocalStorage(), supabase = null, config = null } = {}) {
  const context = {
    Date,
    JSON,
    Math,
    Number,
    Object,
    Promise,
    String,
    URL,
    console,
    crypto: {
      randomUUID: () => `uuid-${Math.random().toString(36).slice(2)}`,
    },
    document: {
      visibilityState: 'visible',
    },
    localStorage,
    navigator: {
      onLine: true,
    },
    window: null,
    globalThis: null,
  };
  context.window = context;
  context.globalThis = context;
  if (config) context.LEE_LEE_TRACKER_SUPABASE_CONFIG = config;
  if (supabase) context.supabase = supabase;
  vm.runInNewContext(syncSource, context);
  return context;
}

function record(overrides = {}) {
  return {
    id: 'record-1',
    type: 'Breakfast',
    bloodSugar: 198,
    insulinUnits: 5,
    administeredInsulinUnits: 5,
    notes: 'Eggs, "toast", and juice',
    recordTimestamp: '2026-08-01T12:42:00.000Z',
    createdAt: '2026-08-01T12:45:00.000Z',
    updatedAt: '2026-08-01T12:45:00.000Z',
    version: 1,
    enteredBy: 'Rolando',
    ...overrides,
  };
}

function createDocumentStore(initial = { records: [] }) {
  let document = {
    schemaVersion: 1,
    records: initial.records || [],
    settings: {},
    insulinPlans: [],
    metadata: {},
  };
  return {
    getDocument: () => document,
    saveDocument: (nextDocument) => {
      document = nextDocument;
      return { ok: true, data: document };
    },
    mergeDocuments: (base, incoming) => ({
      ...base,
      records: [...new Map([...base.records, ...incoming.records].map((item) => [item.id, item])).values()],
    }),
    normalizeRecord: (item) => ({ ...item }),
  };
}

function createMockSupabase(remoteRows = [], options = {}) {
  const rows = [...remoteRows];
  const sharedSettingsRows = [...(options.sharedSettingsRows || [])];
  const foodRows = [...(options.foodRows || [])];
  const savedMealRows = [...(options.savedMealRows || [])];
  const rpcCalls = [];
  const userId = options.userId || 'user-1';
  const client = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: userId } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: () => Promise.resolve({ data: { session: { user: { id: userId } } } }),
      signOut: () => Promise.resolve({}),
      resetPasswordForEmail: () => Promise.resolve({}),
    },
    from(tableName) {
      const tableRows = tableName === 'lee_lee_shared_settings'
        ? sharedSettingsRows
        : (tableName === 'lee_lee_foods' ? foodRows : (tableName === 'lee_lee_saved_meals' ? savedMealRows : rows));
      const builder = {
        insert(payload) {
          if (tableName === 'lee_lee_records' && options.recordInsertError) {
            builder.error = options.recordInsertError;
            builder.current = null;
            return builder;
          }
          const index = tableName === 'lee_lee_shared_settings'
            ? tableRows.findIndex((row) => row.user_id === payload.user_id)
            : tableRows.findIndex((row) => row.id === payload.id);
          if (index >= 0) {
            builder.error = { code: '23505', message: 'duplicate key value violates unique constraint' };
            builder.current = null;
            return builder;
          }
          tableRows.push({
            ...payload,
            version: payload.version || 1,
            created_at: payload.client_created_at || '2026-08-01T12:45:00.000Z',
            updated_at: payload.client_created_at || '2026-08-01T12:45:00.000Z',
          });
          builder.current = tableName === 'lee_lee_shared_settings'
            ? tableRows.find((row) => row.user_id === payload.user_id)
            : tableRows.find((row) => row.id === payload.id);
          return builder;
        },
        upsert(payload) {
          const index = tableRows.findIndex((row) => row.id === payload.id && row.user_id === payload.user_id);
          if (index >= 0) {
            tableRows[index] = {
              ...tableRows[index],
              ...payload,
              version: Number(tableRows[index].version || 1) + 1,
              updated_at: '2026-08-01T13:15:00.000Z',
            };
            builder.current = tableRows[index];
            return builder;
          }
          tableRows.push({
            ...payload,
            version: payload.version || 1,
            created_at: payload.payload?.createdAt || '2026-08-01T12:45:00.000Z',
            updated_at: payload.payload?.updatedAt || '2026-08-01T12:45:00.000Z',
          });
          builder.current = tableRows.at(-1);
          return builder;
        },
        select() {
          return builder;
        },
        single() {
          if (builder.error) return Promise.resolve({ data: null, error: builder.error });
          return Promise.resolve({ data: builder.current, error: null });
        },
        maybeSingle() {
          const row = tableName === 'lee_lee_shared_settings'
            ? tableRows.find((item) => item.user_id === builder.filters?.user_id)
            : tableRows.find((item) => item.id === builder.filters?.id);
          if (!row) {
            return Promise.resolve({ data: null, error: null });
          }
          return Promise.resolve({ data: row, error: null });
        },
        eq(column, value) {
          builder.filters = { ...(builder.filters || {}), [column]: value };
          return builder;
        },
        order() {
          return Promise.resolve({ data: tableRows, error: null });
        },
      };
      return builder;
    },
    rpc(name, args) {
      rpcCalls.push({ name, args });
      if (name === 'update_lee_lee_shared_settings_with_version') {
        const row = sharedSettingsRows.find((item) => item.user_id === userId);
        if (!row || Number(row.version) !== Number(args.p_expected_version)) {
          return Promise.resolve({ data: null, error: null });
        }
        Object.assign(row, {
          patient_name: args.p_patient_name,
          patient_date_of_birth: args.p_patient_date_of_birth,
          clinic_name: args.p_clinic_name,
          clinic_phone: args.p_clinic_phone,
          last_edited_by: args.p_last_edited_by,
          payload: args.p_payload,
          app_schema_version: args.p_app_schema_version,
          version: Number(row.version) + 1,
          updated_at: '2026-08-01T13:15:00.000Z',
        });
        return Promise.resolve({ data: row, error: null });
      }
      if (name !== 'update_lee_lee_record_with_version') {
        return Promise.resolve({ data: null, error: { message: 'unknown rpc' } });
      }
      const row = rows.find((item) => item.id === args.p_id && item.user_id === userId);
      if (!row || Number(row.version) !== Number(args.p_expected_version)) {
        return Promise.resolve({ data: null, error: null });
      }
      Object.assign(row, {
        record_type: args.p_record_type,
        blood_sugar: args.p_blood_sugar,
        insulin_units: args.p_insulin_units,
        administered_insulin_units: args.p_administered_insulin_units,
        suggested_base_units: args.p_suggested_base_units,
        suggested_correction_units: args.p_suggested_correction_units,
        suggested_total_units: args.p_suggested_total_units,
        insulin_plan_id: args.p_insulin_plan_id,
        insulin_plan_snapshot: args.p_insulin_plan_snapshot,
        dose_calculation_status: args.p_dose_calculation_status,
        notes: args.p_notes,
        recorded_at: args.p_recorded_at,
        entered_by: args.p_entered_by,
        last_edited_by: args.p_last_edited_by,
        deleted_at: args.p_deleted_at,
        deleted_by: args.p_deleted_by,
        source: args.p_source,
        client_created_at: args.p_client_created_at,
        migration_fingerprint: args.p_migration_fingerprint,
        import_fingerprint: args.p_import_fingerprint,
        app_schema_version: args.p_app_schema_version,
        payload: args.p_payload,
        version: Number(row.version) + 1,
        updated_at: '2026-08-01T13:15:00.000Z',
      });
      return Promise.resolve({ data: row, error: null });
    },
    channel() {
      return {
        on() {
          return this;
        },
        subscribe(callback) {
          callback?.('SUBSCRIBED');
          return this;
        },
      };
    },
    removeChannel() {},
    rows,
    sharedSettingsRows,
    foodRows,
    savedMealRows,
    rpcCalls,
  };
  return { createClient: () => client, client };
}

function sharedInsulinPlan(overrides = {}) {
  return {
    id: 'plan-shared',
    name: 'Shared School Plan',
    effectiveFrom: '2026-08-14',
    effectiveTo: null,
    mealBaseUnitsByType: { Breakfast: 5, Lunch: 6, Dinner: 6 },
    mealBaseUnits: 5,
    bedtimeBaseUnits: 15,
    insulinCarbRatioGrams: 20,
    doseRoundingMode: 'nearest',
    doseIncrementUnits: 0.5,
    minimumAllowableDoseUnits: 0,
    supportedMealTypes: ['Breakfast', 'Lunch', 'Dinner'],
    correctionRanges: [
      { minGlucose: null, maxGlucose: 174, correctionUnits: 0 },
      { minGlucose: 175, maxGlucose: 249, correctionUnits: 1 },
      { minGlucose: 250, maxGlucose: 324, correctionUnits: 2 },
      { minGlucose: 325, maxGlucose: 399, correctionUnits: 3 },
      { minGlucose: 400, maxGlucose: 474, correctionUnits: 4 },
      { minGlucose: 475, maxGlucose: 549, correctionUnits: 5 },
      { minGlucose: 550, maxGlucose: null, correctionUnits: 6 },
    ],
    notes: 'Shared plan note',
    createdAt: '2026-08-14T12:00:00.000Z',
    updatedAt: '2026-08-14T12:30:00.000Z',
    ...overrides,
  };
}

function sharedSettings(overrides = {}) {
  return {
    patientName: 'Lee Bernal',
    patientBirthDate: '2014-06-13',
    clinicName: 'Vanderbilt Children',
    clinicPhone: '615-555-0100',
    insulinPlan: sharedInsulinPlan(),
    ...overrides,
  };
}

function remoteSharedSettingsRow(overrides = {}) {
  const settings = sharedSettings(overrides.settings || {});
  return {
    user_id: 'user-1',
    patient_name: settings.patientName,
    patient_date_of_birth: settings.patientBirthDate,
    clinic_name: settings.clinicName,
    clinic_phone: settings.clinicPhone,
    version: overrides.version || 3,
    last_edited_by: overrides.last_edited_by || 'Rolando',
    updated_at: overrides.updated_at || '2026-08-14T13:00:00.000Z',
    payload: overrides.payload || {
      schemaVersion: 2,
      patientClinic: {
        patientName: settings.patientName,
        patientBirthDate: settings.patientBirthDate,
        clinicName: settings.clinicName,
        clinicPhone: settings.clinicPhone,
      },
      insulinConfiguration: {
        activeInsulinPlan: settings.insulinPlan,
      },
    },
    app_schema_version: overrides.app_schema_version || 2,
  };
}

test('reports missing Supabase config without throwing', () => {
  const context = createSyncContext();
  assert.equal(context.LeeLeeTrackerSync.getConfig().configured, false);
});

test('family device identities are valid and persisted locally', () => {
  const context = createSyncContext();
  assert.deepEqual(Array.from(context.LeeLeeTrackerSync.DEVICE_USERS), ['Rolando', 'Emily', 'Levi', 'Violet', 'Unknown']);

  for (const name of ['Rolando', 'Emily', 'Levi', 'Violet', 'Unknown']) {
    context.LeeLeeTrackerSync.setDeviceIdentity(name);
    assert.equal(context.LeeLeeTrackerSync.getDeviceIdentity(), name);
  }
});

test('invalid device identity falls back to Unknown', () => {
  const context = createSyncContext();
  assert.equal(context.LeeLeeTrackerSync.setDeviceIdentity('Other'), 'Unknown');
  assert.equal(context.LeeLeeTrackerSync.getDeviceIdentity(), 'Unknown');
});

test('new records queued by Levi and Violet carry selected identity metadata', async () => {
  for (const name of ['Levi', 'Violet']) {
    const supabase = createMockSupabase();
    const context = createSyncContext({
      supabase,
      config: { url: 'https://example.supabase.co', publishableKey: 'publishable-key-for-browser-tests-123' },
    });
    context.navigator.onLine = false;
    const store = createDocumentStore();
    const repository = context.LeeLeeTrackerSync.createRepository(store);

    await repository.initialize();
    repository.setDeviceIdentity(name);
    const operation = repository.queueUpsert(record({ id: `local-${name}`, enteredBy: '' }), null);
    assert.equal(operation.payload.enteredBy, name);

    context.navigator.onLine = true;
    await repository.processQueue();
    assert.equal(supabase.client.rows[0].entered_by, name);
    assert.equal(supabase.client.rows[0].payload.enteredBy, name);
  }
});

test('editing existing records does not rewrite original enteredBy identity', async () => {
  const supabase = createMockSupabase();
  const context = createSyncContext({
    supabase,
    config: { url: 'https://example.supabase.co', publishableKey: 'publishable-key-for-browser-tests-123' },
  });
  context.navigator.onLine = false;
  const store = createDocumentStore({ records: [record({ id: 'existing-record', enteredBy: 'Rolando' })] });
  const repository = context.LeeLeeTrackerSync.createRepository(store);

  await repository.initialize();
  repository.setDeviceIdentity('Levi');
  const operation = repository.queueUpsert(
    record({ id: 'existing-record', bloodSugar: 210, enteredBy: 'Rolando' }),
    record({ id: 'existing-record', bloodSugar: 198, enteredBy: 'Rolando' }),
  );

  assert.equal(operation.payload.enteredBy, 'Rolando');
  assert.equal(operation.payload.lastEditedBy, 'Levi');
});

test('sync serialization accepts Levi, Violet, and Unknown identities', () => {
  const context = createSyncContext();
  for (const name of ['Levi', 'Violet', 'Unknown']) {
    const remote = context.LeeLeeTrackerSync.sanitizeRecordForRemote(record({
      id: `record-${name}`,
      enteredBy: name,
      lastEditedBy: name === 'Unknown' ? null : name,
    }), 'user-1');

    assert.equal(remote.entered_by, name);
    assert.equal(remote.payload.enteredBy, name);
    assert.equal(remote.last_edited_by, name === 'Unknown' ? null : name);
  }
});

test('new record queues locally and uploads through Supabase once initialized', async () => {
  const supabase = createMockSupabase();
  const context = createSyncContext({
    supabase,
    config: { url: 'https://example.supabase.co', publishableKey: 'publishable-key-for-browser-tests-123' },
  });
  context.navigator.onLine = false;
  const store = createDocumentStore({ records: [record()] });
  const repository = context.LeeLeeTrackerSync.createRepository(store);

  await repository.initialize();
  assert.equal(repository.getSyncStatus().signedIn, true);
  repository.setDeviceIdentity('Rolando');
  repository.queueUpsert(record({ id: 'local-first' }), null);
  context.navigator.onLine = true;
  await repository.processQueue();

  assert.equal(supabase.client.rows.some((row) => row.id === 'local-first'), true);
  assert.equal(repository.getSyncStatus().pendingCount, 0);
});

test('record insert check constraint failures keep entries preserved with safe diagnostics', async () => {
  const supabase = createMockSupabase([], {
    recordInsertError: {
      code: '23514',
      message: 'new row for relation "lee_lee_records" violates check constraint "lee_lee_records_entered_by_check"',
      details: 'Failing row contains sensitive data omitted by Supabase.',
      hint: '',
    },
  });
  const context = createSyncContext({
    supabase,
    config: { url: 'https://example.supabase.co', publishableKey: 'publishable-key-for-browser-tests-123' },
  });
  context.navigator.onLine = false;
  const store = createDocumentStore({ records: [record({ id: 'constraint-record', enteredBy: 'Levi' })] });
  const repository = context.LeeLeeTrackerSync.createRepository(store);

  await repository.initialize();
  repository.queueUpsert(record({ id: 'constraint-record', enteredBy: 'Levi' }), null);
  context.navigator.onLine = true;
  await repository.processQueue();

  const status = repository.getSyncStatus();
  const diagnostics = repository.getSyncDiagnostics();
  assert.equal(status.pendingCount, 1);
  assert.equal(status.lastSyncAttempt.attempted, 1);
  assert.equal(status.lastSyncAttempt.failed, 1);
  assert.equal(status.lastSyncAttempt.failuresByReason.validation, 1);
  assert.equal(diagnostics.queue[0].state, 'needs-attention');
  assert.equal(diagnostics.queue[0].recordType, 'Breakfast');
  assert.equal(diagnostics.queue[0].lastErrorCode, '23514');
  assert.match(diagnostics.queue[0].lastErrorMessage, /entered_by_check/);
  assert.equal('bloodSugar' in diagnostics.queue[0], false);
  assert.equal('insulinUnits' in diagnostics.queue[0], false);
});

test('automatic queue processing skips deterministic needs-attention items until explicit retry', async () => {
  const supabase = createMockSupabase([], {
    recordInsertError: {
      code: '23514',
      message: 'violates check constraint "lee_lee_records_entered_by_check"',
    },
  });
  const context = createSyncContext({
    supabase,
    config: { url: 'https://example.supabase.co', publishableKey: 'publishable-key-for-browser-tests-123' },
  });
  context.navigator.onLine = false;
  const store = createDocumentStore({ records: [record({ id: 'needs-attention', enteredBy: 'Violet' })] });
  const repository = context.LeeLeeTrackerSync.createRepository(store);

  await repository.initialize();
  repository.queueUpsert(record({ id: 'needs-attention', enteredBy: 'Violet' }), null);
  context.navigator.onLine = true;
  await repository.processQueue();
  assert.equal(repository.getSyncDiagnostics().queue[0].retryCount, 1);

  await repository.processQueue();
  assert.equal(repository.getSyncDiagnostics().queue[0].retryCount, 1);

  await repository.processQueue({ includeNeedsAttention: true });
  assert.equal(repository.getSyncDiagnostics().queue[0].retryCount, 2);
});

test('same-record stale update creates a conflict instead of overwriting', async () => {
  const supabase = createMockSupabase([{
    id: 'record-1',
    user_id: 'user-1',
    record_type: 'Breakfast',
    blood_sugar: 205,
    insulin_units: 5,
    administered_insulin_units: 5,
    notes: 'Eggs, "toast", and juice',
    recorded_at: '2026-08-01T12:42:00.000Z',
    client_created_at: '2026-08-01T12:45:00.000Z',
    created_at: '2026-08-01T12:45:00.000Z',
    updated_at: '2026-08-01T13:00:00.000Z',
    version: 2,
    entered_by: 'Emily',
    payload: record({ bloodSugar: 205, version: 2, enteredBy: 'Emily' }),
  }]);
  const context = createSyncContext({
    supabase,
    config: { url: 'https://example.supabase.co', publishableKey: 'publishable-key-for-browser-tests-123' },
  });
  context.navigator.onLine = false;
  const store = createDocumentStore({ records: [record({ version: 1 })] });
  const repository = context.LeeLeeTrackerSync.createRepository(store);

  await repository.initialize();
  repository.queueUpsert(record({ version: 1, bloodSugar: 198 }), record({ version: 1 }));
  context.navigator.onLine = true;
  await repository.processQueue();
  assert.equal(repository.getConflicts().length, 1);
  assert.equal(supabase.client.rows[0].blood_sugar, 205);
  assert.equal(supabase.client.rpcCalls[0].name, 'update_lee_lee_record_with_version');
  assert.equal(supabase.client.rpcCalls[0].args.p_expected_version, 1);
});

test('two clients updating the same base version produce one update and one conflict', async () => {
  const supabase = createMockSupabase([{
    id: 'record-1',
    user_id: 'user-1',
    record_type: 'Breakfast',
    blood_sugar: 180,
    insulin_units: 5,
    administered_insulin_units: 5,
    notes: 'Eggs, "toast", and juice',
    recorded_at: '2026-08-01T12:42:00.000Z',
    client_created_at: '2026-08-01T12:45:00.000Z',
    created_at: '2026-08-01T12:45:00.000Z',
    updated_at: '2026-08-01T12:45:00.000Z',
    version: 1,
    entered_by: 'Rolando',
    payload: record({ bloodSugar: 180, version: 1 }),
  }]);
  const context = createSyncContext({
    supabase,
    config: { url: 'https://example.supabase.co', publishableKey: 'publishable-key-for-browser-tests-123' },
  });
  context.navigator.onLine = false;
  const store = createDocumentStore({ records: [record({ version: 1, bloodSugar: 180 })] });
  const repository = context.LeeLeeTrackerSync.createRepository(store);

  await repository.initialize();
  repository.queueUpsert(record({ version: 1, bloodSugar: 190 }), record({ version: 1, bloodSugar: 180 }));
  repository.queueUpsert(record({ version: 1, bloodSugar: 210 }), record({ version: 1, bloodSugar: 180 }));
  context.navigator.onLine = true;
  await repository.processQueue();

  assert.equal(supabase.client.rows[0].blood_sugar, 190);
  assert.equal(supabase.client.rows[0].version, 2);
  assert.equal(repository.getConflicts().length, 1);
  assert.equal(repository.getConflicts()[0].localRecord.bloodSugar, 210);
  assert.deepEqual(supabase.client.rpcCalls.map((call) => call.args.p_expected_version), [1, 1]);
});

test('soft delete and restore use version-matched RPC updates that increment once', async () => {
  const supabase = createMockSupabase([{
    id: 'record-1',
    user_id: 'user-1',
    record_type: 'Breakfast',
    blood_sugar: 180,
    insulin_units: 5,
    administered_insulin_units: 5,
    notes: 'Eggs, "toast", and juice',
    recorded_at: '2026-08-01T12:42:00.000Z',
    client_created_at: '2026-08-01T12:45:00.000Z',
    created_at: '2026-08-01T12:45:00.000Z',
    updated_at: '2026-08-01T12:45:00.000Z',
    version: 1,
    entered_by: 'Rolando',
    payload: record({ bloodSugar: 180, version: 1 }),
  }]);
  const context = createSyncContext({
    supabase,
    config: { url: 'https://example.supabase.co', publishableKey: 'publishable-key-for-browser-tests-123' },
  });
  context.navigator.onLine = false;
  const store = createDocumentStore({ records: [record({ version: 1, bloodSugar: 180 })] });
  const repository = context.LeeLeeTrackerSync.createRepository(store);

  await repository.initialize();
  repository.setDeviceIdentity('Emily');
  repository.queueSoftDelete(record({ version: 1, bloodSugar: 180 }));
  context.navigator.onLine = true;
  await repository.processQueue();

  assert.equal(Boolean(supabase.client.rows[0].deleted_at), true);
  assert.equal(supabase.client.rows[0].deleted_by, 'Emily');
  assert.equal(supabase.client.rows[0].version, 2);

  context.navigator.onLine = false;
  repository.queueRestore(record({
    version: 2,
    bloodSugar: 180,
    deletedAt: supabase.client.rows[0].deleted_at,
    deletedBy: 'Emily',
  }));
  context.navigator.onLine = true;
  await repository.processQueue();

  assert.equal(supabase.client.rows[0].deleted_at, null);
  assert.equal(supabase.client.rows[0].deleted_by, null);
  assert.equal(supabase.client.rows[0].version, 3);
  assert.deepEqual(supabase.client.rpcCalls.map((call) => call.args.p_expected_version), [1, 2]);
});

test('conflict resolution using local version applies against the latest shared version', async () => {
  const supabase = createMockSupabase([{
    id: 'record-1',
    user_id: 'user-1',
    record_type: 'Breakfast',
    blood_sugar: 205,
    insulin_units: 5,
    administered_insulin_units: 5,
    notes: '',
    recorded_at: '2026-08-01T12:42:00.000Z',
    client_created_at: '2026-08-01T12:45:00.000Z',
    created_at: '2026-08-01T12:45:00.000Z',
    updated_at: '2026-08-01T13:00:00.000Z',
    version: 2,
    entered_by: 'Emily',
    payload: record({ bloodSugar: 205, version: 2, enteredBy: 'Emily' }),
  }]);
  const context = createSyncContext({
    supabase,
    config: { url: 'https://example.supabase.co', publishableKey: 'publishable-key-for-browser-tests-123' },
  });
  context.navigator.onLine = false;
  const store = createDocumentStore({ records: [record({ version: 1 })] });
  const repository = context.LeeLeeTrackerSync.createRepository(store);

  await repository.initialize();
  repository.queueUpsert(record({ version: 1, bloodSugar: 198 }), record({ version: 1 }));
  context.navigator.onLine = true;
  await repository.processQueue();
  assert.equal(repository.getConflicts().length, 1);

  await repository.useLocalVersion('record-1');

  assert.equal(repository.getConflicts().length, 0);
  assert.equal(supabase.client.rows[0].blood_sugar, 198);
  assert.equal(supabase.client.rows[0].version, 3);
  assert.deepEqual(supabase.client.rpcCalls.map((call) => call.args.p_expected_version), [1, 2]);
});

test('shared settings insert for authenticated user and sync to a second client', async () => {
  const supabase = createMockSupabase();
  const config = { url: 'https://example.supabase.co', publishableKey: 'publishable-key-for-browser-tests-123' };
  const firstContext = createSyncContext({ supabase, config });
  const secondContext = createSyncContext({ supabase, config });
  const first = firstContext.LeeLeeTrackerSync.createRepository(createDocumentStore());
  const second = secondContext.LeeLeeTrackerSync.createRepository(createDocumentStore());

  await first.initialize();
  first.setDeviceIdentity('Rolando');
  first.saveSharedSettings({
    patientName: 'Lee',
    patientBirthDate: '2026-07-31',
    clinicName: 'Care Team',
    clinicPhone: '555-0100',
  });
  await first.processSharedSettingsQueue();
  await second.initialize();

  assert.equal(supabase.client.sharedSettingsRows.length, 1);
  assert.equal(second.getSharedSettings().patientName, 'Lee');
  assert.equal(second.getSharedSettingsStatus().hasRemote, true);
});

test('shared settings serialize and deserialize the complete shared care contract', () => {
  const context = createSyncContext();
  const normalized = context.LeeLeeTrackerSync.normalizeSharedSettings(sharedSettings());
  const remote = context.LeeLeeTrackerSync.sharedSettingsToRemote({
    ...normalized,
    historyInitialWindowDays: '14',
    deviceIdentity: 'Levi',
    migration: { completed: true },
  }, 'user-1');
  const restored = context.LeeLeeTrackerSync.sharedSettingsFromRemote({
    ...remote,
    version: 4,
    updated_at: '2026-08-14T13:00:00.000Z',
  });

  assert.deepEqual(restored.insulinPlan.mealBaseUnitsByType, { Breakfast: 5, Lunch: 6, Dinner: 6 });
  assert.equal(restored.insulinPlan.correctionRanges.at(-1).minGlucose, 550);
  assert.equal(restored.insulinPlan.correctionRanges.at(-1).maxGlucose, null);
  assert.equal(restored.insulinPlan.correctionRanges.at(-1).correctionUnits, 6);
  assert.equal(restored.patientName, 'Lee Bernal');
  assert.equal(restored.clinicPhone, '615-555-0100');
  assert.deepEqual(restored.insulinPlan, normalized.insulinPlan);
  assert.equal(remote.payload.schemaVersion, 2);
  assert.equal(remote.app_schema_version, 2);
  assert.equal(Object.hasOwn(remote.payload, 'historyInitialWindowDays'), false);
  assert.equal(Object.hasOwn(remote.payload, 'deviceIdentity'), false);
  assert.equal(Object.hasOwn(remote.payload, 'migration'), false);
});

test('shared settings write payload includes dose settings and excludes local-only preferences', async () => {
  const supabase = createMockSupabase();
  const context = createSyncContext({
    supabase,
    config: { url: 'https://example.supabase.co', publishableKey: 'publishable-key-for-browser-tests-123' },
  });
  const repository = context.LeeLeeTrackerSync.createRepository(createDocumentStore());

  await repository.initialize();
  repository.setDeviceIdentity('Levi');
  repository.saveSharedSettings({
    ...sharedSettings(),
    historyInitialWindowDays: '60',
    syncDiagnosticsOpen: true,
  });
  await repository.processSharedSettingsQueue();

  const row = supabase.client.sharedSettingsRows[0];
  assert.equal(row.last_edited_by, 'Levi');
  assert.equal(row.payload.patientClinic.patientName, 'Lee Bernal');
  assert.deepEqual(row.payload.insulinConfiguration.activeInsulinPlan.mealBaseUnitsByType, { Breakfast: 5, Lunch: 6, Dinner: 6 });
  assert.equal(row.payload.insulinConfiguration.activeInsulinPlan.insulinCarbRatioGrams, 20);
  assert.equal(row.payload.insulinConfiguration.activeInsulinPlan.doseRoundingMode, 'nearest');
  assert.equal(row.payload.insulinConfiguration.activeInsulinPlan.doseIncrementUnits, 0.5);
  assert.equal(row.payload.insulinConfiguration.activeInsulinPlan.minimumAllowableDoseUnits, 0);
  assert.equal(row.payload.insulinConfiguration.activeInsulinPlan.correctionRanges.at(-1).minGlucose, 550);
  assert.equal(row.payload.insulinConfiguration.activeInsulinPlan.correctionRanges.at(-1).maxGlucose, null);
  assert.equal(row.payload.insulinConfiguration.activeInsulinPlan.correctionRanges.at(-1).correctionUnits, 6);
  assert.equal(Object.hasOwn(row.payload, 'historyInitialWindowDays'), false);
  assert.equal(Object.hasOwn(row.payload, 'syncDiagnosticsOpen'), false);
});

test('shared settings read restores patient clinic and dose configuration from remote payload', async () => {
  const supabase = createMockSupabase([], {
    sharedSettingsRows: [remoteSharedSettingsRow()],
  });
  const context = createSyncContext({
    supabase,
    config: { url: 'https://example.supabase.co', publishableKey: 'publishable-key-for-browser-tests-123' },
  });
  const repository = context.LeeLeeTrackerSync.createRepository(createDocumentStore());

  await repository.initialize();

  const restored = repository.getSharedSettings();
  assert.equal(restored.patientName, 'Lee Bernal');
  assert.equal(restored.clinicName, 'Vanderbilt Children');
  assert.deepEqual(restored.insulinPlan.mealBaseUnitsByType, { Breakfast: 5, Lunch: 6, Dinner: 6 });
  assert.equal(restored.insulinPlan.insulinCarbRatioGrams, 20);
  assert.equal(restored.insulinPlan.doseRoundingMode, 'nearest');
  assert.equal(restored.insulinPlan.doseIncrementUnits, 0.5);
  assert.equal(restored.insulinPlan.minimumAllowableDoseUnits, 0);
  assert.equal(restored.insulinPlan.correctionRanges.at(-1).minGlucose, 550);
  assert.equal(restored.insulinPlan.correctionRanges.at(-1).maxGlucose, null);
  assert.equal(restored.insulinPlan.correctionRanges.at(-1).correctionUnits, 6);
});

test('legacy shared settings payloads are upgraded with the current dose defaults', () => {
  const context = createSyncContext();
  const restored = context.LeeLeeTrackerSync.sharedSettingsFromRemote({
    user_id: 'user-1',
    patient_name: 'Legacy Lee',
    patient_date_of_birth: '2014-06-13',
    clinic_name: 'Legacy Clinic',
    clinic_phone: '555-0100',
    version: 1,
    last_edited_by: 'Emily',
    payload: { patientName: 'Legacy Lee' },
    app_schema_version: 1,
  });

  assert.equal(restored.patientName, 'Legacy Lee');
  assert.deepEqual(restored.insulinPlan.mealBaseUnitsByType, { Breakfast: 5, Lunch: 6, Dinner: 6 });
  assert.equal(restored.insulinPlan.insulinCarbRatioGrams, 20);
  assert.equal(restored.insulinPlan.doseRoundingMode, 'nearest');
  assert.equal(restored.insulinPlan.doseIncrementUnits, 0.5);
  assert.equal(restored.insulinPlan.minimumAllowableDoseUnits, 0);
  assert.equal(restored.insulinPlan.correctionRanges.at(-1).minGlucose, 550);
  assert.equal(restored.insulinPlan.correctionRanges.at(-1).maxGlucose, null);
  assert.equal(restored.insulinPlan.correctionRanges.at(-1).correctionUnits, 6);
});

test('legacy shared settings payloads restore active insulin plans from plan collections', () => {
  const context = createSyncContext();
  const restored = context.LeeLeeTrackerSync.sharedSettingsFromRemote({
    user_id: 'user-1',
    patient_name: 'Legacy Lee',
    patient_date_of_birth: '2014-06-13',
    clinic_name: 'Legacy Clinic',
    clinic_phone: '555-0100',
    version: 2,
    last_edited_by: 'Emily',
    payload: {
      activeInsulinPlanId: 'plan-15',
      insulinPlans: [
        sharedInsulinPlan({ id: 'plan-20', insulinCarbRatioGrams: 20 }),
        sharedInsulinPlan({
          id: 'plan-15',
          insulinCarbRatioGrams: 15,
          doseRoundingMode: 'down',
          doseIncrementUnits: 0.1,
          minimumAllowableDoseUnits: 0.5,
        }),
      ],
    },
    app_schema_version: 1,
  });

  assert.equal(restored.insulinPlan.id, 'plan-15');
  assert.equal(restored.insulinPlan.insulinCarbRatioGrams, 15);
  assert.equal(restored.insulinPlan.doseRoundingMode, 'down');
  assert.equal(restored.insulinPlan.doseIncrementUnits, 0.1);
  assert.equal(restored.insulinPlan.minimumAllowableDoseUnits, 0.5);
});

test('startup pulls established remote shared settings without pushing local defaults', async () => {
  const supabase = createMockSupabase([], {
    sharedSettingsRows: [remoteSharedSettingsRow()],
  });
  const context = createSyncContext({
    supabase,
    config: { url: 'https://example.supabase.co', publishableKey: 'publishable-key-for-browser-tests-123' },
  });
  const repository = context.LeeLeeTrackerSync.createRepository({
    ...createDocumentStore(),
    getLocalSharedSettings: () => ({
      patientName: '',
      patientBirthDate: '',
      clinicName: '',
      clinicPhone: '',
      insulinPlan: context.LeeLeeTrackerSync.normalizeSharedInsulinPlan(),
    }),
  });

  await repository.initialize();

  assert.equal(repository.getConflicts().length, 0);
  assert.equal(repository.getSharedSettings().patientName, 'Lee Bernal');
  assert.equal(supabase.client.sharedSettingsRows.length, 1);
  assert.equal(supabase.client.rpcCalls.some((call) => call.name === 'update_lee_lee_shared_settings_with_version'), false);
});

test('cross-device shared settings sync carries patient and dose updates', async () => {
  const supabase = createMockSupabase();
  const config = { url: 'https://example.supabase.co', publishableKey: 'publishable-key-for-browser-tests-123' };
  const firstContext = createSyncContext({ supabase, config });
  const secondContext = createSyncContext({ supabase, config });
  const first = firstContext.LeeLeeTrackerSync.createRepository(createDocumentStore());
  const second = secondContext.LeeLeeTrackerSync.createRepository(createDocumentStore());

  await first.initialize();
  first.saveSharedSettings(sharedSettings({
    patientName: 'Updated Lee',
    insulinPlan: sharedInsulinPlan({
      mealBaseUnitsByType: { Breakfast: 5, Lunch: 6, Dinner: 6 },
      insulinCarbRatioGrams: 15,
      doseRoundingMode: 'down',
      doseIncrementUnits: 0.1,
      minimumAllowableDoseUnits: 0.5,
      correctionRanges: [
        { minGlucose: null, maxGlucose: 174, correctionUnits: 0 },
        { minGlucose: 175, maxGlucose: 249, correctionUnits: 1 },
        { minGlucose: 250, maxGlucose: 324, correctionUnits: 2 },
        { minGlucose: 325, maxGlucose: 399, correctionUnits: 3 },
        { minGlucose: 400, maxGlucose: 474, correctionUnits: 4 },
        { minGlucose: 475, maxGlucose: 549, correctionUnits: 5 },
        { minGlucose: 550, maxGlucose: null, correctionUnits: 6 },
      ],
    }),
  }));
  await first.processSharedSettingsQueue();
  await second.initialize();

  assert.equal(second.getSharedSettings().patientName, 'Updated Lee');
  assert.equal(second.getSharedSettings().insulinPlan.mealBaseUnitsByType.Lunch, 6);
  assert.equal(second.getSharedSettings().insulinPlan.insulinCarbRatioGrams, 15);
  assert.equal(second.getSharedSettings().insulinPlan.doseRoundingMode, 'down');
  assert.equal(second.getSharedSettings().insulinPlan.doseIncrementUnits, 0.1);
  assert.equal(second.getSharedSettings().insulinPlan.minimumAllowableDoseUnits, 0.5);
  assert.equal(second.getSharedSettings().insulinPlan.correctionRanges.at(-1).correctionUnits, 6);
});

test('shared settings saves use the cached remote version instead of inserting duplicates', async () => {
  const supabase = createMockSupabase([], {
    sharedSettingsRows: [remoteSharedSettingsRow({ version: 7 })],
  });
  const context = createSyncContext({
    supabase,
    config: { url: 'https://example.supabase.co', publishableKey: 'publishable-key-for-browser-tests-123' },
  });
  const repository = context.LeeLeeTrackerSync.createRepository(createDocumentStore());

  await repository.initialize();
  repository.saveSharedSettings({
    patientName: 'Lee Bernal',
    insulinPlan: sharedInsulinPlan({ insulinCarbRatioGrams: 15 }),
  });
  await repository.processSharedSettingsQueue();

  assert.equal(supabase.client.sharedSettingsRows.length, 1);
  assert.equal(supabase.client.rpcCalls.at(-1).name, 'update_lee_lee_shared_settings_with_version');
  assert.equal(supabase.client.rpcCalls.at(-1).args.p_expected_version, 7);
  assert.equal(repository.getSharedSettings().insulinPlan.insulinCarbRatioGrams, 15);
});

test('shared settings stale version creates a conflict and preserves local version', async () => {
  const supabase = createMockSupabase([], {
    sharedSettingsRows: [{
      user_id: 'user-1',
      patient_name: 'Shared',
      patient_date_of_birth: '2026-07-31',
      clinic_name: 'Shared Clinic',
      clinic_phone: '555-0100',
      version: 2,
      last_edited_by: 'Emily',
      payload: {},
    }],
  });
  const context = createSyncContext({
    supabase,
    config: { url: 'https://example.supabase.co', publishableKey: 'publishable-key-for-browser-tests-123' },
  });
  context.navigator.onLine = false;
  const repository = context.LeeLeeTrackerSync.createRepository(createDocumentStore());

  await repository.initialize();
  repository.saveSharedSettings({
    patientName: 'Local',
    patientBirthDate: '2026-07-31',
    clinicName: 'Local Clinic',
    clinicPhone: '555-0199',
    version: 1,
  });
  context.navigator.onLine = true;
  await repository.processSharedSettingsQueue();

  const conflict = repository.getConflicts().find((item) => item.entityType === 'shared-settings');
  assert.equal(Boolean(conflict), true);
  assert.equal(conflict.localRecord.patientName, 'Local');
  assert.equal(conflict.sharedRecord.patientName, 'Shared');
});

test('offline shared settings queue survives reload and syncs exactly once', async () => {
  const localStorage = createLocalStorage();
  const supabase = createMockSupabase();
  const config = { url: 'https://example.supabase.co', publishableKey: 'publishable-key-for-browser-tests-123' };
  const firstContext = createSyncContext({ localStorage, supabase, config });
  firstContext.navigator.onLine = false;
  const first = firstContext.LeeLeeTrackerSync.createRepository(createDocumentStore());

  await first.initialize();
  first.saveSharedSettings({ patientName: 'Lee' });
  assert.equal(first.getSharedSettingsStatus().pendingCount, 1);

  const secondContext = createSyncContext({ localStorage, supabase, config });
  const second = secondContext.LeeLeeTrackerSync.createRepository(createDocumentStore());
  await second.initialize();
  await second.processSharedSettingsQueue();

  assert.equal(supabase.client.sharedSettingsRows.length, 1);
  assert.equal(second.getSharedSettingsStatus().pendingCount, 0);
});

test('shared settings migration metadata is separate from medical-record migration metadata', () => {
  const context = createSyncContext();
  const repository = context.LeeLeeTrackerSync.createRepository(createDocumentStore());

  repository.setSharedSettingsMigration({ prompted: true, dismissedAt: '2026-08-04T12:00:00.000Z' });

  assert.equal(repository.getSharedSettingsMigration().prompted, true);
  assert.notEqual(repository.keys.sharedSettingsMigration, repository.keys.migration);
  assert.equal(repository.sharedSettingsHaveValues({ patientName: 'Lee' }), true);
});

test('default shared dose settings do not count as local values when only metadata differs', () => {
  const context = createSyncContext();
  const repository = context.LeeLeeTrackerSync.createRepository(createDocumentStore());
  const defaultPlan = context.LeeLeeTrackerSync.normalizeSharedInsulinPlan();

  assert.equal(repository.sharedSettingsHaveValues({
    patientName: '',
    patientBirthDate: '',
    clinicName: '',
    clinicPhone: '',
    insulinPlan: {
      ...defaultPlan,
      id: 'device-local-plan-id',
      createdAt: '2026-07-31T05:00:00.000Z',
      updatedAt: '2026-08-14T15:00:00.000Z',
    },
  }), false);
});

test('sync repository exposes a read-only record queue snapshot for migration resume checks', () => {
  assert.match(syncSource, /function getRecordQueueSnapshot\(\)/);
  assert.match(syncSource, /getRecordQueueSnapshot,/);
  assert.match(syncSource, /getQueue\(\)\.map\(sanitizeOperationMetadata\)/);
  assert.match(syncSource, /lastErrorCategory: operation\?\.lastErrorCategory/);
});

test('identical conflicts are auto-resolved while meaningful differences remain', async () => {
  const supabase = createMockSupabase([{
    id: 'same-content',
    user_id: 'user-1',
    record_type: 'Breakfast',
    blood_sugar: 180,
    insulin_units: 5,
    administered_insulin_units: 5,
    notes: 'Eggs, "toast", and juice',
    recorded_at: '2026-08-01T12:42:00.000Z',
    client_created_at: '2026-08-01T12:45:00.000Z',
    created_at: '2026-08-01T12:45:00.000Z',
    updated_at: '2026-08-01T13:00:00.000Z',
    version: 2,
    entered_by: 'Emily',
    payload: record({ id: 'same-content', bloodSugar: 180, version: 2, enteredBy: 'Emily' }),
  }, {
    id: 'different-content',
    user_id: 'user-1',
    record_type: 'Breakfast',
    blood_sugar: 205,
    insulin_units: 5,
    administered_insulin_units: 5,
    notes: '',
    recorded_at: '2026-08-01T12:42:00.000Z',
    client_created_at: '2026-08-01T12:45:00.000Z',
    created_at: '2026-08-01T12:45:00.000Z',
    updated_at: '2026-08-01T13:00:00.000Z',
    version: 2,
    entered_by: 'Emily',
    payload: record({ id: 'different-content', bloodSugar: 205, version: 2, enteredBy: 'Emily' }),
  }]);
  const context = createSyncContext({
    supabase,
    config: { url: 'https://example.supabase.co', publishableKey: 'publishable-key-for-browser-tests-123' },
  });
  context.navigator.onLine = false;
  const repository = context.LeeLeeTrackerSync.createRepository(createDocumentStore());

  await repository.initialize();
  repository.queueUpsert(record({ id: 'same-content', version: 1, bloodSugar: 180 }), record({ id: 'same-content', version: 1 }));
  repository.queueUpsert(record({ id: 'different-content', version: 1, bloodSugar: 198 }), record({ id: 'different-content', version: 1 }));
  context.navigator.onLine = true;
  await repository.processQueue();

  assert.equal(repository.getConflicts().length, 2);
  assert.equal(repository.cleanupIdenticalConflicts(), 1);
  assert.equal(repository.getConflicts().length, 1);
  assert.equal(repository.getConflicts()[0].recordId, 'different-content');
});

test('JSON import preview flags same UUID with different content as a conflict', () => {
  const context = createSyncContext();
  const store = createDocumentStore();
  const repository = context.LeeLeeTrackerSync.createRepository(store);
  const preview = repository.previewJsonImport({
    appIdentifier: 'lee-lee-tracker-full-backup',
    records: [record({ id: 'same-id', bloodSugar: 220 })],
  }, [record({ id: 'same-id', bloodSugar: 180 })]);

  assert.equal(preview.summary.conflictingRecords.length, 1);
  assert.equal(preview.summary.newRecords.length, 0);
  assert.equal(preview.summary.identicalRecords.length, 0);
});

test('CSV export escapes quotes, commas, and line breaks', () => {
  const context = createSyncContext();
  const store = createDocumentStore();
  const repository = context.LeeLeeTrackerSync.createRepository(store);
  const csv = repository.exportCsv([{
    ...record({
      eventType: 'meal',
      type: 'Lunch',
      mealCarbs: 62,
      mealDescription: 'Turkey sandwich, chips, apple',
      notes: 'Line one,\nLine "two"',
    }),
  }]);

  assert.match(csv, /"Line one,\nLine ""two"""/);
  assert.match(csv, /"Entered By"/);
  assert.match(csv, /"Event Type","Record Type","Glucose","Insulin Units","Carbs","Meal Description"/);
  assert.match(csv, /"meal","Lunch","198","5","62","Turkey sandwich, chips, apple"/);
});

test('record content comparison includes meal and activity details', async () => {
  const context = createSyncContext();
  const store = createDocumentStore();
  const repository = context.LeeLeeTrackerSync.createRepository(store);
  const preview = repository.previewJsonImport({
    appIdentifier: 'lee-lee-tracker-full-backup',
    records: [record({
      id: 'meal-1',
      eventType: 'meal',
      type: 'Lunch',
      mealCarbs: 80,
      mealDescription: 'Pizza',
    })],
  }, [record({
    id: 'meal-1',
    eventType: 'meal',
    type: 'Lunch',
    mealCarbs: 20,
    mealDescription: 'Pizza',
  })]);

  assert.equal(preview.summary.conflictingRecords.length, 1);
});

test('SQL migration blocks direct updates and leaves writes to the versioned RPC', () => {
  const rpcMigrationBlock = migrationSource.match(
    /create or replace function public\.update_lee_lee_record_with_version[\s\S]*?grant execute on function public\.update_lee_lee_record_with_version/,
  )?.[0] || '';
  assert.match(migrationSource, /references auth\.users\(id\) on delete restrict/);
  assert.match(migrationSource, /security definer/);
  assert.match(migrationSource, /set search_path = ''/);
  assert.match(migrationSource, /current_user_id := auth\.uid\(\)/);
  assert.match(migrationSource, /if current_user_id is null then/);
  assert.match(migrationSource, /and user_id = current_user_id/);
  assert.match(migrationSource, /and version = p_expected_version/);
  assert.match(migrationSource, /version = public\.lee_lee_records\.version \+ 1/);
  assert.doesNotMatch(rpcMigrationBlock, /updated_at\s*=/);
  assert.match(migrationSource, /revoke update, delete on public\.lee_lee_records from authenticated, anon, public/);
  assert.match(migrationSource, /grant select, insert on public\.lee_lee_records to authenticated/);
  assert.doesNotMatch(migrationSource, /grant select, insert, update on public\.lee_lee_records to authenticated/);
  assert.match(migrationSource, /grant execute on function public\.update_lee_lee_record_with_version[\s\S]*to authenticated/);
  assert.match(migrationSource, /revoke all on function public\.update_lee_lee_record_with_version[\s\S]*from public, anon/);
  assert.match(migrationSource, /-- Intentionally no DELETE policy\./);
});

test('shared settings SQL migration uses RLS and version-aware RPC only', () => {
  const rpcMigrationBlock = sharedSettingsMigrationSource.match(
    /create or replace function public\.update_lee_lee_shared_settings_with_version[\s\S]*?grant execute on function public\.update_lee_lee_shared_settings_with_version/,
  )?.[0] || '';

  assert.match(sharedSettingsMigrationSource, /create table if not exists public\.lee_lee_shared_settings/);
  assert.match(sharedSettingsMigrationSource, /user_id uuid primary key references auth\.users\(id\) on delete restrict/);
  assert.match(sharedSettingsMigrationSource, /security definer/);
  assert.match(sharedSettingsMigrationSource, /set search_path = ''/);
  assert.match(sharedSettingsMigrationSource, /current_user_id := auth\.uid\(\)/);
  assert.match(sharedSettingsMigrationSource, /if current_user_id is null then/);
  assert.match(sharedSettingsMigrationSource, /user_id = current_user_id/);
  assert.match(sharedSettingsMigrationSource, /version = p_expected_version/);
  assert.match(sharedSettingsMigrationSource, /version = public\.lee_lee_shared_settings\.version \+ 1/);
  assert.doesNotMatch(rpcMigrationBlock, /updated_at\s*=/);
  assert.match(sharedSettingsMigrationSource, /revoke update, delete on public\.lee_lee_shared_settings from authenticated, anon, public/);
  assert.match(sharedSettingsMigrationSource, /grant select, insert on public\.lee_lee_shared_settings to authenticated/);
  assert.match(sharedSettingsMigrationSource, /grant execute on function public\.update_lee_lee_shared_settings_with_version[\s\S]*to authenticated/);
  assert.match(sharedSettingsMigrationSource, /revoke all on function public\.update_lee_lee_shared_settings_with_version[\s\S]*from public, anon/);
  assert.match(sharedSettingsEditorMigrationSource, /drop constraint if exists lee_lee_shared_settings_last_edited_by_check/);
  assert.match(sharedSettingsEditorMigrationSource, /last_edited_by in \('Rolando', 'Emily', 'Levi', 'Violet', 'Unknown'\)/);
  assert.doesNotMatch(sharedSettingsEditorMigrationSource, /grant .*service_role|disable row level security/i);
});

test('record editor SQL migration allows every in-app family identity without weakening RLS', () => {
  const allowedIdentities = /\('Rolando', 'Emily', 'Levi', 'Violet', 'Unknown'\)/;

  assert.match(migrationSource, allowedIdentities);
  assert.match(recordEditorMigrationSource, /drop constraint if exists lee_lee_records_entered_by_check/);
  assert.match(recordEditorMigrationSource, /drop constraint if exists lee_lee_records_last_edited_by_check/);
  assert.match(recordEditorMigrationSource, /drop constraint if exists lee_lee_records_deleted_by_check/);
  assert.match(recordEditorMigrationSource, /lee_lee_records_entered_by_check[\s\S]*entered_by in \('Rolando', 'Emily', 'Levi', 'Violet', 'Unknown'\)/);
  assert.match(recordEditorMigrationSource, /lee_lee_records_last_edited_by_check[\s\S]*last_edited_by is null or last_edited_by in \('Rolando', 'Emily', 'Levi', 'Violet', 'Unknown'\)/);
  assert.match(recordEditorMigrationSource, /lee_lee_records_deleted_by_check[\s\S]*deleted_by is null or deleted_by in \('Rolando', 'Emily', 'Levi', 'Violet', 'Unknown'\)/);
  assert.doesNotMatch(recordEditorMigrationSource, /grant .*service_role|disable row level security/i);
});

test('versioned RPC SQL uses COALESCE syntax without pg_catalog function qualification', () => {
  assert.doesNotMatch(migrationSource, /pg_catalog\.coalesce/i);
  assert.doesNotMatch(sharedSettingsMigrationSource, /pg_catalog\.coalesce/i);
  assert.doesNotMatch(rpcCoalesceRepairMigrationSource, /pg_catalog\.coalesce/i);
  assert.match(rpcCoalesceRepairMigrationSource, /create or replace function public\.update_lee_lee_record_with_version/);
  assert.match(rpcCoalesceRepairMigrationSource, /notes = coalesce\(p_notes, ''\)/);
  assert.match(rpcCoalesceRepairMigrationSource, /payload = coalesce\(p_payload, '\{\}'::jsonb\)/);
  assert.match(rpcCoalesceRepairMigrationSource, /create or replace function public\.update_lee_lee_shared_settings_with_version/);
  assert.match(rpcCoalesceRepairMigrationSource, /grant execute on function public\.update_lee_lee_record_with_version[\s\S]*to authenticated/);
  assert.match(rpcCoalesceRepairMigrationSource, /grant execute on function public\.update_lee_lee_shared_settings_with_version[\s\S]*to authenticated/);
  assert.doesNotMatch(rpcCoalesceRepairMigrationSource, /grant .*service_role|disable row level security/i);
});

test('versioned RPC mock succeeds for owner and returns no row for another user', async () => {
  const sharedRow = {
    id: 'record-1',
    user_id: 'user-1',
    record_type: 'Breakfast',
    blood_sugar: 180,
    insulin_units: 5,
    administered_insulin_units: 5,
    notes: '',
    recorded_at: '2026-08-01T12:42:00.000Z',
    client_created_at: '2026-08-01T12:45:00.000Z',
    created_at: '2026-08-01T12:45:00.000Z',
    updated_at: '2026-08-01T12:45:00.000Z',
    version: 1,
    entered_by: 'Rolando',
    payload: record({ bloodSugar: 180, version: 1 }),
  };
  const ownerSupabase = createMockSupabase([sharedRow], { userId: 'user-1' });
  const otherSupabase = createMockSupabase([sharedRow], { userId: 'user-2' });

  const ownerResult = await ownerSupabase.client.rpc('update_lee_lee_record_with_version', {
    p_id: 'record-1',
    p_expected_version: 1,
    p_record_type: 'Breakfast',
    p_blood_sugar: 190,
    p_insulin_units: 5,
    p_administered_insulin_units: 5,
    p_suggested_base_units: null,
    p_suggested_correction_units: null,
    p_suggested_total_units: null,
    p_insulin_plan_id: null,
    p_insulin_plan_snapshot: null,
    p_dose_calculation_status: 'manual',
    p_notes: '',
    p_recorded_at: '2026-08-01T12:42:00.000Z',
    p_entered_by: 'Rolando',
    p_last_edited_by: 'Rolando',
    p_deleted_at: null,
    p_deleted_by: null,
    p_source: 'app',
    p_client_created_at: '2026-08-01T12:45:00.000Z',
    p_migration_fingerprint: null,
    p_import_fingerprint: null,
    p_app_schema_version: 1,
    p_payload: record({ bloodSugar: 190, version: 1 }),
  });
  const otherResult = await otherSupabase.client.rpc('update_lee_lee_record_with_version', {
    ...ownerSupabase.client.rpcCalls[0].args,
    p_expected_version: 1,
  });

  assert.equal(ownerResult.data.blood_sugar, 190);
  assert.equal(ownerResult.data.version, 2);
  assert.equal(otherResult.data, null);
});

test('food library migration creates owned shared tables without food-name uniqueness', () => {
  assert.match(foodLibraryMigrationSource, /create table if not exists public\.lee_lee_foods/);
  assert.match(foodLibraryMigrationSource, /create table if not exists public\.lee_lee_saved_meals/);
  assert.match(foodLibraryMigrationSource, /carb_grams numeric\(8,2\) not null check \(carb_grams >= 0\)/);
  assert.match(foodLibraryMigrationSource, /total_carbs numeric\(8,2\) not null default 0 check \(total_carbs >= 0\)/);
  assert.match(foodLibraryMigrationSource, /alter table public\.lee_lee_foods enable row level security/);
  assert.match(foodLibraryMigrationSource, /alter table public\.lee_lee_saved_meals enable row level security/);
  assert.doesNotMatch(foodLibraryMigrationSource, /unique .*name/i);
  assert.doesNotMatch(foodLibraryMigrationSource, /grant .*service_role|disable row level security/i);
});

test('food and saved meal sync serialization preserves carb payload snapshots', () => {
  const context = createSyncContext();
  const foodRemote = context.LeeLeeTrackerSync.sanitizeLibraryItemForRemote({
    id: 'food-1',
    name: 'Ketchup',
    emoji: '🍅',
    carbs: 4,
    servingLabel: 'packet',
    favorite: true,
    sourceType: 'verified-label',
    sourceName: 'Nutrition Facts label',
    sourceUrl: 'https://example.test/ketchup',
    verificationNote: 'Family verified packet label.',
    seedKey: '',
    createdAt: '2026-08-31T12:00:00.000Z',
    updatedAt: '2026-08-31T12:00:00.000Z',
    enteredBy: 'Levi',
    version: 1,
  }, 'user-1', 'food');
  const mealRemote = context.LeeLeeTrackerSync.sanitizeLibraryItemForRemote({
    id: 'meal-1',
    name: 'Hot Dog Meal',
    totalCarbs: 28,
    components: [{ componentType: 'food', foodId: 'food-1', nameSnapshot: 'Ketchup', emojiSnapshot: '🍅', sourceTypeSnapshot: 'verified-label', sourceNameSnapshot: 'Nutrition Facts label', quantity: 1, carbsPerServing: 4, carbTotal: 4 }],
    createdAt: '2026-08-31T12:00:00.000Z',
    updatedAt: '2026-08-31T12:00:00.000Z',
    enteredBy: 'Levi',
    version: 1,
  }, 'user-1', 'saved-meal');

  assert.equal(foodRemote.user_id, 'user-1');
  assert.equal(foodRemote.carb_grams, 4);
  assert.equal(foodRemote.payload.emoji, '🍅');
  assert.equal(foodRemote.payload.servingLabel, 'packet');
  assert.equal(foodRemote.payload.sourceType, 'verified-label');
  assert.equal(foodRemote.payload.sourceName, 'Nutrition Facts label');
  assert.equal(foodRemote.payload.sourceUrl, 'https://example.test/ketchup');
  assert.equal(foodRemote.payload.verificationNote, 'Family verified packet label.');
  assert.equal(mealRemote.total_carbs, 28);
  assert.equal(mealRemote.payload.components[0].nameSnapshot, 'Ketchup');
  assert.equal(mealRemote.payload.components[0].emojiSnapshot, '🍅');
  assert.equal(mealRemote.payload.components[0].sourceTypeSnapshot, 'verified-label');
});

test('food library queue syncs offline-created foods and saved meals without record queue coupling', async () => {
  const store = createDocumentStore({
    records: [],
    foodLibrary: [],
    savedMeals: [],
  });
  let document = {
    schemaVersion: 1,
    records: [],
    foodLibrary: [],
    savedMeals: [],
    settings: {},
    insulinPlans: [],
    metadata: {},
  };
  store.getDocument = () => document;
  store.saveDocument = (nextDocument) => {
    document = nextDocument;
    return { ok: true, data: document };
  };
  store.mergeDocuments = (base, incoming) => ({
    ...base,
    records: [...new Map([...(base.records || []), ...(incoming.records || [])].map((item) => [item.id, item])).values()],
    foodLibrary: [...new Map([...(base.foodLibrary || []), ...(incoming.foodLibrary || [])].map((item) => [item.id, item])).values()],
    savedMeals: [...new Map([...(base.savedMeals || []), ...(incoming.savedMeals || [])].map((item) => [item.id, item])).values()],
  });
  const supabase = createMockSupabase([], { userId: 'user-1' });
  const context = createSyncContext({
    supabase,
    config: { url: 'https://example.supabase.co', publishableKey: 'a'.repeat(32) },
  });
  const repo = context.LeeLeeTrackerSync.createRepository({
    ...store,
    normalizeRecord: (item) => ({ ...item }),
    normalizeFood: (item) => item && item.name ? { ...item } : null,
    normalizeSavedMeal: (item) => item && item.name ? { ...item } : null,
  });

  await repo.initialize();
  repo.queueFoodUpsert({ id: 'food-1', name: 'Mustard', carbs: 0, createdAt: '2026-08-31T12:00:00.000Z', updatedAt: '2026-08-31T12:00:00.000Z', version: 1 });
  repo.queueSavedMealUpsert({ id: 'meal-1', name: 'Hot Dog Meal', totalCarbs: 0, components: [], createdAt: '2026-08-31T12:00:00.000Z', updatedAt: '2026-08-31T12:00:00.000Z', version: 1 });
  await repo.processFoodLibraryQueue();

  assert.equal(repo.getSyncStatus().foodLibraryPendingCount, 0);
  assert.equal(supabase.client.foodRows[0].name, 'Mustard');
  assert.equal(supabase.client.foodRows[0].carb_grams, 0);
  assert.equal(supabase.client.savedMealRows[0].name, 'Hot Dog Meal');
  assert.equal(repo.getRecordQueueSnapshot().length, 0);
});

test('starter food sync upserts by stable id so two devices do not create duplicates', async () => {
  const supabase = createMockSupabase([], { userId: 'user-1' });
  const createRepo = () => {
    const store = createDocumentStore({ records: [], foodLibrary: [], savedMeals: [] });
    const context = createSyncContext({
      supabase,
      config: { url: 'https://example.supabase.co', publishableKey: 'a'.repeat(32) },
    });
    return context.LeeLeeTrackerSync.createRepository({
      ...store,
      normalizeRecord: (item) => ({ ...item }),
      normalizeFood: (item) => item && item.name ? { ...item } : null,
      normalizeSavedMeal: (item) => item && item.name ? { ...item } : null,
    });
  };
  const starterFood = {
    id: '0e95de71-a68c-5b46-8e7f-779d641794be',
    name: 'Banana',
    emoji: '🍌',
    carbs: 27,
    servingLabel: '1 medium (118 g)',
    sourceType: 'reference',
    sourceName: 'USDA SNAP-Ed',
    seedKey: 'starter-banana-medium',
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
    version: 1,
  };
  const firstRepo = createRepo();
  const secondRepo = createRepo();

  await firstRepo.initialize();
  await secondRepo.initialize();
  firstRepo.queueFoodUpsert(starterFood);
  secondRepo.queueFoodUpsert(starterFood);
  await firstRepo.processFoodLibraryQueue();
  await secondRepo.processFoodLibraryQueue();

  assert.equal(supabase.client.foodRows.filter((row) => row.payload.seedKey === 'starter-banana-medium').length, 1);
  assert.equal(supabase.client.foodRows[0].payload.sourceType, 'reference');
  assert.equal(supabase.client.foodRows[0].payload.emoji, '🍌');
});
