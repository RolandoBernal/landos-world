import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const trackerSource = readFileSync(new URL('../js/lee-lee-diabetes-tracker.js', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../css/lee-lee-diabetes.css', import.meta.url), 'utf8');
const starterFoods = JSON.parse(readFileSync(new URL('../data/llt-starter-foods.json', import.meta.url), 'utf8'));

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

test('starter food seed data is valid and matches runtime seed normalization', () => {
  const runtime = createTrackerRuntime();
  const helper = runtime.LeeLeeTrackerDoseHelper;
  const ids = new Set();

  assert.equal(starterFoods.length, 96);
  starterFoods.forEach((food) => {
    assert.equal(typeof food.id, 'string');
    assert.match(food.id, /^starter\d*-/);
    assert.ok(food.name);
    assert.ok(food.servingLabel);
    assert.equal(['reference', 'verified-label'].includes(food.sourceType), true);
    assert.ok(food.sourceName);
    assert.ok(food.sourceUrl);
    assert.equal(Number.isFinite(food.carbs), true);
    assert.ok(food.carbs >= 0);
    assert.equal(ids.has(food.id), false);
    ids.add(food.id);
  });

  const normalized = helper.getValidatedStarterFoods();
  assert.equal(normalized.length, starterFoods.length);
  assert.equal(normalized.every((food) => /^starter\d*-/.test(food.seedKey)), true);
  assert.equal(normalized.every((food) => /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(food.id)), true);
  assert.equal(normalized.every((food) => ['reference', 'verified-label'].includes(food.sourceType)), true);
  assert.equal(normalized.every((food) => typeof food.carbs === 'number'), true);
  assert.equal(normalized.some((food) => food.seedKey === 'starter2-bagel-quarter' && food.name === 'Bagel'), true);
  assert.equal(normalized.some((food) => food.seedKey === 'starter2-submarine-sandwich' && food.carbs === 45), true);
  assert.equal(normalized.some((food) => food.seedKey === 'starter3-pbj-sandwich' && food.carbs === 45), true);
  assert.equal(normalized.some((food) => food.seedKey === 'starter3-chocolate-milk-cup' && food.carbs === 26), true);
  assert.equal(normalized.some((food) => food.seedKey === 'starter3-natures-bakery-fig-bar-twin-pack' && food.sourceType === 'verified-label'), true);
});

test('starter food seeding is idempotent and preserves same-name user foods', () => {
  const runtime = createTrackerRuntime();
  const helper = runtime.LeeLeeTrackerDoseHelper;
  const userBanana = helper.normalizeFoodLibraryItem({
    id: 'family-banana',
    name: 'Banana',
    emoji: '🍌',
    carbs: 31,
    servingLabel: 'our usual banana',
    sourceType: 'verified-label',
    sourceName: 'Family label',
    createdAt: '2026-08-31T12:00:00.000Z',
    updatedAt: '2026-08-31T12:00:00.000Z',
  });
  const first = helper.seedStarterFoodsInDocument({ foodLibrary: [userBanana], metadata: {} });
  const second = helper.seedStarterFoodsInDocument(first.data);
  const bananas = second.data.foodLibrary.filter((food) => food.name === 'Banana');

  assert.equal(first.seededFoods.length, starterFoods.length);
  assert.equal(second.seededFoods.length, 0);
  assert.equal(second.data.foodLibrary.length, starterFoods.length + 1);
  assert.equal(bananas.length, 2);
  assert.equal(bananas.some((food) => food.id === 'family-banana' && food.carbs === 31), true);
  assert.equal(bananas.some((food) => food.seedKey === 'starter-banana-medium' && food.carbs === 27), true);
});

test('starter foods participate in search, recents, favorites, saved meals, and carb totals', () => {
  const runtime = createTrackerRuntime();
  const helper = runtime.LeeLeeTrackerDoseHelper;
  const foods = helper.seedStarterFoodsInDocument({ foodLibrary: [], metadata: {} }).data.foodLibrary;
  const pizza = helper.searchFoodItems(foods, 'pizza')[0];
  const favoritePizza = helper.normalizeFoodLibraryItem({ ...pizza, favorite: true });
  const recentPizza = helper.normalizeFoodLibraryItem({ ...pizza, lastUsedAt: '2026-08-31T12:00:00.000Z' });
  const rows = helper.mergeCarbCalculatorRows([], [{
    sourceType: 'food',
    foodId: pizza.id,
    name: pizza.name,
    emoji: pizza.emoji,
    servingLabel: pizza.servingLabel,
    sourceTypeSnapshot: pizza.sourceType,
    sourceNameSnapshot: pizza.sourceName,
    qty: '2',
    carbs: String(pizza.carbs),
  }]);
  const components = helper.buildMealComponentsFromCarbCalculatorRows(rows);

  assert.equal(pizza.seedKey, 'starter-thin-crust-pizza');
  assert.equal(helper.searchFoodItems([favoritePizza], 'CDC').length, 1);
  assert.equal(helper.getRecentFoodItems([recentPizza])[0].id, pizza.id);
  assert.equal(helper.calculateCarbCalculatorMealTotal(rows), 60);
  assert.equal(components[0].emojiSnapshot, '🍕');
  assert.equal(components[0].sourceTypeSnapshot, 'reference');
  assert.equal(components[0].sourceNameSnapshot, 'CDC Carb Choices');
  assert.equal(helper.calculateMealComponentTotal(components), 60);
});

test('food library keeps emoji optional and source labels backward-compatible', () => {
  const runtime = createTrackerRuntime();
  const helper = runtime.LeeLeeTrackerDoseHelper;
  const legacyFood = helper.normalizeFoodLibraryItem({
    id: 'legacy-food',
    name: 'Ketchup',
    carbs: 4,
    servingLabel: 'packet',
    createdAt: '2026-08-31T12:00:00.000Z',
    updatedAt: '2026-08-31T12:00:00.000Z',
  });
  const referenceFood = helper.normalizeFoodLibraryItem({
    id: 'starter-milk-cup',
    name: 'Milk',
    emoji: '🥛',
    carbs: 12,
    servingLabel: '1 cup',
    sourceType: 'reference',
    sourceName: 'CDC Carb Choices',
  });

  assert.equal(legacyFood.emoji, '');
  assert.equal(legacyFood.sourceType, '');
  assert.equal(helper.formatFoodSourceLabel(legacyFood), '');
  assert.equal(helper.formatFoodSourceLabel(referenceFood), 'Reference · CDC Carb Choices');
});

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

test('reports summary uses actual recorded insulin and missing values do not become zero', () => {
  const reports = createTrackerReports();
  const summary = reports.calculateReportSummary([
    record({
      id: 'breakfast',
      type: 'Breakfast',
      bloodSugar: 160,
      mealCarbs: 42,
      administeredInsulinUnits: 6,
      suggestedTotalUnits: 5.5,
      recordTimestamp: '2026-08-01T07:30:00.000Z',
    }),
    record({
      id: 'lunch-missing-carbs',
      type: 'Lunch',
      bloodSugar: 120,
      mealCarbs: null,
      administeredInsulinUnits: null,
      insulinUnits: null,
      suggestedTotalUnits: 4,
      recordTimestamp: '2026-08-01T12:00:00.000Z',
    }),
    record({
      id: 'bedtime',
      type: 'Bedtime',
      bloodSugar: null,
      administeredInsulinUnits: 17,
      suggestedTotalUnits: 13,
      recordTimestamp: '2026-08-02T21:00:00.000Z',
    }),
  ], { range: 'custom', startDate: '2026-08-01', endDate: '2026-08-02' });

  assert.equal(summary.dayCount, 2);
  assert.equal(summary.entryCount, 3);
  assert.equal(summary.glucose.count, 2);
  assert.equal(summary.glucose.average, 140);
  assert.equal(summary.insulin.total, 23);
  assert.equal(summary.insulin.fastActing.total, 6);
  assert.equal(summary.insulin.longActing.total, 17);
  assert.equal(summary.insulin.bedtimeLongActing.average, 17);
  assert.equal(summary.carbs.total, 42);
  assert.equal(summary.carbs.count, 1);
  assert.equal(summary.carbs.averagePerEntry, 42);
});

test('report day count uses inclusive calendar dates without elapsed-time math', () => {
  const reports = createTrackerReports();

  assert.equal(reports.getInclusiveCalendarDayCount('2026-08-28', '2026-09-02'), 6);
  assert.equal(reports.getInclusiveCalendarDayCount('2026-09-02', '2026-09-02'), 1);
  assert.equal(reports.getInclusiveCalendarDayCount('2026-08-27', '2026-09-02'), 7);
  assert.equal(reports.getInclusiveCalendarDayCount('2026-09-02', '2026-08-28'), null);
});

test('reports per-day metrics use the selected inclusive report period', () => {
  const reports = createTrackerReports();
  const bedtimeRecords = ['2026-08-28', '2026-08-29', '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02']
    .map((dateKey) => record({
      id: `bedtime-${dateKey}`,
      type: 'Bedtime',
      bloodSugar: null,
      mealCarbs: null,
      administeredInsulinUnits: 17,
      insulinType: 'long-acting',
      recordTimestamp: `${dateKey}T22:00:00.000Z`,
    }));
  const summary = reports.calculateReportSummary(bedtimeRecords, {
    range: 'custom',
    startDate: '2026-08-28',
    endDate: '2026-09-02',
  });

  assert.equal(summary.dayCount, 6);
  assert.equal(summary.entryCount, 6);
  assert.equal(summary.rates.entriesPerDay, 1);
  assert.equal(summary.rates.glucoseReadingsPerDay, 0);
  assert.equal(summary.rates.insulinAdministrationsPerDay, 1);
  assert.equal(summary.insulin.count, 6);
  assert.equal(summary.insulin.total, 102);
  assert.equal(summary.insulin.averagePerDay, 17);
  assert.equal(summary.insulin.longActing.total, 102);
  assert.equal(summary.insulin.bedtimeLongActing.average, 17);
  assert.equal(summary.insulin.bedtimeLongActing.count, 6);
  assert.equal(summary.insulin.fastActing.total, null);
  assert.equal(summary.carbs.averagePerDay, null);
  assert.equal(summary.glucose.count / summary.dayCount, 0);
});

test('single-day report per-day metrics use a one-day denominator', () => {
  const reports = createTrackerReports();
  const summary = reports.calculateReportSummary([
    record({
      id: 'single-day-bedtime',
      type: 'Bedtime',
      bloodSugar: null,
      mealCarbs: null,
      administeredInsulinUnits: 17,
      insulinType: 'long-acting',
      recordTimestamp: '2026-09-02T22:00:00.000Z',
    }),
  ], {
    range: 'custom',
    startDate: '2026-09-02',
    endDate: '2026-09-02',
  });

  assert.equal(summary.dayCount, 1);
  assert.equal(summary.insulin.bedtimeLongActing.average, 17);
  assert.equal(summary.insulin.averagePerDay, 17);
  assert.ok(Number.isFinite(summary.insulin.bedtimeLongActing.average));
});

test('bedtime long-acting average uses recorded bedtime administrations, not calendar days', () => {
  const reports = createTrackerReports();
  const longActingDays = ['2026-08-28', '2026-08-29', '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02'];
  const summary = reports.calculateReportSummary(longActingDays.map((dateKey) => record({
    id: `long-acting-${dateKey}`,
    type: 'Bedtime',
    bloodSugar: null,
    mealCarbs: null,
    administeredInsulinUnits: 17,
    insulinType: 'long-acting',
    recordTimestamp: `${dateKey}T22:00:00.000Z`,
  })), {
    range: 'custom',
    startDate: '2026-08-27',
    endDate: '2026-09-02',
  });

  assert.equal(summary.dayCount, 7);
  assert.equal(summary.insulin.longActing.total, 102);
  assert.equal(summary.insulin.bedtimeLongActing.count, 6);
  assert.equal(summary.insulin.bedtimeLongActing.average, 17);
  assert.equal(reports.formatInsulin(Number(summary.insulin.bedtimeLongActing.average.toFixed(1))), '17 units');
});

test('bedtime expected-dose completeness excludes today before bedtime and includes it after bedtime', () => {
  const reports = createTrackerReports();
  const records = ['2026-08-28', '2026-08-29', '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02']
    .map((dateKey) => record({
      id: `bedtime-${dateKey}`,
      type: 'Bedtime',
      bloodSugar: null,
      mealCarbs: null,
      administeredInsulinUnits: 17,
      recordTimestamp: `${dateKey}T22:00:00.000Z`,
    }));
  const filters = {
    range: 'custom',
    startDate: '2026-08-28',
    endDate: '2026-09-03',
  };
  const beforeBedtime = reports.calculateReportSummary(records, filters, {}, { now: new Date('2026-09-03T15:00:00') });
  const afterBedtime = reports.calculateReportSummary(records, filters, {}, { now: new Date('2026-09-03T22:00:00') });

  assert.equal(beforeBedtime.insulin.bedtimeLongActing.recordedExpectedCount, 6);
  assert.equal(beforeBedtime.insulin.bedtimeLongActing.expectedCount, 6);
  assert.equal(afterBedtime.insulin.bedtimeLongActing.recordedExpectedCount, 6);
  assert.equal(afterBedtime.insulin.bedtimeLongActing.expectedCount, 7);
});

test('reports insulin per-day metrics follow treatment insulin type rules by context', () => {
  const reports = createTrackerReports();
  const summary = reports.calculateReportSummary([
    record({
      id: 'lunch-long-acting',
      type: 'Lunch',
      bloodSugar: 120,
      mealCarbs: 30,
      administeredInsulinUnits: 17,
      insulinType: 'long-acting',
      recordTimestamp: '2026-09-01T12:00:00.000Z',
    }),
    record({
      id: 'bedtime-fast-acting',
      type: 'Bedtime',
      bloodSugar: 180,
      mealCarbs: null,
      administeredInsulinUnits: 3,
      insulinType: 'fast-acting',
      recordTimestamp: '2026-09-01T22:00:00.000Z',
    }),
    record({
      id: 'breakfast-snake-case-fast-acting',
      type: 'Breakfast',
      bloodSugar: 150,
      mealCarbs: 42,
      administeredInsulinUnits: 5,
      insulin_type: 'rapid_acting',
      recordTimestamp: '2026-09-02T08:00:00.000Z',
    }),
  ], {
    range: 'custom',
    startDate: '2026-09-01',
    endDate: '2026-09-02',
  });

  assert.equal(summary.dayCount, 2);
  assert.equal(summary.insulin.total, 25);
  assert.equal(summary.insulin.averagePerDay, 12.5);
  assert.equal(summary.insulin.longActing.total, 3);
  assert.equal(summary.insulin.bedtimeLongActing.average, 3);
  assert.equal(summary.insulin.fastActing.total, 22);
  assert.equal(summary.insulin.fastActingAveragePerDay, 11);
  assert.equal(summary.carbs.averagePerDay, 36);
  assert.equal(summary.rates.entriesPerDay, 1.5);
  assert.equal(summary.rates.glucoseReadingsPerDay, 1.5);
  assert.equal(summary.rates.insulinAdministrationsPerDay, 1.5);
});

test('reports target percentages require explicit min and max settings', () => {
  const reports = createTrackerReports();
  const source = [
    record({ id: 'low', bloodSugar: 70 }),
    record({ id: 'in', bloodSugar: 110 }),
    record({ id: 'high', bloodSugar: 190 }),
  ];

  assert.equal(reports.calculateReportSummary(source).glucose.targetRange, null);
  const summary = reports.calculateReportSummary(source, {}, { glucoseTargetMin: 80, glucoseTargetMax: 150 });
  assert.equal(summary.glucose.targetCounts.inRange, 1);
  assert.equal(summary.glucose.targetCounts.below, 1);
  assert.equal(summary.glucose.targetCounts.above, 1);
  assert.equal(Math.round(summary.glucose.inRangePercent), 33);
});

test('context averages use only present values for each metric', () => {
  const reports = createTrackerReports();
  const averages = reports.calculateContextAverages([
    record({ id: 'breakfast-a', type: 'Breakfast', bloodSugar: 100, mealCarbs: 30, administeredInsulinUnits: 4 }),
    record({ id: 'breakfast-b', type: 'Breakfast', bloodSugar: 200, mealCarbs: null, administeredInsulinUnits: 6 }),
    record({ id: 'correction', type: 'Correction', bloodSugar: 250, mealCarbs: null, administeredInsulinUnits: 2 }),
  ]);
  const breakfast = averages.find((item) => item.type === 'Breakfast');
  const correction = averages.find((item) => item.type === 'Correction');

  assert.equal(breakfast.recordCount, 2);
  assert.equal(breakfast.glucose.average, 150);
  assert.equal(breakfast.carbs.count, 1);
  assert.equal(breakfast.carbs.average, 30);
  assert.equal(breakfast.insulin.average, 5);
  assert.equal(correction.carbs.count, 0);
  assert.equal(correction.insulin.average, 2);
});

test('trend series include only recorded values and classify bedtime insulin as long acting', () => {
  const reports = createTrackerReports();
  const trends = reports.buildTrendSeries([
    record({ id: 'breakfast', type: 'Breakfast', bloodSugar: 140, mealCarbs: 35, administeredInsulinUnits: 5 }),
    record({ id: 'bedtime', type: 'Bedtime', bloodSugar: 130, mealCarbs: null, administeredInsulinUnits: 17 }),
    record({ id: 'note', type: 'Other', eventType: 'note', bloodSugar: null, mealCarbs: null, administeredInsulinUnits: null, insulinUnits: null }),
  ]);

  assert.deepEqual(trends.glucose.map((point) => point.record.id), ['breakfast', 'bedtime']);
  assert.deepEqual(trends.carbs.map((point) => point.record.id), ['breakfast']);
  assert.deepEqual(trends.insulin.map((point) => [point.record.id, point.category]), [
    ['breakfast', 'Fast-acting'],
    ['bedtime', 'Long-acting'],
  ]);
});

test('reports navigation and print summary are wired into the app', () => {
  const reports = createTrackerReports();
  const html = reports.renderReportDocument('detailed', [
    record({ id: 'breakfast', type: 'Breakfast', bloodSugar: 124, mealCarbs: 40, administeredInsulinUnits: 6, suggestedTotalUnits: 5 }),
  ], 'Aug 1, 2026', { includeSummary: true });

  assert.match(trackerSource, /\['reports', 'Reports'\]/);
  assert.doesNotMatch(trackerSource, /\['export', 'Export'\]/);
  assert.match(trackerSource, /REPORT_VIEW_ITEMS/);
  assert.match(trackerSource, /let reportOptions = \{\s*range: 'last7'/);
  assert.match(trackerSource, /range: filtersForm\?\.elements\.range\?\.value \|\| 'last7'/);
  assert.match(trackerSource, /lee_lee_diabetes_report_control_stack/);
  assert.match(trackerSource, /renderReports\(\)/);
  assert.doesNotMatch(trackerSource, /function renderExport\(\)/);
  assert.match(compactHtml(html), /<h3>Summary<\/h3>/);
  assert.match(compactHtml(html), /<dt>Insulin given<\/dt> <dd>6 units<\/dd>/);
  assert.doesNotMatch(compactHtml(html), /<dt>Insulin given<\/dt> <dd>5 units<\/dd>/);
});

test('entry type configuration exposes active carb-counting contexts while preserving legacy labels', () => {
  const runtime = createTrackerRuntime();
  const entryTypes = runtime.LeeLeeTrackerEntryTypes;
  const labels = Array.from(entryTypes.all, (definition) => definition.label);

  assert.deepEqual(labels, ['Breakfast', 'Lunch', 'Dinner', 'Bedtime', '2 AM', 'Correction', 'Snacks', 'Snack', 'Exercise', 'Other']);
  assert.deepEqual(Array.from(entryTypes.mealTypes), ['Breakfast', 'Lunch', 'Dinner']);
  assert.equal(entryTypes.getEntryTypeConfig('Bedtime').label, 'Bedtime');
  assert.equal(entryTypes.entryTypeUsesMealGuidance('Breakfast'), true);
  assert.equal(entryTypes.entryTypeUsesMealGuidance('Lunch'), true);
  assert.equal(entryTypes.entryTypeUsesMealGuidance('Dinner'), true);
  assert.equal(entryTypes.entryTypeUsesMealGuidance('Correction'), false);
  assert.equal(entryTypes.entryTypeUsesFoodCalculator('Breakfast'), true);
  assert.equal(entryTypes.entryTypeUsesFoodCalculator('Snacks'), true);
  assert.equal(entryTypes.entryTypeUsesFoodCalculator('Bedtime'), false);
  assert.equal(entryTypes.entryTypeUsesFoodCalculator('Correction'), false);
  assert.equal(entryTypes.getEntryTypeConfig('Night').type, 'Other');
});

test('log entry configuration exposes one combined check workflow with active contexts', () => {
  const runtime = createTrackerRuntime();
  const entryTypes = runtime.LeeLeeTrackerEntryTypes;
  const eventLabels = Array.from(entryTypes.eventTypes, (definition) => definition.label);

  assert.deepEqual(eventLabels, ['Check / Insulin', 'Meal / Carbs', 'Activity / Exercise', 'Note']);
  assert.deepEqual(Array.from(entryTypes.getContextOptionsForEventType('check-insulin')), [
    'Breakfast',
    'Lunch',
    'Dinner',
    'Snacks',
    'Bedtime',
    'Correction',
  ]);
  assert.deepEqual(Array.from(entryTypes.getContextOptionsForEventType('meal')), ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Other']);
  assert.equal(entryTypes.getEventTypeConfig('check-insulin').fields.includes('bloodSugar'), true);
  assert.equal(entryTypes.getEventTypeConfig('check-insulin').fields.includes('insulinUnits'), true);
  assert.match(trackerSource, /openEventEditor\('check-insulin'\)/);
  assert.doesNotMatch(trackerSource, /label: 'Blood Glucose'/);
  assert.doesNotMatch(trackerSource, /label: 'Insulin'/);
});

test('carb ratio and half-unit rounding are deterministic', () => {
  const runtime = createTrackerRuntime();
  const helper = runtime.LeeLeeTrackerDoseHelper;

  assert.equal(helper.calculateCarbDose(0, 20).roundedCarbDose, 0);
  assert.equal(helper.calculateCarbDose(20, 20).roundedCarbDose, 1);
  assert.equal(helper.calculateCarbDose(40, 20).roundedCarbDose, 2);
  assert.equal(helper.calculateCarbDose(60, 20).roundedCarbDose, 3);
  [
    [3.0, 3.0],
    [3.1, 3.0],
    [3.24, 3.0],
    [3.25, 3.5],
    [3.3, 3.5],
    [3.49, 3.5],
    [3.5, 3.5],
    [3.74, 3.5],
    [3.75, 4.0],
    [3.9, 4.0],
  ].forEach(([input, expected]) => {
    assert.equal(helper.roundToNearestHalf(input), expected);
  });
});

test('carb calculator totals decimal quantity rows without rounding to whole grams', () => {
  const runtime = createTrackerRuntime();
  const helper = runtime.LeeLeeTrackerDoseHelper;
  const rows = helper.normalizeCarbCalculatorRows([
    { qty: '1', carbs: '25' },
    { qty: '2', carbs: '15' },
    { qty: '1.5', carbs: '19' },
    { qty: '1', carbs: '46.5' },
  ]);

  assert.equal(rows.length, 5);
  assert.equal(rows.at(-1).qty, '1');
  assert.equal(rows.at(-1).carbs, '');
  assert.equal(helper.calculateCarbCalculatorRowTotal(rows[0]), 25);
  assert.equal(helper.calculateCarbCalculatorRowTotal(rows[1]), 30);
  assert.equal(helper.calculateCarbCalculatorRowTotal(rows[2]), 28.5);
  assert.equal(helper.calculateCarbCalculatorRowTotal(rows.at(-1)), null);
  assert.equal(helper.calculateCarbCalculatorMealTotal(rows), 130);
  assert.equal(helper.hasValidCarbCalculatorTotal(rows), true);
  assert.equal(helper.hasValidCarbCalculatorTotal(helper.normalizeCarbCalculatorRows([])), false);
});

test('meal dose helper uses carb coverage plus existing correction table', () => {
  const runtime = createTrackerRuntime();
  const insulinPlan = {
    id: 'plan',
    supportedMealTypes: ['Breakfast', 'Lunch', 'Dinner'],
    mealBaseUnitsByType: { Breakfast: 5, Lunch: 6, Dinner: 6 },
    insulinCarbRatioGrams: 20,
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
  const dinner = runtime.LeeLeeTrackerDoseHelper.calculateMealInsulinDose({
    bloodSugar: 299,
    entryType: 'Dinner',
    recordTimestamp: timestamp,
    insulinPlan,
    totalCarbs: 143,
  });
  const breakfast550 = runtime.LeeLeeTrackerDoseHelper.calculateMealInsulinDose({
    bloodSugar: 550,
    entryType: 'Breakfast',
    recordTimestamp: timestamp,
    insulinPlan,
    totalCarbs: 0,
  });

  assert.equal(dinner.status, 'calculated');
  assert.equal(dinner.baseUnits, null);
  assert.equal(dinner.rawCarbDose, 7.15);
  assert.equal(dinner.carbDoseUnits, 7);
  assert.equal(dinner.correctionUnits, 2);
  assert.equal(dinner.suggestedTotalUnits, 9);
  assert.equal(breakfast550.status, 'calculated');
  assert.equal(breakfast550.correctionUnits, 6);
  assert.equal(breakfast550.suggestedTotalUnits, 6);
  assert.equal(breakfast550.matchedRange.minGlucose, 550);
  assert.equal(breakfast550.matchedRange.maxGlucose, null);
});

test('snack boundary uses carb coverage only over 15 grams', () => {
  const runtime = createTrackerRuntime();
  const plan = {
    id: 'plan',
    supportedMealTypes: ['Breakfast', 'Lunch', 'Dinner'],
    insulinCarbRatioGrams: 20,
    correctionRanges: [{ minGlucose: 175, maxGlucose: 249, correctionUnits: 1 }],
  };
  const calc = (totalCarbs) => runtime.LeeLeeTrackerDoseHelper.calculateMealInsulinDose({
    bloodSugar: 220,
    entryType: 'Snacks',
    recordTimestamp: Date.parse('2026-08-01T15:00:00.000Z'),
    insulinPlan: plan,
    totalCarbs,
  });

  assert.equal(calc(0).suggestedTotalUnits, 0);
  assert.equal(calc(12).suggestedTotalUnits, 0);
  assert.equal(calc(15).suggestedTotalUnits, 0);
  assert.equal(calc(15.0).suggestedTotalUnits, 0);
  assert.equal(calc(16).suggestedTotalUnits, 1);
  assert.equal(calc(20).suggestedTotalUnits, 1);
  assert.equal(calc(28).suggestedTotalUnits, 1.5);
  assert.equal(calc(28).correctionUnits, null);
});

test('correction and bedtime contexts use their dedicated dosing paths', () => {
  const runtime = createTrackerRuntime();
  const insulinPlan = {
    id: 'plan',
    supportedMealTypes: ['Breakfast', 'Lunch', 'Dinner'],
    bedtimeBaseUnits: 17,
    bedtimeBaseUnitsMigratedTo17: true,
    insulinCarbRatioGrams: 20,
    correctionRanges: [{ minGlucose: 175, maxGlucose: 249, correctionUnits: 1 }],
  };
  const correction = runtime.LeeLeeTrackerDoseHelper.calculateMealInsulinDose({
    bloodSugar: 198,
    entryType: 'Correction',
    recordTimestamp: Date.parse('2026-08-01T14:00:00.000Z'),
    insulinPlan,
  });
  const bedtime = runtime.LeeLeeTrackerDoseHelper.calculateMealInsulinDose({
    bloodSugar: 198,
    entryType: 'Bedtime',
    recordTimestamp: Date.parse('2026-08-01T21:00:00.000Z'),
    insulinPlan,
  });
  const overnight = runtime.LeeLeeTrackerDoseHelper.calculateMealInsulinDose({
    bloodSugar: 198,
    entryType: '2 AM',
    recordTimestamp: Date.parse('2026-08-01T02:00:00.000Z'),
    insulinPlan,
  });

  assert.equal(correction.suggestedTotalUnits, 1);
  assert.equal(correction.baseUnits, null);
  assert.equal(bedtime.suggestedTotalUnits, 17);
  assert.equal(bedtime.correctionUnits, null);
  assert.equal(overnight.status, 'unsupported-entry-type');
});

test('settings UI exposes carb ratio and hides active fixed meal base dose controls', () => {
  assert.match(trackerSource, /Insulin-to-Carb Ratio/);
  assert.match(trackerSource, /name="insulinCarbRatioGrams"/);
  assert.doesNotMatch(trackerSource, /\$\{escapeHtml\(type\)\} Base Dose/);
  assert.doesNotMatch(trackerSource, /name="\$\{escapeHtml\(type\.toLowerCase\(\)\)\}BaseUnits"/);
  assert.doesNotMatch(trackerSource, /name="mealBaseUnits" type="number"/);
});

test('settings UI exposes bedtime long-acting dose control', () => {
  assert.match(trackerSource, /Bedtime Long-Acting Dose/);
  assert.match(trackerSource, /name="bedtimeBaseUnits" type="number" inputmode="decimal" min="0" step="0\.5" required/);
  assert.match(trackerSource, /bedtimeBaseUnits = normalizeNumber\(form\.elements\.bedtimeBaseUnits\?\.value\)/);
  assert.match(trackerSource, /Bedtime long-acting dose must be a nonnegative number\./);
});

test('settings plan activation closes an existing plan with the same effective date', () => {
  assert.match(trackerSource, /range\.start <= pendingStart && range\.end > pendingStart/);
});

test('settings correction table includes the editable open-ended 550 plus row', () => {
  assert.match(trackerSource, /minGlucose: 550,\s*maxGlucose: null,\s*correctionUnits: 6/);
  assert.match(trackerSource, /plan\.correctionRanges\.map\(renderRangeEditorRow\)/);
  assert.match(trackerSource, /DEFAULT_INSULIN_PLAN\.correctionRanges\.map\(\(_, index\) => normalizeCorrectionRange/);
});

test('shared settings contract applies restored patient and dose settings to calculator state', () => {
  const runtime = createTrackerRuntime();
  const shared = runtime.LeeLeeTrackerSharedSettings;
  const sourceDocument = {
    schemaVersion: 1,
    records: [],
    settings: {
      patientName: '',
      historyInitialWindowDays: '14',
    },
    insulinPlans: [],
    activeInsulinPlanId: null,
    recovery: {},
    metadata: {},
  };
  const restored = shared.applySharedSettingsToDocument(sourceDocument, {
    patientName: 'Lee Bernal',
    patientBirthDate: '2014-06-13',
    clinicName: 'Vanderbilt Children',
    clinicPhone: '615-555-0100',
    insulinPlan: {
      id: 'shared-plan',
      name: 'Shared Plan',
      effectiveFrom: '2026-08-14',
      effectiveTo: null,
      mealBaseUnitsByType: { Breakfast: 5, Lunch: 6, Dinner: 6 },
      bedtimeBaseUnits: 17,
      bedtimeBaseUnitsMigratedTo17: true,
      insulinCarbRatioGrams: 20,
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
      notes: '',
    },
  });
  const plan = restored.insulinPlans.find((item) => item.id === restored.activeInsulinPlanId);
  const lunch550 = runtime.LeeLeeTrackerDoseHelper.calculateMealInsulinDose({
    bloodSugar: 550,
    entryType: 'Lunch',
    recordTimestamp: Date.parse('2026-08-14T12:00:00.000Z'),
    insulinPlan: plan,
  });

  assert.equal(restored.settings.patientName, 'Lee Bernal');
  assert.equal(restored.settings.historyInitialWindowDays, '14');
  assert.equal(plan.mealBaseUnitsByType.Breakfast, 5);
  assert.equal(plan.mealBaseUnitsByType.Lunch, 6);
  assert.equal(plan.mealBaseUnitsByType.Dinner, 6);
  assert.equal(plan.insulinCarbRatioGrams, 20);
  assert.equal(plan.bedtimeBaseUnits, 17);
  assert.equal(plan.correctionRanges.at(-1).minGlucose, 550);
  assert.equal(plan.correctionRanges.at(-1).maxGlucose, null);
  assert.equal(plan.correctionRanges.at(-1).correctionUnits, 6);
  assert.equal(lunch550.baseUnits, null);
  assert.equal(lunch550.carbDoseUnits, 0);
  assert.equal(lunch550.correctionUnits, 6);
  assert.equal(lunch550.suggestedTotalUnits, 6);
});

test('shared settings inventory classifies every current LLT settings control', () => {
  const inventory = createTrackerRuntime().LeeLeeTrackerSharedSettings.settingsInventory;
  const byLabel = new Map(inventory.map((item) => [item.label, item]));

  ['Patient Name', 'Date of Birth', 'Clinic Name', 'Clinic Phone', 'Insulin-to-Carb Ratio', 'Bedtime Base Dose', 'Correction Table'].forEach((label) => {
    assert.equal(byLabel.get(label)?.classification, 'SHARED');
  });
  assert.equal(byLabel.has('Saved Foods'), false);
  ['History Initial Window', 'This device is used by', 'Shared Sync status/diagnostics', 'Local Backup import/export controls', 'Recently Deleted controls'].forEach((label) => {
    assert.equal(byLabel.get(label)?.classification, 'LOCAL');
  });
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
  assert.match(trackerSource, /Open Carb Calc/);
  assert.match(trackerSource, /role="dialog" aria-modal="true" aria-labelledby="lee-lee-carb-calculator-title"/);
  assert.match(trackerSource, /data-carb-calculator-layer/);
  assert.match(trackerSource, /lee_lee_diabetes_carb_calc_operator" aria-hidden="true">×/);
  assert.match(trackerSource, /lee_lee_diabetes_carb_calc_input/);
  assert.match(trackerSource, /enableCarbCalculatorModalViewport/);
  assert.match(trackerSource, /lockCarbCalculatorDocumentScroll/);
  assert.match(trackerSource, /window\.visualViewport/);
  assert.match(cssSource, /--lee-lee-carb-calc-viewport-height/);
  assert.match(cssSource, /touch-action: pan-y/);
  assert.match(cssSource, /-webkit-appearance: none/);
  assert.match(cssSource, /appearance: textfield/);
  assert.match(trackerSource, /handleCarbCalculatorCarbsTab/);
  assert.doesNotMatch(trackerSource, /tabindex="[1-9]/);
  assert.match(trackerSource, /data-action="use-carb-calculator-total"/);
  assert.doesNotMatch(trackerSource, /Save for reuse/);
  assert.doesNotMatch(trackerSource, /data-action="add-food"/);
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
  assert.equal(content.title, 'Dinner');
  assert.equal(content.primary, '269 mg/dL');
  assert.deepEqual(Array.from(content.secondary), [
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
    assert.equal(countOccurrences(html, 'Dinner'), 1);
    assert.equal(countOccurrences(html, '<div class="lee_lee_diabetes_timeline_notes">8 units</div>'), 1);
    assert.equal(countOccurrences(html, 'Given: 8 units · Suggested: 8 units · 6 units base + 2 units correction'), 1);
    assert.doesNotMatch(html, /<strong>Value:<\/strong>|<strong>Blood sugar:<\/strong>|<strong>Insulin given:<\/strong>|<strong>Suggested:<\/strong>/);
  }
});

test('canonical entry cards show bedtime manual override against suggested dose', () => {
  const reports = createTrackerReports();
  const bedtime = record({
    eventType: 'check-insulin',
    type: 'Bedtime',
    bloodSugar: 439,
    administeredInsulinUnits: 14,
    insulinUnits: 14,
    suggestedTotalUnits: 15,
    suggestedBaseUnits: 15,
    suggestedCorrectionUnits: null,
    doseCalculationStatus: 'calculated',
    recordTimestamp: '2026-08-08T21:36:00.000Z',
  });

  const content = reports.getEntryCardContent(bedtime);
  assert.equal(content.title, 'Bedtime');
  assert.equal(content.primary, '439 mg/dL');
  assert.deepEqual(Array.from(content.secondary), [
    '14 units',
    'Given: 14 units · Suggested: 15 units',
  ]);
  assert.equal(content.timestamp, Date.parse('2026-08-08T21:36:00.000Z'));

  const historyHtml = reports.renderHistoryRecord(bedtime);
  assert.equal(countOccurrences(historyHtml, '439 mg/dL'), 1);
  assert.match(historyHtml, /Bedtime/);
  assert.match(historyHtml, /14 units/);
  assert.match(historyHtml, /Given: 14 units · Suggested: 15 units/);
  assert.doesNotMatch(historyHtml, /base|correction/);
});

test('canonical entry cards keep other check insulin records free of dose guidance', () => {
  const reports = createTrackerReports();
  const overnight = record({
    eventType: 'check-insulin',
    type: '2 AM',
    bloodSugar: 139,
    administeredInsulinUnits: 0,
    insulinUnits: 0,
    suggestedTotalUnits: null,
    suggestedBaseUnits: null,
    suggestedCorrectionUnits: null,
    doseCalculationStatus: 'manual',
    recordTimestamp: '2026-08-09T02:00:00.000Z',
  });

  const content = reports.getEntryCardContent(overnight);
  assert.equal(content.title, '2 AM');
  assert.equal(content.primary, '139 mg/dL');
  assert.deepEqual(Array.from(content.secondary), ['0 units']);

  const historyHtml = reports.renderHistoryRecord(overnight);
  assert.match(historyHtml, /2 AM/);
  assert.match(historyHtml, /0 units/);
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
  assert.equal(reports.getEntryCardContent(legacy).title, 'Correction');
  assert.deepEqual(Array.from(reports.getEntryCardContent(legacy).secondary), ['3 units']);

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
  assert.match(trackerSource, />\+ Log Entry<\/button>/);
  assert.match(trackerSource, /id="lee-lee-diabetes-title">Log Entry<\/h1>/);
  assert.doesNotMatch(trackerSource, />\+ Add Event<\/button>/);
  assert.doesNotMatch(trackerSource, /id="lee-lee-diabetes-title">Add Event<\/h1>/);
  assert.doesNotMatch(trackerSource, /PRIMARY_TYPES\.map\(renderPrimaryCard\)/);
  assert.match(trackerSource, /data-action="toggle-tracker-nav"/);
  assert.match(trackerSource, /aria-expanded/);
  assert.match(cssSource, /\.lee_lee_diabetes_mobile_nav_button/);
  assert.match(cssSource, /max-width: 520px[\s\S]*\.lee_lee_diabetes_nav_shell\.is-open \.lee_lee_diabetes_nav/);
  assert.match(cssSource, /min-width: 680px[\s\S]*\.lee_lee_diabetes_cards/);
});

test('check insulin scheduled contexts are marked logged and rechecked before save', () => {
  assert.match(trackerSource, /SINGLE_USE_CHECK_CONTEXT_TYPES = Object\.freeze\(\['Breakfast', 'Lunch', 'Dinner', 'Bedtime'\]\)/);
  assert.match(trackerSource, /getLoggedSingleUseCheckContextsForDate\(dateKey, excludeRecordId = null\)/);
  assert.match(trackerSource, /activeRecords\(\)\.forEach\(\(record\) =>/);
  assert.match(trackerSource, /normalizeEventType\(record\.eventType, record\) !== 'check-insulin'/);
  assert.match(trackerSource, /getRecordEventDateKey\(record\) === dateKey/);
  assert.match(trackerSource, /\$\{type\} - ✓ Logged/);
  assert.match(trackerSource, /getDuplicateScheduledContextMessage\(record\)/);
  assert.match(trackerSource, /\$\{context\} has already been logged for this date\./);
  assert.match(trackerSource, /showEditorError\(form, duplicateMessage\)/);
  assert.match(trackerSource, /if \(action === 'confirm-save' && currentEditor\?\.pendingRecord\)[\s\S]*getDuplicateScheduledContextMessage\(currentEditor\.pendingRecord\)/);
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
