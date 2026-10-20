import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/lee-lee-diabetes-tracker.js', import.meta.url), 'utf8');
const start = source.indexOf('  function renderCarbCalculatorMealStatus(');
const end = source.indexOf('  function renderCarbCalculatorMealSearchResult(', start);
const renderStatus = vm.runInNewContext(`(${source.slice(start, end).trim()})`);

test('My Meals shows sync progress without blocking the local library', () => {
  assert.match(renderStatus({ state: 'syncing' }), /role="status".*Sync in progress.*Showing meals saved on this device/);
});
test('My Meals explains unavailable sync while keeping local meals usable', () => {
  assert.match(renderStatus({ state: 'saved', lastError: 'synthetic fetch error' }), /role="status".*Sync is unavailable.*still available/);
  assert.equal(renderStatus({ state: 'saved' }), '');
});
