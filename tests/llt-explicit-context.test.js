import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/lee-lee-carb-calculator.js', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../js/lee-lee-diabetes-tracker.js', import.meta.url), 'utf8');
const storageHarness = readFileSync(new URL('./lee-lees-tracker-storage.test.js', import.meta.url), 'utf8');
const factories = storageHarness.slice(storageHarness.indexOf('function createLocalStorage'), storageHarness.indexOf('function sampleRecord'));
const instrumented = source.replace('  window.LeeLeeTrackerStorage = {', `  window.LeeLeeTrackerStorage = {
    audit: { getContextOptionStates, getEditorType, handleSave, entryTypeUsesDoseGuidance, entryTypeUsesFoodCalculator,
      setRecords(value) { records = value; }, setEditor(value) { currentEditor = value; } },`);
const factory = new Function('vm', 'trackerSource', 'Blob', factories + '\nreturn createTracker;')(vm, instrumented, Blob);
const json = value => JSON.parse(JSON.stringify(value));
const form = overrides => ({ dataset: {}, elements: Object.fromEntries(Object.entries({ eventType: 'check-insulin', type: '', date: '2026-10-05', time: '23:50', ...overrides }).map(([key, value]) => [key, { value }])) });
function setup() { const runtime = factory(); return { ...runtime, audit: runtime.storage.audit }; }

test('editor never normalizes an empty or invalid context to Breakfast', () => {
  const { audit } = setup();
  audit.setEditor({ type: 'Dinner', eventType: 'check-insulin' });
  for (const type of ['', 'invalid']) {
    assert.equal(audit.getEditorType(form({ type })), '');
    assert.equal(audit.entryTypeUsesDoseGuidance(''), false);
  }
});

test('all event types expose a selected placeholder without a fallback', () => {
  const { audit } = setup();
  audit.setEditor({});
  for (const event of ['check-insulin', 'meal', 'activity', 'note']) {
    const options = json(audit.getContextOptionStates(event, ''));
    assert.deepEqual(options.filter(o => o.selected).map(o => o.type), ['']);
    assert.equal(options[0].label, 'Select a context…');
  }
});

test('duplicate contexts never cause automatic selection; edit excludes its own record', () => {
  const { audit } = setup();
  audit.setRecords(['Breakfast','Lunch','Dinner','Bedtime'].map((type, i) => ({ id: String(i), eventType: 'check-insulin', type, date: '2026-10-05', recordTimestamp: '2026-10-05T12:00:00' })));
  audit.setEditor({});
  let options = json(audit.getContextOptionStates('check-insulin', '', form()));
  for (const type of ['Breakfast','Lunch','Dinner','Bedtime']) assert.equal(options.find(o => o.type === type).disabled, true);
  for (const type of ['Snacks','Correction','Low Glucose']) assert.equal(options.find(o => o.type === type).disabled, false);
  assert.deepEqual(options.filter(o => o.selected).map(o => o.type), ['']);
  options = json(audit.getContextOptionStates('check-insulin', 'Dinner', form()));
  assert.deepEqual(options.filter(o => o.selected).map(o => o.type), ['Dinner']);
  audit.setEditor({ id: '2' });
  options = json(audit.getContextOptionStates('check-insulin', 'Dinner', form()));
  assert.equal(options.find(o => o.type === 'Dinner').disabled, false);
});

test('invalid save stops before record construction, storage, or Low Glucose dispatch', () => {
  const { audit, localStorage } = setup();
  audit.setEditor({ type: 'Low Glucose', eventType: 'check-insulin' });
  const f = form({ type: '' });
  const error = { hidden: true };
  let focused = false;
  f.querySelector = () => error;
  f.elements.type.setAttribute = (name, value) => { assert.equal(name, 'aria-invalid'); assert.equal(value, 'true'); };
  f.elements.type.focus = () => { focused = true; };
  f.elements.type.closest = () => null;
  const before = localStorage.dump();
  audit.handleSave(f);
  assert.equal(error.textContent, 'Select a context before saving.');
  assert.equal(error.hidden, false);
  assert.equal(focused, true);
  assert.deepEqual(localStorage.dump(), before);
});

test('calculator applicability retains Low Glucose and meal contexts only', () => {
  const { audit } = setup();
  for (const type of ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Snack', 'Low Glucose']) assert.equal(audit.entryTypeUsesFoodCalculator(type), true);
  for (const type of ['', 'Correction', 'Bedtime']) assert.equal(audit.entryTypeUsesFoodCalculator(type), false);
});
