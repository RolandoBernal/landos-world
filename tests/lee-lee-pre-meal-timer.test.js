import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

function createTimerService() {
  const values = new Map();
  const context = {
    localStorage: {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
    window: {},
    Date,
    Number,
    JSON,
    Math,
  };
  vm.runInNewContext(fs.readFileSync('js/lee-lee-pre-meal-timer.js', 'utf8'), context);
  return context.window.LeeLeePreMealTimer;
}

test('pre-meal timer persists timestamp authority and clamps settings', () => {
  const service = createTimerService();
  assert.deepEqual({ ...service.getSettings() }, { enabled: true, durationMinutes: 15 });
  assert.deepEqual({ ...service.saveSettings({ enabled: true, durationMinutes: 999 }) }, { enabled: true, durationMinutes: 60 });
  assert.deepEqual({ ...service.saveSettings({ enabled: false, durationMinutes: 0 }) }, { enabled: false, durationMinutes: 1 });
  assert.equal(service.getTimer(), null);
});

test('timer source data is local and remaining time never goes negative', () => {
  const service = createTimerService();
  const timer = service.start({ durationMinutes: 1, sourceEntryId: 'entry-1', sourceEntry: { type: 'Breakfast', mealCarbs: 42 } });
  assert.equal(timer.status, 'active');
  assert.equal(timer.endsAt - timer.startedAt, 60 * 1000);
  assert.equal(timer.sourceEntryId, 'entry-1');
  assert.equal(service.remainingMs(timer, timer.endsAt + 5000), 0);
  assert.equal(service.normalize(timer.endsAt + 5000).status, 'completed');
  service.dismiss();
  assert.equal(service.getTimer(), null);
});

test('minute adjustments change endsAt without changing the original source', () => {
  const service = createTimerService();
  const timer = service.start({ durationMinutes: 15, sourceEntryId: 'entry-2', sourceEntry: { type: 'Snack', mealCarbs: 10 } });
  const adjusted = service.adjustMinutes(1);
  assert.equal(adjusted.endsAt, timer.endsAt + 60 * 1000);
  assert.equal(adjusted.sourceEntryId, 'entry-2');
});
