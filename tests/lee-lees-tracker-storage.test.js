import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const trackerSource = readFileSync(new URL('../js/lee-lee-diabetes-tracker.js', import.meta.url), 'utf8');
const storageKey = 'lando-world:lee-lees-tracker:v1';
const preRebrandKeyPrefix = ['le', 'vi'].join('');
const legacyRecordsKey = `${preRebrandKeyPrefix}_diabetes_records_v1`;
const legacyPlansKey = `${preRebrandKeyPrefix}_diabetes_insulin_plans_v1`;

function createLocalStorage(seed = {}, options = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem: (key) => store.get(key) || null,
    setItem: (key, value) => {
      if (options.failWritesFor?.includes(key)) throw new Error('quota');
      store.set(key, String(value));
    },
    removeItem: (key) => store.delete(key),
    dump: () => Object.fromEntries(store),
  };
}

function createTracker({ localStorage = createLocalStorage() } = {}) {
  const root = {
    addEventListener() {},
    querySelector() {
      return null;
    },
    innerHTML: '',
  };
  const context = {
    Blob,
    console,
    Date,
    FileReader: class {},
    Intl,
    JSON,
    Map,
    Math,
    Number,
    Object,
    Promise,
    RegExp,
    String,
    URL: {
      createObjectURL: () => 'blob:test',
      revokeObjectURL() {},
    },
    crypto: {
      randomUUID: () => `test-${Math.random().toString(36).slice(2)}`,
    },
    document: {
      addEventListener() {},
      body: { append() {} },
      createElement: () => ({ click() {}, remove() {} }),
      getElementById: () => root,
    },
    localStorage,
    navigator: {
      language: 'en-US',
      storage: {
        persist: () => Promise.resolve(false),
      },
    },
    window: null,
  };
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(trackerSource, context);
  return { storage: context.LeeLeeTrackerStorage, localStorage };
}

function sampleRecord(overrides = {}) {
  return {
    id: 'record-1',
    timestamp: 1785501720000,
    type: 'Breakfast',
    bloodSugar: 198,
    insulinUnits: 5,
    notes: 'Entered later',
    unknownFutureField: 'preserve me',
    ...overrides,
  };
}

test('migrates legacy record and plan keys into the stable tracker document without deleting legacy data', () => {
  const localStorage = createLocalStorage({
    [legacyRecordsKey]: JSON.stringify([sampleRecord()]),
    [legacyPlansKey]: JSON.stringify([{
      id: 'plan-1',
      name: 'Plan',
      effectiveFrom: '2026-07-31',
      mealBaseUnits: 4,
      supportedMealTypes: ['Breakfast', 'Lunch', 'Dinner'],
      correctionRanges: [{ minGlucose: null, maxGlucose: 174, correctionUnits: 0 }],
    }]),
  });
  createTracker({ localStorage });

  const stored = JSON.parse(localStorage.getItem(storageKey));
  assert.equal(stored.schemaVersion, 1);
  assert.equal(stored.records.length, 1);
  assert.equal(stored.records[0].id, 'record-1');
  assert.equal(stored.records[0].recordTimestamp, '2026-07-31T12:42:00.000Z');
  assert.equal(stored.records[0].unknownFutureField, 'preserve me');
  assert.equal(stored.insulinPlans.some((plan) => plan.id === 'plan-1'), true);
  const migratedPlan = stored.insulinPlans.find((plan) => plan.id === 'plan-1');
  assert.deepEqual(migratedPlan.mealBaseUnitsByType, { Breakfast: 5, Lunch: 6, Dinner: 6 });
  assert.equal(migratedPlan.mealBaseUnits, 5);
  assert.equal(migratedPlan.bedtimeBaseUnits, 15);
  assert.ok(localStorage.getItem(legacyRecordsKey));
  assert.ok(localStorage.getItem(legacyPlansKey));
});

test('legacy shared meal base dose is replaced by current prescribed per-meal and bedtime defaults', () => {
  const localStorage = createLocalStorage({
    [storageKey]: JSON.stringify({
      schemaVersion: 1,
      records: [],
      settings: { targetRange: 'custom' },
      insulinPlans: [{
        id: 'legacy-shared-dose-plan',
        name: 'Legacy Shared Dose Plan',
        effectiveFrom: '2026-07-31',
        mealBaseUnits: 4,
        supportedMealTypes: ['Breakfast', 'Lunch', 'Dinner'],
        correctionRanges: [{ minGlucose: 175, maxGlucose: 249, correctionUnits: 1 }],
        notes: 'keep this',
      }],
      activeInsulinPlanId: 'legacy-shared-dose-plan',
      metadata: {
        createdAt: '2026-07-31T12:15:00.000Z',
        updatedAt: '2026-07-31T12:15:00.000Z',
      },
    }),
  });

  createTracker({ localStorage });

  const stored = JSON.parse(localStorage.getItem(storageKey));
  const plan = stored.insulinPlans[0];
  assert.deepEqual(plan.mealBaseUnitsByType, { Breakfast: 5, Lunch: 6, Dinner: 6 });
  assert.equal(plan.mealBaseUnits, 5);
  assert.equal(plan.bedtimeBaseUnits, 15);
  assert.equal(plan.notes, 'keep this');
  assert.equal(stored.settings.targetRange, 'custom');
});

test('bedtime base dose migration preserves unrelated settings and custom values', () => {
  const localStorage = createLocalStorage({
    [storageKey]: JSON.stringify({
      schemaVersion: 1,
      records: [sampleRecord({
        id: 'bedtime-history',
        type: 'Bedtime',
        administeredInsulinUnits: 14,
        insulinUnits: 14,
        suggestedTotalUnits: 15,
        suggestedBaseUnits: 15,
        suggestedCorrectionUnits: null,
        doseCalculationStatus: 'calculated',
      })],
      settings: { targetRange: 'custom', historyInitialWindowDays: '14' },
      insulinPlans: [{
        id: 'custom-bedtime-plan',
        name: 'Custom Bedtime Plan',
        effectiveFrom: '2026-07-31',
        mealBaseUnitsByType: { Breakfast: 5, Lunch: 6, Dinner: 6 },
        bedtimeBaseUnits: 13,
        supportedMealTypes: ['Breakfast', 'Lunch', 'Dinner'],
        correctionRanges: [{ minGlucose: 175, maxGlucose: 249, correctionUnits: 1 }],
      }],
      activeInsulinPlanId: 'custom-bedtime-plan',
      metadata: {
        createdAt: '2026-07-31T12:15:00.000Z',
        updatedAt: '2026-07-31T12:15:00.000Z',
      },
    }),
  });

  createTracker({ localStorage });

  const stored = JSON.parse(localStorage.getItem(storageKey));
  assert.equal(stored.insulinPlans[0].bedtimeBaseUnits, 13);
  assert.equal(stored.settings.targetRange, 'custom');
  assert.equal(stored.settings.historyInitialWindowDays, '14');
  assert.equal(stored.records[0].administeredInsulinUnits, 14);
  assert.equal(stored.records[0].suggestedTotalUnits, 15);
});

test('stored current correction table is extended with the open-ended 550 plus range', () => {
  const localStorage = createLocalStorage({
    [storageKey]: JSON.stringify({
      schemaVersion: 1,
      records: [],
      settings: {},
      insulinPlans: [{
        id: 'current-plan-before-550-plus',
        name: 'Current Plan Before 550 Plus',
        effectiveFrom: '2026-07-31',
        mealBaseUnitsByType: { Breakfast: 5, Lunch: 6, Dinner: 6 },
        supportedMealTypes: ['Breakfast', 'Lunch', 'Dinner'],
        correctionRanges: [
          { minGlucose: null, maxGlucose: 174, correctionUnits: 0 },
          { minGlucose: 175, maxGlucose: 249, correctionUnits: 1 },
          { minGlucose: 250, maxGlucose: 324, correctionUnits: 2 },
          { minGlucose: 325, maxGlucose: 399, correctionUnits: 3 },
          { minGlucose: 400, maxGlucose: 474, correctionUnits: 4 },
          { minGlucose: 475, maxGlucose: 549, correctionUnits: 5 },
        ],
      }],
      metadata: {
        createdAt: '2026-07-31T12:15:00.000Z',
        updatedAt: '2026-07-31T12:15:00.000Z',
      },
    }),
  });

  createTracker({ localStorage });

  const stored = JSON.parse(localStorage.getItem(storageKey));
  const plan = stored.insulinPlans[0];
  assert.deepEqual(plan.correctionRanges.at(-2), { minGlucose: 475, maxGlucose: 549, correctionUnits: 5 });
  assert.deepEqual(plan.correctionRanges.at(-1), { minGlucose: 550, maxGlucose: null, correctionUnits: 6 });
});

test('separate glucose and insulin event records normalize into the combined check workflow', () => {
  const localStorage = createLocalStorage({
    [storageKey]: JSON.stringify({
      schemaVersion: 1,
      records: [
        sampleRecord({ id: 'glucose-only', eventType: 'blood-glucose', type: 'Bedtime', bloodSugar: 145, insulinUnits: null }),
        sampleRecord({ id: 'insulin-entry', eventType: 'insulin', type: 'Lunch', bloodSugar: 198, insulinUnits: 7 }),
      ],
      settings: {},
      insulinPlans: [],
      metadata: {
        createdAt: '2026-07-31T12:15:00.000Z',
        updatedAt: '2026-07-31T12:15:00.000Z',
      },
    }),
  });

  createTracker({ localStorage });

  const stored = JSON.parse(localStorage.getItem(storageKey));
  const glucose = stored.records.find((record) => record.id === 'glucose-only');
  const insulin = stored.records.find((record) => record.id === 'insulin-entry');
  assert.equal(glucose.eventType, 'check-insulin');
  assert.equal(glucose.type, 'Bedtime');
  assert.equal(glucose.bloodSugar, 145);
  assert.equal(glucose.administeredInsulinUnits, null);
  assert.equal(insulin.eventType, 'check-insulin');
  assert.equal(insulin.type, 'Lunch');
  assert.equal(insulin.bloodSugar, 198);
  assert.equal(insulin.administeredInsulinUnits, 7);
});

test('hydration preserves an existing stable document instead of overwriting with empty defaults', () => {
  const documentPayload = {
    schemaVersion: 1,
    records: [sampleRecord({ recordTimestamp: '2026-07-31T12:15:00.000Z' })],
    settings: { targetRange: 'custom' },
    insulinPlans: [],
    activeInsulinPlanId: null,
    metadata: {
      createdAt: '2026-07-31T12:15:00.000Z',
      updatedAt: '2026-07-31T12:15:00.000Z',
    },
  };
  const localStorage = createLocalStorage({
    [storageKey]: JSON.stringify(documentPayload),
  });

  createTracker({ localStorage });
  createTracker({ localStorage });

  const stored = JSON.parse(localStorage.getItem(storageKey));
  assert.equal(stored.records.length, 1);
  assert.equal(stored.records[0].bloodSugar, 198);
  assert.equal(stored.settings.targetRange, 'custom');
});

test('transactional updates begin from the latest stored document and keep rapid records', () => {
  const { storage, localStorage } = createTracker();
  const first = sampleRecord({ id: 'rapid-1', recordTimestamp: '2026-07-31T13:00:00.000Z' });
  const second = sampleRecord({ id: 'rapid-2', recordTimestamp: '2026-07-31T13:05:00.000Z' });

  storage.updateTrackerData((current) => ({ ...current, records: [...current.records, first] }));
  storage.updateTrackerData((current) => ({ ...current, records: [...current.records, second] }));

  const stored = JSON.parse(localStorage.getItem(storageKey));
  assert.equal(stored.records.length, 2);
  assert.deepEqual(stored.records.map((record) => record.id).sort(), ['rapid-1', 'rapid-2']);
});

test('backup validation normalizes records and deduplicates by record ID', () => {
  const { storage } = createTracker();
  const backup = {
    appIdentifier: 'lando-world:lee-lees-tracker',
    schemaVersion: 1,
    records: [
      sampleRecord({ id: 'dupe', bloodSugar: 180 }),
      sampleRecord({ id: 'dupe', bloodSugar: 181, updatedAt: '2026-07-31T13:30:00.000Z' }),
    ],
    settings: {},
    insulinPlans: [],
    metadata: {
      createdAt: '2026-07-31T12:15:00.000Z',
      updatedAt: '2026-07-31T12:15:00.000Z',
    },
  };

  const result = storage.validateBackupPayload(backup);
  assert.equal(result.error, undefined);
  assert.equal(result.data.records.length, 1);
  assert.equal(result.data.records[0].id, 'dupe');
  assert.equal(result.data.records[0].unknownFutureField, 'preserve me');
});

test('backup validation preserves meal and activity payload fields', () => {
  const { storage } = createTracker();
  const backup = {
    appIdentifier: 'lando-world:lee-lees-tracker',
    schemaVersion: 1,
    records: [
      sampleRecord({
        id: 'meal-1',
        eventType: 'meal',
        type: 'Lunch',
        bloodSugar: null,
        insulinUnits: null,
        mealCarbs: '62',
        mealDescription: 'Turkey sandwich, chips, apple',
        notes: 'Practice carb counting',
      }),
      sampleRecord({
        id: 'activity-1',
        eventType: 'activity',
        type: 'Exercise',
        bloodSugar: null,
        insulinUnits: null,
        activityDescription: 'Bike ride',
        activityDurationMinutes: '45',
        activityIntensity: 'Moderate',
      }),
    ],
    settings: {},
    insulinPlans: [],
    metadata: {
      createdAt: '2026-07-31T12:15:00.000Z',
      updatedAt: '2026-07-31T12:15:00.000Z',
    },
  };

  const result = storage.validateBackupPayload(backup);

  assert.equal(result.error, undefined);
  assert.equal(result.data.records.find((item) => item.id === 'meal-1').mealCarbs, 62);
  assert.equal(result.data.records.find((item) => item.id === 'meal-1').mealDescription, 'Turkey sandwich, chips, apple');
  assert.equal(result.data.records.find((item) => item.id === 'activity-1').activityDurationMinutes, 45);
  assert.equal(result.data.records.find((item) => item.id === 'activity-1').activityIntensity, 'Moderate');
});

test('failed stable-key writes keep the in-memory document available without clearing stored records', () => {
  const localStorage = createLocalStorage({
    [storageKey]: JSON.stringify({
      schemaVersion: 1,
      records: [sampleRecord()],
      settings: {},
      insulinPlans: [],
      metadata: {
        createdAt: '2026-07-31T12:15:00.000Z',
        updatedAt: '2026-07-31T12:15:00.000Z',
      },
    }),
  }, { failWritesFor: [storageKey] });
  const { storage } = createTracker({ localStorage });
  const result = storage.updateTrackerData((current) => ({
    ...current,
    records: [...current.records, sampleRecord({ id: 'unsaved-visible' })],
  }));

  assert.equal(result.ok, false);
  assert.equal(storage.createBackupDocument().records.some((record) => record.id === 'unsaved-visible'), true);
  assert.equal(JSON.parse(localStorage.getItem(storageKey)).records.length, 1);
});
