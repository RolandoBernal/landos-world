import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const trackerSource = readFileSync(new URL('../js/lee-lee-diabetes-tracker.js', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../css/lee-lee-diabetes.css', import.meta.url), 'utf8');

function createLocalStorage(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem: (key) => store.get(key) || null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
}

function createTrackerRuntime() {
  const context = {
    console,
    Date,
    Intl,
    JSON,
    Map,
    Math,
    Number,
    Object,
    Promise,
    RegExp,
    String,
    crypto: {
      randomUUID: () => `test-${Math.random().toString(36).slice(2)}`,
    },
    document: {
      addEventListener() {},
      getElementById: () => null,
    },
    localStorage: createLocalStorage(),
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
  return context;
}

function createTrackerReports() {
  return createTrackerRuntime().LeeLeeTrackerReports;
}

function record(overrides = {}) {
  return {
    id: `record-${Math.random()}`,
    type: 'Breakfast',
    bloodSugar: 180,
    insulinUnits: 5,
    administeredInsulinUnits: 5,
    suggestedTotalUnits: 7,
    suggestedBaseUnits: 4,
    suggestedCorrectionUnits: 3,
    recordTimestamp: '2026-08-01T07:42:00.000Z',
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
    notes: '',
    ...overrides,
  };
}

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

function compactHtml(text) {
  return text.replace(/\s+/g, ' ').trim();
}

test('history grouping uses recordTimestamp rather than createdAt and sorts days newest first', () => {
  const reports = createTrackerReports();
  const groups = reports.groupRecordsByLocalDate([
    record({ id: 'entered-later', recordTimestamp: '2026-08-01T07:42:00.000Z', createdAt: '2026-08-03T12:00:00.000Z' }),
    record({ id: 'newer-day', recordTimestamp: '2026-08-02T10:00:00.000Z', createdAt: '2026-08-02T10:00:00.000Z' }),
  ]);

  assert.deepEqual(Array.from(groups, (group) => group.dateKey), ['2026-08-02', '2026-08-01']);
  assert.equal(groups[1].records[0].id, 'entered-later');
});

test('records inside a history day are ordered chronologically by event time', () => {
  const reports = createTrackerReports();
  const groups = reports.groupRecordsByLocalDate([
    record({ id: 'lunch', type: 'Lunch', recordTimestamp: '2026-08-01T12:00:00.000Z' }),
    record({ id: 'breakfast', type: 'Breakfast', recordTimestamp: '2026-08-01T07:42:00.000Z' }),
    record({ id: 'bedtime', type: 'Bedtime', recordTimestamp: '2026-08-01T21:00:00.000Z' }),
  ]);

  assert.deepEqual(Array.from(groups[0].records, (item) => item.id), ['breakfast', 'lunch', 'bedtime']);
});

test('daily summary uses valid glucose and actual administered insulin only', () => {
  const reports = createTrackerReports();
  const summary = reports.calculateDailySummary([
    record({ id: 'a', bloodSugar: 198, administeredInsulinUnits: 5, suggestedTotalUnits: 7 }),
    record({ id: 'b', bloodSugar: 102, administeredInsulinUnits: null, insulinUnits: null, suggestedTotalUnits: 4 }),
    record({ id: 'c', bloodSugar: null, administeredInsulinUnits: 2, suggestedTotalUnits: 8 }),
  ]);

  assert.equal(summary.entryCount, 3);
  assert.equal(summary.averageBloodSugar, 150);
  assert.equal(summary.highestBloodSugar, 198);
  assert.equal(summary.lowestBloodSugar, 102);
  assert.equal(summary.totalInsulin, 7);
});

test('legacy insulinUnits displays as actual insulin and missing insulin does not crash', () => {
  const reports = createTrackerReports();
  const summary = reports.calculateDailySummary([
    { id: 'legacy', type: 'Correction', bloodSugar: 210, insulinUnits: 3, date: '2026-08-01', time: '13:30' },
    { id: 'missing', type: 'Snack', bloodSugar: 120, date: '2026-08-01', time: '15:30' },
  ]);

  assert.equal(reports.getRecordActualInsulin({ insulinUnits: 3 }), 3);
  assert.equal(summary.totalInsulin, 3);
});

test('date and entry-type filters return the correct records across month boundaries', () => {
  const reports = createTrackerReports();
  const source = [
    record({ id: 'jul31-breakfast', type: 'Breakfast', recordTimestamp: '2026-07-31T07:42:00.000Z' }),
    record({ id: 'aug01-lunch', type: 'Lunch', recordTimestamp: '2026-08-01T12:00:00.000Z' }),
    record({ id: 'aug02-breakfast', type: 'Breakfast', recordTimestamp: '2026-08-02T08:00:00.000Z' }),
  ];
  const ranged = reports.filterRecordsByDateRange(source, {
    range: 'custom',
    startDate: '2026-07-31',
    endDate: '2026-08-01',
  });
  const typed = reports.filterRecordsByEntryType(ranged, 'Breakfast');

  assert.deepEqual(ranged.map((item) => item.id).sort(), ['aug01-lunch', 'jul31-breakfast']);
  assert.deepEqual(typed.map((item) => item.id), ['jul31-breakfast']);
});

test('clinical log keeps earliest primary record and includes additional checks', () => {
  const reports = createTrackerReports();
  const log = reports.buildClinicalLog([
    record({ id: 'breakfast-1', type: 'Breakfast', recordTimestamp: '2026-08-01T07:42:00.000Z' }),
    record({ id: 'breakfast-2', type: 'Breakfast', recordTimestamp: '2026-08-01T08:15:00.000Z' }),
    record({ id: 'snack', type: 'Snack', recordTimestamp: '2026-08-01T10:30:00.000Z' }),
  ]);

  assert.equal(log[0].primary.Breakfast.id, 'breakfast-1');
  assert.deepEqual(Array.from(log[0].additionalRecords, (item) => item.id), ['breakfast-2', 'snack']);
});

test('detailed report includes every selected record', () => {
  const reports = createTrackerReports();
  const detailed = reports.buildDetailedReport([
    record({ id: 'a', recordTimestamp: '2026-08-01T07:42:00.000Z' }),
    record({ id: 'b', type: 'Snack', recordTimestamp: '2026-08-01T10:30:00.000Z' }),
    record({ id: 'c', type: 'Dinner', recordTimestamp: '2026-08-02T18:30:00.000Z' }),
  ]);

  assert.equal(detailed.reduce((count, group) => count + group.records.length, 0), 3);
});

test('older records reconstruct event time from date and time fields', () => {
  const reports = createTrackerReports();
  const legacy = { id: 'legacy', type: 'Breakfast', date: '2026-08-01', time: '07:42', bloodSugar: 198, insulinUnits: 5 };
  assert.equal(reports.getRecordEventDateKey(legacy), '2026-08-01');
  assert.match(reports.formatTime(reports.getRecordTimestamp(legacy)), /7:42/);
});

test('print styles hide controls and use a white printable report', () => {
  assert.match(cssSource, /@media print/);
  assert.match(cssSource, /\.lee_lee_diabetes_nav,[\s\S]*display: none !important/);
  assert.match(cssSource, /\.lee_lee_diabetes_top,[\s\S]*display: none !important/);
  assert.match(cssSource, /\.pwa_network_status,[\s\S]*display: none !important/);
  assert.match(cssSource, /\.pwa_toast,[\s\S]*display: none !important/);
  assert.match(cssSource, /background: #ffffff !important/);
});

test('export print action uses the browser print dialog', () => {
  assert.match(trackerSource, /window\.print\(\)/);
});

test('printable clinical report uses report title and leaves missing values blank', () => {
  const reports = createTrackerReports();
  const html = reports.renderReportDocument('clinical', [
    record({ id: 'breakfast', type: 'Breakfast', bloodSugar: 124, administeredInsulinUnits: 4, notes: '' }),
    record({
      id: 'dinner-zero',
      type: 'Dinner',
      bloodSugar: 100,
      administeredInsulinUnits: 0,
      insulinUnits: null,
      notes: '',
      recordTimestamp: '2026-08-01T18:00:00.000Z',
    }),
    record({
      id: 'lunch',
      type: 'Lunch',
      bloodSugar: null,
      administeredInsulinUnits: null,
      insulinUnits: null,
      notes: '',
      recordTimestamp: '2026-08-01T12:00:00.000Z',
    }),
  ], 'Aug 1, 2026');
  const compact = compactHtml(html);

  assert.match(html, /Glucose &amp; Insulin Log/);
  assert.doesNotMatch(html, /<h2>Lee-Lee’s Tracker<\/h2>/);
  assert.doesNotMatch(html, /—/);
  assert.match(compact, /<td>124 mg\/dL<\/td> <td>4 units<\/td>/);
  assert.match(compact, /<th scope="col">Lunch BG<\/th> <th scope="col">Lunch Insulin<\/th>/);
  assert.match(compact, /<td><\/td> <td><\/td>/);
  assert.match(compact, /<td>100 mg\/dL<\/td> <td>0 units<\/td>/);
});

test('printable report header includes patient metadata from tracker settings', () => {
  const runtime = createTrackerRuntime();
  runtime.LeeLeeTrackerStorage.updateTrackerData((current) => ({
    ...current,
    settings: {
      ...(current.settings || {}),
      patientName: 'Levi Bernal',
      patientBirthDate: '2014-06-13',
      clinicName: "Vandy's Children's Hospital",
    },
  }));
  const html = runtime.LeeLeeTrackerReports.renderReportDocument('clinical', [
    record({ id: 'breakfast', type: 'Breakfast', bloodSugar: 124, administeredInsulinUnits: 4, notes: '' }),
  ], 'Aug 7, 2026 through Aug 13, 2026');
  const compact = compactHtml(html);

  assert.match(html, /Glucose &amp; Insulin Log/);
  assert.match(compact, /<dt>Patient<\/dt> <dd>Levi Bernal<\/dd>/);
  assert.match(compact, /<dt>Date of birth<\/dt> <dd>Jun 13, 2014<\/dd>/);
  assert.match(compact, /<dt>Clinic<\/dt> <dd>Vandy&#39;s Children&#39;s Hospital<\/dd>/);
  assert.match(compact, /<dt>Report range<\/dt> <dd>Aug 7, 2026 through Aug 13, 2026<\/dd>/);
  assert.match(compact, /<dt>Generated<\/dt> <dd>.+<\/dd>/);
  const orderedLabels = [...html.matchAll(/<dt>(.*?)<\/dt>/g)].map((match) => match[1]);
  assert.deepEqual(orderedLabels, ['Patient', 'Date of birth', 'Clinic', 'Report range', 'Generated']);
  assert.doesNotMatch(html, /Clinic phone/);
  assert.doesNotMatch(html, /<h2>Lee-Lee’s Tracker<\/h2>/);
  assert.doesNotMatch(html, /Lando.s World/);
  assert.doesNotMatch(html, /Online|Offline/);
});

test('printable report header keeps all metadata labels when patient settings are blank', () => {
  const reports = createTrackerReports();
  const html = reports.renderReportDocument('clinical', [
    record({ id: 'breakfast', type: 'Breakfast', bloodSugar: 124, administeredInsulinUnits: 4, notes: '' }),
  ], 'Aug 7, 2026 through Aug 13, 2026');
  const orderedLabels = [...html.matchAll(/<dt>(.*?)<\/dt>/g)].map((match) => match[1]);
  const compact = compactHtml(html);

  assert.deepEqual(orderedLabels, ['Patient', 'Date of birth', 'Clinic', 'Report range', 'Generated']);
  assert.match(compact, /<dt>Patient<\/dt> <dd><\/dd>/);
  assert.match(compact, /<dt>Date of birth<\/dt> <dd><\/dd>/);
  assert.match(compact, /<dt>Clinic<\/dt> <dd><\/dd>/);
  assert.match(compact, /<dt>Report range<\/dt> <dd>Aug 7, 2026 through Aug 13, 2026<\/dd>/);
  assert.match(compact, /<dt>Generated<\/dt> <dd>.+<\/dd>/);
});

test('print styles remove app shell navigation and status chrome', () => {
  assert.match(cssSource, /\.ecosystem_nav,[\s\S]*display: none !important/);
  assert.match(cssSource, /\.ecosystem_nav_back,[\s\S]*display: none !important/);
  assert.match(cssSource, /\.lando_settings_link,[\s\S]*display: none !important/);
  assert.match(cssSource, /\.pwa_network_status,[\s\S]*display: none !important/);
});

test('history visible window returns the newest day groups first', () => {
  const reports = createTrackerReports();
  const groups = reports.groupRecordsByLocalDate(Array.from({ length: 45 }, (_, index) => record({
    id: `day-${index}`,
    recordTimestamp: new Date(Date.UTC(2026, 7, 1 + index, 12)).toISOString(),
  })));
  const visible = reports.getVisibleHistoryGroups(groups, 30);

  assert.equal(visible.length, 30);
  assert.equal(visible[0].dateKey, '2026-09-14');
  assert.equal(visible[29].dateKey, '2026-08-16');
});

test('history visible summary and badge count reflect the displayed history', () => {
  const reports = createTrackerReports();
  const groups = [
    { dateKey: '2026-08-03', records: [record({ id: 'a' }), record({ id: 'b' })] },
    { dateKey: '2026-08-02', records: [record({ id: 'c' })] },
  ];

  assert.equal(reports.getHistoryVisibleSummary(groups), '2 Days • 3 Entries');
  assert.equal(reports.getHistoryVisibleSummary([{ dateKey: '2026-08-03', records: [record({ id: 'single' })] }]), '1 Day • 1 Entry');
  assert.equal(reports.getHistoryVisibleSummary([]), '0 Days • 0 Entries');
  assert.equal(reports.getHistoryFilterCount({ range: 'all', type: 'All' }), 0);
  assert.equal(reports.getHistoryFilterCount({ range: 'last30', type: 'Breakfast' }), 2);
});

test('daily summaries are memoized for identical record groups', () => {
  const reports = createTrackerReports();
  const source = [
    record({ id: 'memo-a', bloodSugar: 100, updatedAt: '2026-08-01T12:00:00.000Z' }),
    record({ id: 'memo-b', bloodSugar: 200, updatedAt: '2026-08-01T12:05:00.000Z' }),
  ];
  const first = reports.calculateDailySummary(source);
  const cacheAfterFirst = reports.getDailySummaryCacheSize();
  const second = reports.calculateDailySummary([...source].reverse());

  assert.equal(first, second);
  assert.equal(reports.getDailySummaryCacheSize(), cacheAfterFirst);
});

test('report registry describes current reports independently from export rendering', () => {
  const reports = createTrackerReports();
  const ids = Array.from(reports.reportRegistry, (report) => report.id);

  assert.deepEqual(ids, ['clinical', 'detailed']);
  assert.equal(reports.reportRegistry[0].printLayout, 'landscape');
  assert.equal(reports.buildClinicalReport([record({ id: 'clinical-source' })]).id, 'clinical');
  assert.equal(reports.buildDetailedReportData([record({ id: 'detailed-source' })]).id, 'detailed');
});

test('entry type configuration preserves canonical labels and meal guidance boundaries', () => {
  const runtime = createTrackerRuntime();
  const entryTypes = runtime.LeeLeeTrackerEntryTypes;
  const labels = Array.from(entryTypes.all, (definition) => definition.label);

  assert.deepEqual(labels, ['Breakfast', 'Lunch', 'Dinner', 'Bedtime', '2 AM', 'Correction', 'Snack', 'Exercise', 'Other']);
  assert.deepEqual(Array.from(entryTypes.mealTypes), ['Breakfast', 'Lunch', 'Dinner']);
  assert.equal(entryTypes.getEntryTypeConfig('Bedtime').label, 'Bedtime');
  assert.equal(entryTypes.entryTypeUsesMealGuidance('Breakfast'), true);
  assert.equal(entryTypes.entryTypeUsesMealGuidance('Lunch'), true);
  assert.equal(entryTypes.entryTypeUsesMealGuidance('Dinner'), true);
  assert.equal(entryTypes.entryTypeUsesMealGuidance('Correction'), false);
  assert.equal(entryTypes.getEntryTypeConfig('Night').type, 'Other');
});

test('add event configuration exposes one combined check workflow with full check contexts', () => {
  const runtime = createTrackerRuntime();
  const entryTypes = runtime.LeeLeeTrackerEntryTypes;
  const eventLabels = Array.from(entryTypes.eventTypes, (definition) => definition.label);

  assert.deepEqual(eventLabels, ['Check / Insulin', 'Meal / Carbs', 'Activity / Exercise', 'Note']);
  assert.deepEqual(Array.from(entryTypes.getContextOptionsForEventType('check-insulin')), [
    'Breakfast',
    'Lunch',
    'Dinner',
    'Bedtime',
    '2 AM',
    'Correction',
    'Snack',
    'Other',
  ]);
  assert.deepEqual(Array.from(entryTypes.getContextOptionsForEventType('meal')), ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Other']);
  assert.equal(entryTypes.getEventTypeConfig('check-insulin').fields.includes('bloodSugar'), true);
  assert.equal(entryTypes.getEventTypeConfig('check-insulin').fields.includes('insulinUnits'), true);
  assert.doesNotMatch(trackerSource, /label: 'Blood Glucose'/);
  assert.doesNotMatch(trackerSource, /label: 'Insulin'/);
});

test('meal dose helper keeps the clinician-provided calculation unchanged', () => {
  const runtime = createTrackerRuntime();
  const insulinPlan = {
    id: 'plan',
    supportedMealTypes: ['Breakfast', 'Lunch', 'Dinner'],
    mealBaseUnitsByType: { Breakfast: 5, Lunch: 6, Dinner: 6 },
    correctionRanges: [
      { minGlucose: null, maxGlucose: 174, correctionUnits: 0 },
      { minGlucose: 175, maxGlucose: 249, correctionUnits: 1 },
      { minGlucose: 250, maxGlucose: 324, correctionUnits: 2 },
    ],
  };
  const breakfast = runtime.LeeLeeTrackerDoseHelper.calculateMealInsulinDose({
    bloodSugar: 198,
    entryType: 'Breakfast',
    recordTimestamp: Date.parse('2026-08-01T07:42:00.000Z'),
    insulinPlan,
  });
  const lunch = runtime.LeeLeeTrackerDoseHelper.calculateMealInsulinDose({
    bloodSugar: 198,
    entryType: 'Lunch',
    recordTimestamp: Date.parse('2026-08-01T12:42:00.000Z'),
    insulinPlan,
  });
  const dinner = runtime.LeeLeeTrackerDoseHelper.calculateMealInsulinDose({
    bloodSugar: 198,
    entryType: 'Dinner',
    recordTimestamp: Date.parse('2026-08-01T18:42:00.000Z'),
    insulinPlan,
  });
  const correction = runtime.LeeLeeTrackerDoseHelper.calculateMealInsulinDose({
    bloodSugar: 198,
    entryType: 'Correction',
    recordTimestamp: Date.parse('2026-08-01T13:30:00.000Z'),
    insulinPlan: {
      id: 'plan',
      supportedMealTypes: ['Breakfast', 'Lunch', 'Dinner'],
      mealBaseUnitsByType: { Breakfast: 5, Lunch: 6, Dinner: 6 },
      correctionRanges: [{ minGlucose: 175, maxGlucose: 249, correctionUnits: 1 }],
    },
  });

  assert.equal(breakfast.status, 'calculated');
  assert.equal(breakfast.baseUnits, 5);
  assert.equal(breakfast.correctionUnits, 1);
  assert.equal(breakfast.suggestedTotalUnits, 6);
  assert.equal(lunch.baseUnits, 6);
  assert.equal(lunch.correctionUnits, 1);
  assert.equal(lunch.suggestedTotalUnits, 7);
  assert.equal(dinner.baseUnits, 6);
  assert.equal(dinner.correctionUnits, 1);
  assert.equal(dinner.suggestedTotalUnits, 7);
  assert.equal(correction.status, 'unsupported-entry-type');
  assert.equal(correction.suggestedTotalUnits, null);
});

test('meal dose helper uses the open-ended 550 plus correction band', () => {
  const runtime = createTrackerRuntime();
  const insulinPlan = {
    id: 'plan',
    supportedMealTypes: ['Breakfast', 'Lunch', 'Dinner'],
    mealBaseUnitsByType: { Breakfast: 5, Lunch: 6, Dinner: 6 },
    correctionRanges: [
      { minGlucose: null, maxGlucose: 174, correctionUnits: 0 },
      { minGlucose: 175, maxGlucose: 249, correctionUnits: 1 },
      { minGlucose: 250, maxGlucose: 324, correctionUnits: 2 },
      { minGlucose: 325, maxGlucose: 399, correctionUnits: 3 },
      { minGlucose: 400, maxGlucose: 474, correctionUnits: 4 },
      { minGlucose: 475, maxGlucose: 549, correctionUnits: 5 },
      { minGlucose: 550, maxGlucose: null, correctionUnits: 6 },
    ],
  };
  const timestamp = Date.parse('2026-08-01T12:00:00.000Z');
  const breakfast549 = runtime.LeeLeeTrackerDoseHelper.calculateMealInsulinDose({
    bloodSugar: 549,
    entryType: 'Breakfast',
    recordTimestamp: timestamp,
    insulinPlan,
  });
  const breakfast550 = runtime.LeeLeeTrackerDoseHelper.calculateMealInsulinDose({
    bloodSugar: 550,
    entryType: 'Breakfast',
    recordTimestamp: timestamp,
    insulinPlan,
  });
  const lunch551 = runtime.LeeLeeTrackerDoseHelper.calculateMealInsulinDose({
    bloodSugar: 551,
    entryType: 'Lunch',
    recordTimestamp: timestamp,
    insulinPlan,
  });
  const dinner700 = runtime.LeeLeeTrackerDoseHelper.calculateMealInsulinDose({
    bloodSugar: 700,
    entryType: 'Dinner',
    recordTimestamp: timestamp,
    insulinPlan,
  });

  assert.equal(breakfast549.status, 'calculated');
  assert.equal(breakfast549.correctionUnits, 5);
  assert.equal(breakfast549.suggestedTotalUnits, 10);
  assert.equal(breakfast549.matchedRange.minGlucose, 475);
  assert.equal(breakfast549.matchedRange.maxGlucose, 549);
  assert.equal(breakfast550.status, 'calculated');
  assert.equal(breakfast550.correctionUnits, 6);
  assert.equal(breakfast550.suggestedTotalUnits, 11);
  assert.equal(breakfast550.matchedRange.minGlucose, 550);
  assert.equal(breakfast550.matchedRange.maxGlucose, null);
  assert.equal(lunch551.correctionUnits, 6);
  assert.equal(lunch551.suggestedTotalUnits, 12);
  assert.equal(dinner700.correctionUnits, 6);
  assert.equal(dinner700.suggestedTotalUnits, 12);
});

test('carb entries do not change clinician-provided insulin guidance', () => {
  const runtime = createTrackerRuntime();
  const plan = {
    id: 'plan',
    supportedMealTypes: ['Breakfast', 'Lunch', 'Dinner'],
    mealBaseUnitsByType: { Breakfast: 5, Lunch: 6, Dinner: 6 },
    correctionRanges: [
      { minGlucose: null, maxGlucose: 174, correctionUnits: 0 },
      { minGlucose: 175, maxGlucose: 249, correctionUnits: 1 },
    ],
  };
  const lowCarbMeal = { eventType: 'meal', type: 'Lunch', mealCarbs: 20 };
  const highCarbMeal = { eventType: 'meal', type: 'Lunch', mealCarbs: 80 };
  const lowCarbResult = runtime.LeeLeeTrackerDoseHelper.calculateMealInsulinDose({
    bloodSugar: 198,
    entryType: lowCarbMeal.type,
    recordTimestamp: Date.parse('2026-08-01T12:00:00.000Z'),
    insulinPlan: plan,
  });
  const highCarbResult = runtime.LeeLeeTrackerDoseHelper.calculateMealInsulinDose({
    bloodSugar: 198,
    entryType: highCarbMeal.type,
    recordTimestamp: Date.parse('2026-08-01T12:00:00.000Z'),
    insulinPlan: plan,
  });

  assert.equal(lowCarbResult.baseUnits, 6);
  assert.equal(lowCarbResult.correctionUnits, 1);
  assert.equal(lowCarbResult.suggestedTotalUnits, 7);
  assert.deepEqual(highCarbResult, lowCarbResult);
  assert.doesNotMatch(trackerSource, /insulin-to-carb|carb bolus|carbs\s*\/|carbs\s*÷/i);
});

test('non-meal contexts do not receive meal base doses', () => {
  const runtime = createTrackerRuntime();
  const insulinPlan = {
    id: 'plan',
    supportedMealTypes: ['Breakfast', 'Lunch', 'Dinner'],
    mealBaseUnitsByType: { Breakfast: 5, Lunch: 6, Dinner: 6 },
    correctionRanges: [{ minGlucose: 175, maxGlucose: 249, correctionUnits: 1 }],
  };
  ['Bedtime', '2 AM', 'Correction', 'Snack', 'Other'].forEach((entryType) => {
    const result = runtime.LeeLeeTrackerDoseHelper.calculateMealInsulinDose({
      bloodSugar: 198,
      entryType,
      recordTimestamp: Date.parse('2026-08-01T21:00:00.000Z'),
      insulinPlan,
    });

    assert.equal(result.status, 'unsupported-entry-type');
    assert.equal(result.baseUnits, null);
    assert.equal(result.suggestedTotalUnits, null);
  });
});

test('settings UI exposes independent meal base dose controls', () => {
  assert.match(trackerSource, /\$\{escapeHtml\(type\)\} Base Dose/);
  assert.match(trackerSource, /name="\$\{escapeHtml\(type\.toLowerCase\(\)\)\}BaseUnits"/);
  assert.doesNotMatch(trackerSource, /name="mealBaseUnits" type="number"/);
});

test('settings correction table includes the editable open-ended 550 plus row', () => {
  assert.match(trackerSource, /minGlucose: 550,\s*maxGlucose: null,\s*correctionUnits: 6/);
  assert.match(trackerSource, /plan\.correctionRanges\.map\(renderRangeEditorRow\)/);
  assert.match(trackerSource, /DEFAULT_INSULIN_PLAN\.correctionRanges\.map\(\(_, index\) => normalizeCorrectionRange/);
});

test('meal and activity events render in today and reports with category fields', () => {
  const reports = createTrackerReports();
  const meal = record({
    id: 'meal',
    eventType: 'meal',
    type: 'Lunch',
    mealCarbs: 62,
    mealDescription: 'Turkey sandwich, chips, apple',
    bloodSugar: null,
    insulinUnits: null,
    administeredInsulinUnits: null,
    recordTimestamp: '2026-08-08T12:18:00.000Z',
  });
  const activity = record({
    id: 'activity',
    eventType: 'activity',
    type: 'Exercise',
    activityDescription: 'Bike ride',
    activityDurationMinutes: 45,
    activityIntensity: 'Moderate',
    bloodSugar: null,
    insulinUnits: null,
    administeredInsulinUnits: null,
    recordTimestamp: '2026-08-08T16:30:00.000Z',
  });

  assert.deepEqual(reports.getTodaysActivityRecords([meal, activity], '2026-08-08').map((item) => item.id), ['activity', 'meal']);
  assert.match(trackerSource, /Meal \/ Carbs/);
  assert.match(trackerSource, /name="mealCarbs"/);
  assert.match(trackerSource, /name="activityDurationMinutes"/);
  assert.match(trackerSource, /Carbs are recorded for tracking only/);
  assert.match(trackerSource, /<th scope="col">Carbs<\/th>/);
  assert.match(trackerSource, /<th scope="col">Activity<\/th>/);
});

test('canonical entry cards render check insulin dinner once in today and history', () => {
  const reports = createTrackerReports();
  const dinner = record({
    eventType: 'check-insulin',
    type: 'Dinner',
    bloodSugar: 269,
    administeredInsulinUnits: 8,
    insulinUnits: 8,
    suggestedTotalUnits: 8,
    suggestedBaseUnits: 6,
    suggestedCorrectionUnits: 2,
    doseCalculationStatus: 'calculated',
    recordTimestamp: '2026-08-08T17:13:00.000Z',
  });

  const content = reports.getEntryCardContent(dinner);
  assert.equal(content.title, 'Check / Insulin');
  assert.equal(content.primary, '269 mg/dL');
  assert.deepEqual(Array.from(content.secondary), [
    'Dinner',
    '8 units',
    'Given: 8 units · Suggested: 8 units · 6 units base + 2 units correction',
  ]);
  assert.equal(content.timestamp, Date.parse('2026-08-08T17:13:00.000Z'));

  const todayHtml = reports.renderTimelineItem(dinner);
  const historyHtml = reports.renderHistoryRecord(dinner);
  const canonicalHtml = reports.renderEntryCardContent(dinner).trim();

  assert.match(todayHtml, /lee_lee_diabetes_timeline_item--today/);
  assert.match(historyHtml, /lee_lee_diabetes_timeline_item--history/);
  assert.match(historyHtml, /data-action="edit-record"/);
  assert.match(historyHtml, /data-action="delete-record"/);
  assert.match(historyHtml, /lee_lee_diabetes_timeline_footer[\s\S]*lee_lee_diabetes_timeline_actions[\s\S]*data-action="edit-record"[\s\S]*data-action="delete-record"/);
  assert.match(historyHtml, /lee_lee_diabetes_timeline_edit lee_lee_diabetes_timeline_edit--danger" data-action="delete-record"/);
  assert.doesNotMatch(historyHtml, /lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="edit-record"|lee_lee_diabetes_button lee_lee_diabetes_button--danger" data-action="delete-record"/);
  assert.ok(todayHtml.includes(canonicalHtml));
  assert.ok(historyHtml.includes(canonicalHtml));

  for (const html of [todayHtml, historyHtml]) {
    assert.equal(countOccurrences(html, '269 mg/dL'), 1);
    assert.equal(countOccurrences(html, '<div class="lee_lee_diabetes_timeline_notes">8 units</div>'), 1);
    assert.equal(countOccurrences(html, 'Given: 8 units · Suggested: 8 units · 6 units base + 2 units correction'), 1);
    assert.doesNotMatch(html, /<strong>Value:<\/strong>|<strong>Blood sugar:<\/strong>|<strong>Insulin given:<\/strong>|<strong>Suggested:<\/strong>/);
  }
});

test('canonical entry cards keep non-meal check insulin records free of meal guidance', () => {
  const reports = createTrackerReports();
  const bedtime = record({
    eventType: 'check-insulin',
    type: 'Bedtime',
    bloodSugar: 439,
    administeredInsulinUnits: 15,
    insulinUnits: 15,
    suggestedTotalUnits: null,
    suggestedBaseUnits: null,
    suggestedCorrectionUnits: null,
    doseCalculationStatus: 'manual',
    recordTimestamp: '2026-08-08T21:36:00.000Z',
  });

  const content = reports.getEntryCardContent(bedtime);
  assert.equal(content.title, 'Check / Insulin');
  assert.equal(content.primary, '439 mg/dL');
  assert.deepEqual(Array.from(content.secondary), ['Bedtime', '15 units']);
  assert.equal(content.timestamp, Date.parse('2026-08-08T21:36:00.000Z'));

  const historyHtml = reports.renderHistoryRecord(bedtime);
  assert.equal(countOccurrences(historyHtml, '439 mg/dL'), 1);
  assert.match(historyHtml, /Bedtime/);
  assert.match(historyHtml, /15 units/);
  assert.doesNotMatch(historyHtml, /base|correction|Suggested/);
});

test('canonical entry cards keep meal activity note and legacy records clean', () => {
  const reports = createTrackerReports();
  const meal = record({
    eventType: 'meal',
    type: 'Lunch',
    mealCarbs: 62,
    mealDescription: 'Turkey sandwich, chips, apple',
    bloodSugar: null,
    insulinUnits: null,
    administeredInsulinUnits: null,
    recordTimestamp: '2026-08-08T12:18:00.000Z',
  });
  const activity = record({
    eventType: 'activity',
    type: 'Exercise',
    activityDescription: 'Bike ride',
    activityDurationMinutes: 45,
    activityIntensity: 'Moderate',
    bloodSugar: null,
    insulinUnits: null,
    administeredInsulinUnits: null,
    recordTimestamp: '2026-08-08T16:30:00.000Z',
  });
  const note = record({
    eventType: 'note',
    type: 'Other',
    notes: 'Felt steady before bed.',
    bloodSugar: null,
    insulinUnits: null,
    administeredInsulinUnits: null,
  });
  const legacy = record({
    eventType: 'check-insulin',
    type: 'Correction',
    bloodSugar: 210,
    administeredInsulinUnits: null,
    insulinUnits: 3,
    suggestedTotalUnits: null,
    suggestedBaseUnits: null,
    suggestedCorrectionUnits: null,
  });

  assert.deepEqual(Array.from(reports.getEntryCardContent(meal).secondary), ['Lunch', 'Turkey sandwich, chips, apple']);
  assert.deepEqual(Array.from(reports.getEntryCardContent(activity).secondary), ['45 min · Moderate']);
  assert.deepEqual(Array.from(reports.getEntryCardContent(note).secondary), ['Felt steady before bed.']);
  assert.deepEqual(Array.from(reports.getEntryCardContent(legacy).secondary), ['Correction', '3 units']);

  for (const html of [meal, activity, note, legacy].map((item) => reports.renderHistoryRecord(item))) {
    assert.doesNotMatch(html, /<strong>Value:<\/strong>|<strong>Blood sugar:<\/strong>|<strong>Insulin given:<\/strong>/);
  }
});

test('today activity helper returns only current-day active records newest first', () => {
  const reports = createTrackerReports();
  const today = reports.getTodaysActivityRecords([
    record({ id: 'yesterday', recordTimestamp: '2026-08-07T23:50:00.000Z' }),
    record({ id: 'breakfast', type: 'Breakfast', recordTimestamp: '2026-08-08T07:42:00.000Z' }),
    record({ id: 'lunch', type: 'Lunch', recordTimestamp: '2026-08-08T12:18:00.000Z' }),
    record({ id: 'deleted', recordTimestamp: '2026-08-08T14:00:00.000Z', deletedAt: '2026-08-08T14:05:00.000Z' }),
  ], '2026-08-08');

  assert.deepEqual(today.map((item) => item.id), ['lunch', 'breakfast']);
});

test('today UI uses one log-entry CTA and responsive navigation contracts', () => {
  assert.match(trackerSource, /Today’s Activity/);
  assert.match(trackerSource, /data-action="log-entry"/);
  assert.doesNotMatch(trackerSource, /PRIMARY_TYPES\.map\(renderPrimaryCard\)/);
  assert.match(trackerSource, /data-action="toggle-tracker-nav"/);
  assert.match(trackerSource, /aria-expanded/);
  assert.match(cssSource, /\.lee_lee_diabetes_mobile_nav_button/);
  assert.match(cssSource, /max-width: 520px[\s\S]*\.lee_lee_diabetes_nav_shell\.is-open \.lee_lee_diabetes_nav/);
  assert.match(cssSource, /min-width: 680px[\s\S]*\.lee_lee_diabetes_cards/);
});

test('today activity edit action uses the shared edit pipeline', () => {
  assert.match(trackerSource, /function renderTrackerEntryCard\(record/);
  assert.match(trackerSource, /variant: 'today'/);
  assert.match(trackerSource, /variant: 'history'/);
  assert.match(trackerSource, /data-action="edit-today-record" data-id="\$\{escapeHtml\(record\.id\)\}">Edit/);
  assert.match(trackerSource, /openRecordEditor\(target\.dataset\.id, 'today'\)/);
  assert.match(trackerSource, /function openRecordEditor\(recordId, returnTo = 'history-day'\)/);
  assert.match(trackerSource, /returnTo,\s*returnDateKey,/);
  assert.match(trackerSource, /if \(currentEditor\?\.returnTo === 'history-day' && currentEditor\.returnDateKey\)/);
});

test('entry card footer actions stay compact and preserve delete confirmation', () => {
  assert.match(cssSource, /\.lee_lee_diabetes_timeline_footer[\s\S]*justify-content: space-between/);
  assert.match(cssSource, /\.lee_lee_diabetes_timeline_actions[\s\S]*inline-flex[\s\S]*flex-wrap: wrap/);
  assert.match(cssSource, /\.lee_lee_diabetes_timeline_edit[\s\S]*min-height: 36px/);
  assert.match(cssSource, /\.lee_lee_diabetes_timeline_edit--danger[\s\S]*#fca5a5/);
  assert.match(cssSource, /\.lee_lee_diabetes_timeline_edit:focus-visible/);
  assert.match(trackerSource, /if \(action === 'delete-record'\)[\s\S]*deleteRecord\(target\.dataset\.id\)/);
  assert.match(trackerSource, /function deleteRecord\(recordId\)[\s\S]*renderDeleteConfirmation\(record\)/);
  assert.match(trackerSource, /data-action="confirm-delete-record"/);
});

test('shared sync status copy explains healthy, syncing, and offline states', () => {
  const reports = createTrackerReports();
  const now = Date.parse('2026-08-04T12:00:00.000Z');

  assert.equal(reports.getFriendlySyncStatus({
    configured: true,
    signedIn: true,
    pendingCount: 0,
    conflictCount: 0,
    realtimeStatus: 'connected',
    lastSuccessfulSyncAt: '2026-08-04T11:59:40.000Z',
    state: 'synced',
  }, now).message, '✓ Synced just now');

  assert.equal(reports.getFriendlySyncStatus({
    configured: true,
    signedIn: true,
    pendingCount: 1,
    conflictCount: 0,
    realtimeStatus: 'connected',
    state: 'syncing',
  }, now).message, 'Syncing...');

  assert.equal(reports.getFriendlySyncStatus({
    configured: true,
    signedIn: true,
    pendingCount: 1,
    conflictCount: 0,
    realtimeStatus: 'connected',
    state: 'offline',
  }, now).message, 'Offline / Waiting to reconnect');
});

test('migration UX stores explicit shared sync metadata outside tracker records', () => {
  assert.match(trackerSource, /shared-sync-migration:v1/);
  assert.match(trackerSource, /migrationCompleted/);
  assert.match(trackerSource, /migrationCompletedAt/);
  assert.match(trackerSource, /migrationVersion/);
  assert.match(trackerSource, /recordsMigrated/);
  assert.match(trackerSource, /migrationId/);
  assert.match(trackerSource, /originalTotal/);
  assert.match(trackerSource, /pendingFingerprints/);
  assert.match(trackerSource, /completedFingerprints/);
  assert.match(trackerSource, /alreadyExistingFingerprints/);
  assert.match(trackerSource, /duplicateFingerprints/);
  assert.match(trackerSource, /lastErrorCategory/);
  assert.match(trackerSource, /Migration Diagnostics/);
  assert.match(trackerSource, /scheduleMigrationContinuation/);
});

test('migration session summary preserves original total and counts conflicts as processed', () => {
  const reports = createTrackerReports();
  const summary = reports.getMigrationSessionSummary({
    originalTotal: 14,
    uploadedFingerprints: Array.from({ length: 8 }, (_, index) => `uploaded-${index}`),
    alreadyExistingFingerprints: ['already-1'],
    duplicateFingerprints: ['duplicate-1'],
    conflictFingerprints: ['conflict-1', 'conflict-2'],
    failedFingerprints: [],
    pendingFingerprints: ['pending-1', 'pending-2'],
  });

  assert.equal(summary.total, 14);
  assert.equal(summary.processed, 12);
  assert.equal(summary.remaining, 2);
  assert.equal(summary.percent, 86);
});
