import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/lee-lee-diabetes-tracker.js', import.meta.url), 'utf8');
const storageHarness = readFileSync(new URL('./lee-lees-tracker-storage.test.js', import.meta.url), 'utf8');
const factories = storageHarness.slice(storageHarness.indexOf('function createLocalStorage'), storageHarness.indexOf('function sampleRecord'));
const instrumented = source.replace('  window.LeeLeeTrackerStorage = {', `  window.LeeLeeTrackerStorage = {
    low: window.LeeLeeTrackerLowGlucose,
    audit: { normalizeRecord, buildRecordFromForm, getEditorDoseResult, getDuplicateScheduledContextMessage,
      getContextOptionsForEventType, entryTypeUsesDoseGuidance, entryTypeUsesFoodCalculator, renderLowGlucoseCard, getRecordActualInsulin, getRecordCarbs,
      getPurposeAwareTimer, setRecords(value) { records = value; },
      setEditor(value) { currentEditor = value; }, setTimerService(value) { window.LeeLeePreMealTimer = value; } },`);
const factory = new Function('vm', 'trackerSource', 'Blob', factories + '\nreturn createTracker;')(vm, instrumented, Blob);
const json = value => JSON.parse(JSON.stringify(value));
const value = value => ({ value });
const form = overrides => ({ dataset: {}, elements: Object.fromEntries(Object.entries({ eventType: 'check-insulin', type: 'Low Glucose', bloodSugar: '53', mealCarbs: '', date: '2026-10-05', time: '23:50', insulinUnits: '9', notes: 'Synthetic documentation', ...overrides }).map(([key, val]) => [key, value(val)])) });
function setup() { const runtime = factory(); return { ...runtime, low: runtime.storage.low, audit: runtime.storage.audit }; }
function episode(low, overrides = {}) { return { id: 'episode-1', version: 1, eventType: 'check-insulin', type: 'Low Glucose', recordTimestamp: '2026-10-05T23:50:00Z', bloodSugar: 53, mealCarbs: 15, ...low.clearLowGlucoseInsulin({}), lowGlucoseEpisode: low.createLowGlucoseEpisode({ lowMgDl: 70, source: 'synthetic' }), ...overrides }; }
const round = (id = 'round-1', bloodSugar = 61, carbs = 15, timestamp = '2026-10-06T00:05:00Z') => ({ id, bloodSugar, carbs, recordTimestamp: timestamp, treatmentTimestamp: timestamp, carbComponents: [], notes: '' });

test('invalid recheck observations cannot enter the episode envelope', () => {
  const { low } = setup();
  for (const invalid of [round('bad', 0), round('bad', 61, -1), round('bad', 61, 0, 'invalid')]) {
    assert.throws(() => low.updateLowGlucoseRound(episode(low), invalid), /valid recheck/);
  }
});

test('Low Glucose is a supported repeatable non-insulin food context', () => {
  const { storage, audit } = setup();
  assert.ok(audit.getContextOptionsForEventType('check-insulin').includes('Low Glucose'));
  assert.equal(audit.entryTypeUsesDoseGuidance('Low Glucose'), false);
  assert.equal(audit.entryTypeUsesFoodCalculator('Low Glucose'), true);
  assert.equal(audit.getDuplicateScheduledContextMessage({ type: 'Low Glucose', eventType: 'check-insulin', date: '2026-10-05' }), '');
});

test('domain bypass does not read a poisoned insulin plan, glucose, or treatment amount', () => {
  const { storage } = setup();
  const poisoned = new Proxy({}, { get() { throw new Error('Insulin plan accessed'); } });
  const result = storage.helpers.calculateMealInsulinDose({ entryType: 'Low Glucose', insulinPlan: poisoned, bloodSugar: 53, totalCarbs: 500 });
  assert.equal(result.status, 'not-applicable');
  for (const key of ['baseUnits', 'correctionUnits', 'carbDoseUnits', 'rawCarbDose', 'rawAggregateDose', 'roundedBaseDose', 'temporaryEatingAdjustmentUnits', 'suggestedTotalUnits', 'insulinPlanId', 'insulinPlanSnapshot']) assert.equal(result[key], null);
  assert.equal(result.temporaryEatingAdjustmentApplied, false);
});

for (const field of ['insulinUnits', 'administeredInsulinUnits', 'suggestedBaseUnits', 'suggestedCorrectionUnits', 'suggestedTotalUnits', 'suggestedCarbDoseUnits', 'carbDoseUnits', 'roundedCarbDose', 'rawCarbDose', 'rawAggregateDose', 'roundedBaseDose', 'temporaryEatingAdjustmentUnits', 'insulinPlanId', 'insulinPlanSnapshot']) {
  test(`Low Glucose canonical record clears ${field} to null`, () => {
    const { low, audit } = setup();
    const record = audit.normalizeRecord(episode(low, { [field]: 9 }));
    assert.equal(record[field], null);
    assert.equal(record.doseCalculationStatus, 'not-applicable');
  });
}

test('initial builder ignores stale insulin and uses no historical plan', () => {
  const { low, audit } = setup();
  audit.setEditor({ type: 'Low Glucose', eventType: 'check-insulin', mealComponents: [], originalRecord: null });
  const record = audit.buildRecordFromForm(form());
  assert.equal(record.type, 'Low Glucose');
  assert.equal(record.insulinUnits, null);
  assert.equal(record.insulinPlanSnapshot, null);
  assert.equal(record.mealCarbs, null);
  assert.equal(record.lowGlucoseEpisode.rechecks.length, 0);
  assert.equal(low.deriveLowGlucoseEpisode(record).status, 'Open');
});

test('historical initial editing preserves episode, round IDs and threshold', () => {
  const { low, audit } = setup();
  const original = low.updateLowGlucoseRound(episode(low), round());
  audit.setEditor({ id: original.id, originalRecord: original, type: 'Low Glucose', eventType: 'check-insulin', mealComponents: [] });
  const record = audit.buildRecordFromForm(form({ notes: 'Edited factual notes' }));
  assert.deepEqual(json(record.lowGlucoseEpisode), json(original.lowGlucoseEpisode));
  assert.equal(audit.getEditorDoseResult(form()).status, 'not-applicable');
  assert.equal(record.insulinPlanSnapshot, null);
});

for (const threshold of [65, 70, 80, 90]) test(`configured lower target ${threshold} is resolved and snapshotted`, () => {
  const { low } = setup();
  const snapshot = low.resolveLowGlucoseThreshold({ glucoseTargetMin: threshold }, null, Date.now());
  assert.equal(snapshot.lowMgDl, threshold);
  const record = episode(low, { lowGlucoseEpisode: low.createLowGlucoseEpisode(snapshot) });
  low.resolveLowGlucoseThreshold({ glucoseTargetMin: threshold + 20 }, null, Date.now());
  assert.equal(record.lowGlucoseEpisode.thresholdSnapshot.lowMgDl, threshold);
});

test('missing, invalid and untrusted historical threshold never defaults to 70', () => {
  const { low } = setup();
  assert.equal(low.resolveLowGlucoseThreshold({}, null, Date.now()), null);
  assert.equal(low.resolveLowGlucoseThreshold({ glucoseTargetMin: 0 }, null, Date.now()), null);
  assert.equal(low.resolveLowGlucoseThreshold({ glucoseTargetMin: 70 }, null, Date.now() - 7 * 86400000), null);
  const record = low.updateLowGlucoseRound(episode(low, { lowGlucoseEpisode: low.createLowGlucoseEpisode(null) }), round('above', 200));
  assert.equal(low.deriveLowGlucoseEpisode(record).eligible.length, 0);
  assert.throws(() => low.closeLowGlucoseEpisode(record, 'recovery-confirmed'), /documented recheck/);
});

test('supplied plan fallback has provenance and does not synthesize a plan', () => {
  const { low } = setup();
  assert.deepEqual(json(low.resolveLowGlucoseThreshold({}, { id: 'synthetic-plan', targetGlucoseMin: 75 }, Date.now())), { lowMgDl: 75, source: 'plan', planId: 'synthetic-plan' });
});

test('initial at-threshold reading is not a recovery recheck', () => {
  const { low } = setup(); const record = episode(low, { bloodSugar: 84 });
  assert.equal(low.deriveLowGlucoseEpisode(record).eligible.length, 0);
  assert.throws(() => low.closeLowGlucoseEpisode(record, 'recovery-confirmed'), /documented recheck/);
});

for (const carbs of [null, 0, 5, 15]) test(`recheck preserves actual additional carbs ${carbs}`, () => {
  const { low } = setup(); const original = episode(low);
  const record = low.updateLowGlucoseRound(original, round('one', 61, carbs));
  assert.equal(record.lowGlucoseEpisode.rechecks[0].carbs, carbs);
  assert.equal(low.deriveLowGlucoseEpisode(record).totalCarbs, 15 + (carbs || 0));
  assert.equal(original.lowGlucoseEpisode.rechecks.length, 0);
});

test('stable round identity makes edits and repeat append idempotent', () => {
  const { low } = setup(); let record = low.updateLowGlucoseRound(episode(low), round());
  record = low.updateLowGlucoseRound(record, round('round-1', 62, 0));
  assert.equal(record.lowGlucoseEpisode.rechecks.length, 1);
  assert.equal(record.lowGlucoseEpisode.rechecks[0].id, 'round-1');
  assert.equal(record.lowGlucoseEpisode.rechecks[0].bloodSugar, 62);
});

test('53 → 61 → 84 stays one open episode until explicit recovery confirmation', () => {
  const { low } = setup(); let record = low.updateLowGlucoseRound(episode(low), round());
  assert.equal(low.deriveLowGlucoseEpisode(record).status, 'Open');
  record = low.updateLowGlucoseRound(record, round('round-2', 84, null, '2026-10-06T00:20:00Z'));
  const derived = low.deriveLowGlucoseEpisode(record);
  assert.equal(derived.status, 'Open'); assert.equal(derived.latest, 84); assert.equal(derived.lowest, 53); assert.equal(derived.totalCarbs, 30);
  const closed = low.closeLowGlucoseEpisode(record, 'recovery-confirmed');
  assert.equal(closed.lowGlucoseEpisode.closure.recheckId, 'round-2');
  assert.equal(low.deriveLowGlucoseEpisode(closed).status, 'Recovery Confirmed');
  assert.equal(low.deriveLowGlucoseEpisode(closed).durationMinutes, 30);
});

test('manual ending is distinct and works without a known threshold', () => {
  const { low } = setup(); const closed = low.closeLowGlucoseEpisode(episode(low, { lowGlucoseEpisode: low.createLowGlucoseEpisode(null) }), 'ended-without-confirmed-recovery');
  assert.equal(low.deriveLowGlucoseEpisode(closed).status, 'Ended Without Confirmed Recovery');
  assert.equal(low.deriveLowGlucoseEpisode(closed).durationMinutes, null);
});

test('editing referenced recovery below threshold reopens, preserves identity', () => {
  const { low } = setup(); const closed = low.closeLowGlucoseEpisode(low.updateLowGlucoseRound(episode(low), round('one', 84)), 'recovery-confirmed');
  const next = low.updateLowGlucoseRound(closed, round('one', 61));
  assert.equal(next.lowGlucoseEpisode.closure, null); assert.equal(next.lowGlucoseEpisode.rechecks[0].id, 'one');
  assert.equal(closed.lowGlucoseEpisode.closure.kind, 'recovery-confirmed');
});

test('dangling recovery references are never displayed as confirmed', () => {
  const { low } = setup(); const record = episode(low);
  record.lowGlucoseEpisode.closure = { kind: 'recovery-confirmed', recheckId: 'absent' };
  assert.equal(low.deriveLowGlucoseEpisode(record).status, 'Open');
  assert.equal(low.deriveLowGlucoseEpisode(record).invalidClosure, true);
});

test('chronological presentation keeps stable IDs and flags recheck before initial', () => {
  const { low } = setup(); let record = low.updateLowGlucoseRound(episode(low), round('late', 84, null, '2026-10-06T01:00:00Z'));
  record = low.updateLowGlucoseRound(record, round('early', 61, 0, '2026-10-05T22:00:00Z'));
  assert.deepEqual(Array.from(low.deriveLowGlucoseEpisode(record).rounds, item => item.id), ['early', 'late']);
  assert.deepEqual(Array.from(record.lowGlucoseEpisode.rechecks, item => item.id), ['late', 'early']);
  assert.equal(low.deriveLowGlucoseEpisode(record).suspiciousChronology, true);
});

test('recheck and closure clear the durable pending schedule', () => {
  const { low } = setup(); const record = episode(low);
  record.lowGlucoseEpisode.pendingRecheck = { id: 'schedule', sourceRoundId: record.id, startedAt: record.recordTimestamp, dueAt: '2026-10-06T00:05:00Z' };
  assert.equal(low.updateLowGlucoseRound(record, round()).lowGlucoseEpisode.pendingRecheck, null);
  assert.equal(low.closeLowGlucoseEpisode(record, 'ended-without-confirmed-recovery').lowGlucoseEpisode.pendingRecheck, null);
});

test('stale local timer is dismissed after another device records or closes', () => {
  const { low, audit } = setup(); const record = episode(low); let dismissed = 0;
  const timer = { purpose: 'low-glucose-recheck', episodeId: record.id, scheduleId: 'old', status: 'completed' };
  audit.setRecords([low.updateLowGlucoseRound(record, round())]);
  audit.setTimerService({ normalize: () => timer, dismiss: () => { dismissed++; } });
  assert.equal(audit.getPurposeAwareTimer(), null); assert.equal(dismissed, 1);
});

for (const version of [2, 99]) test(`future version ${version} preserved through storage/backup but read only`, () => {
  const { low, storage, audit } = setup(); const record = episode(low); record.lowGlucoseEpisode.version = version; record.lowGlucoseEpisode.future = { preserve: true };
  const normalized = audit.normalizeRecord(record);
  assert.deepEqual(json(normalized.lowGlucoseEpisode), json(record.lowGlucoseEpisode));
  assert.equal(low.isSupportedLowGlucoseEpisode(normalized.lowGlucoseEpisode), false);
  assert.match(audit.renderLowGlucoseCard(normalized), /Compatibility review required/);
  assert.throws(() => low.updateLowGlucoseRound(normalized, round()), /newer compatible/);
  const saved = storage.saveTrackerData({ records: [normalized], insulinPlans: [], settings: {} });
  assert.equal(saved.ok, true);
  assert.deepEqual(json(storage.loadTrackerData().records[0].lowGlucoseEpisode), json(record.lowGlucoseEpisode));
});

for (const bad of [null, { version: 1 }, { version: 1, rechecks: [null], thresholdSnapshot: null, closure: null, pendingRecheck: null }]) test(`malformed episode remains protected ${JSON.stringify(bad)}`, () => {
  const { low, audit } = setup(); const record = episode(low, { lowGlucoseEpisode: bad });
  assert.equal(low.isSupportedLowGlucoseEpisode(bad), false);
  assert.equal(audit.normalizeRecord(record).lowGlucoseEpisode, bad);
  assert.match(audit.renderLowGlucoseCard(record), /preserved/);
});

test('local backup restore and soft deletion preserve the complete episode', () => {
  const { low, storage, audit } = setup(); const record = low.updateLowGlucoseRound(episode(low), round());
  const deleted = audit.normalizeRecord({ ...record, deletedAt: new Date().toISOString() });
  assert.deepEqual(json(deleted.lowGlucoseEpisode), json(record.lowGlucoseEpisode));
  assert.equal(storage.saveTrackerData({ records: [deleted], settings: {}, insulinPlans: [] }).ok, true);
  const backup = storage.createBackupDocument(); const restored = storage.validateBackupPayload(json(backup));
  assert.equal(restored.error, undefined);
  assert.deepEqual(json(restored.data.records[0].lowGlucoseEpisode), json(record.lowGlucoseEpisode));
});

test('Reports retain the observation and exclude treatment from insulin/meal carb aggregates', () => {
  const { low, reports, audit } = setup(); const record = episode(low, { insulinUnits: 10, administeredInsulinUnits: 10 });
  assert.equal(audit.getRecordActualInsulin(record), null); assert.equal(audit.getRecordCarbs(record), null);
  const summary = reports.calculateReportSummary([record], { range: 'custom', startDate: '2026-10-05', endDate: '2026-10-06' });
  assert.equal(summary.insulin.count, 0); assert.equal(summary.insulin.average, null); assert.equal(summary.carbs.count, 0); assert.equal(summary.glucose.count, 1);
  const html = audit.renderLowGlucoseCard(record);
  assert.doesNotMatch(html, /0 U|0 units|insulin given/i); assert.match(html, /Episode timeline/);
});

test('context conversions reject saved mixed contexts and clear new stale dose state', () => {
  assert.match(source, /currentEditor\.id && \(\(previousType === 'Low Glucose'\) !== \(nextType === 'Low Glucose'\)\)/);
  assert.match(source, /draft = clearLowGlucoseInsulin\(draft\);\s+delete draft.lowGlucoseEpisode/);
});

test('initial threshold confirmation, failed-save draft retention and explicit outcome actions are wired', () => {
  assert.match(source, /threshold > 0 && glucose >= threshold/);
  assert.match(source, /saveLowGlucoseEditor\(form\)/);
  assert.match(source, /if \(saved\.ok !== true\)/);
  assert.match(source, /low-confirm-recovery/); assert.match(source, /low-close-manual/);
});

const timerSource = readFileSync(new URL('../js/lee-lee-pre-meal-timer.js', import.meta.url), 'utf8');
for (const duration of [1, 30, 60]) test(`Low timer uses fixed 15 minutes despite pre-meal duration ${duration} and disabled setting`, () => {
  const entries = new Map(); const context = { window: {}, localStorage: { getItem: key => entries.get(key), setItem: (key, val) => entries.set(key, val), removeItem: key => entries.delete(key) }, Date, JSON, Math, Number };
  vm.runInNewContext(timerSource, context); const service = context.window.LeeLeePreMealTimer;
  service.saveSettings({ enabled: false, durationMinutes: duration });
  const timer = service.start({ purpose: 'low-glucose-recheck', episodeId: 'episode', scheduleId: 'schedule', durationMinutes: duration });
  assert.equal(timer.durationMinutes, 15); assert.equal(timer.endsAt - timer.startedAt, 900000);
  assert.equal(timer.purpose, 'low-glucose-recheck'); assert.equal(timer.episodeId, 'episode'); assert.equal(timer.scheduleId, 'schedule');
  service.dismiss(); assert.equal(service.getTimer(), null);
});

test('a persisted supported episode hydrates safely during tracker startup', () => {
  const { low } = setup(); const record = episode(low);
  const saved = JSON.stringify({ schemaVersion: 1, records: [record], insulinPlans: [], settings: {}, metadata: {} });
  const memory = new Map([['lando-world:lee-lees-tracker:v1', saved]]);
  const runtime = factory({ localStorage: { getItem: key => memory.get(key) || null, setItem: (key, val) => memory.set(key, val), removeItem: key => memory.delete(key) } });
  assert.equal(runtime.storage.loadTrackerData().records[0].type, 'Low Glucose');
  assert.deepEqual(json(runtime.storage.loadTrackerData().records[0].lowGlucoseEpisode), json(record.lowGlucoseEpisode));
});

test('unrecorded treatment carbs stay distinct from an explicit zero', () => {
  const { low } = setup(); const unknown = episode(low, { mealCarbs: null });
  assert.equal(low.deriveLowGlucoseEpisode(unknown).totalCarbs, null);
  assert.equal(low.deriveLowGlucoseEpisode({ ...unknown, mealCarbs: 0 }).totalCarbs, 0);
});
