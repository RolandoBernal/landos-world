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

// --- Native mirror (Capacitor local notifications) ---

function createNativeTimerService({ native = true, initialDisplay = 'granted', requestedDisplay = 'granted' } = {}) {
  const values = new Map();
  const calls = { schedule: [], cancel: [], checkPermissions: 0, requestPermissions: 0 };
  const plugin = {
    checkPermissions: async () => { calls.checkPermissions += 1; return { display: initialDisplay }; },
    requestPermissions: async () => { calls.requestPermissions += 1; return { display: requestedDisplay }; },
    schedule: async (arg) => { calls.schedule.push(arg); },
    cancel: async (arg) => { calls.cancel.push(arg); },
  };
  const context = {
    localStorage: {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
    window: {
      Capacitor: {
        isNativePlatform: () => native,
        Plugins: { LocalNotifications: plugin },
      },
    },
    Date,
    Number,
    JSON,
    Math,
  };
  vm.runInNewContext(fs.readFileSync('js/lee-lee-pre-meal-timer.js', 'utf8'), context);
  return { service: context.window.LeeLeePreMealTimer, calls };
}

async function flushNative() {
  for (let i = 0; i < 3; i += 1) await new Promise((resolve) => setImmediate(resolve));
}

test('native: starting a pre-meal timer schedules one notification at endsAt', async () => {
  const { service, calls } = createNativeTimerService();
  const timer = service.start({ durationMinutes: 15, sourceEntryId: 'entry-3', sourceEntry: { type: 'Lunch', mealCarbs: 30 } });
  await flushNative();
  assert.equal(calls.checkPermissions, 1);
  assert.equal(calls.requestPermissions, 0);
  assert.equal(calls.schedule.length, 1);
  const [notification] = calls.schedule[0].notifications;
  assert.equal(notification.id, 7331);
  assert.equal(notification.title, 'Pre-Meal Timer');
  assert.equal(notification.body, 'Ready to eat.');
  assert.equal(notification.schedule.at.getTime(), timer.endsAt);
  assert.equal(notification.schedule.allowWhileIdle, true);
  assert.equal(calls.cancel.length, 0);
});

test('native: low-glucose recheck timer uses the recheck copy and 15 minutes', async () => {
  const { service, calls } = createNativeTimerService();
  const startedAt = Date.now();
  service.start({ purpose: 'low-glucose-recheck', episodeId: 'ep-1', scheduleId: 'sch-1', startedAt, durationMinutes: 45, sourceEntryId: 'ep-1' });
  await flushNative();
  assert.equal(calls.schedule.length, 1);
  const [notification] = calls.schedule[0].notifications;
  assert.equal(notification.title, 'Recheck Glucose');
  assert.equal(notification.body, 'The 15-minute reminder has finished.');
  assert.equal(notification.schedule.at.getTime(), startedAt + 15 * 60 * 1000);
});

test('native: stopping or dismissing the timer cancels the notification', async () => {
  const { service, calls } = createNativeTimerService();
  service.start({ durationMinutes: 15, sourceEntryId: 'entry-4' });
  await flushNative();
  service.stop();
  await flushNative();
  assert.equal(calls.cancel.length, 1);
  assert.equal(calls.cancel[0].notifications.length, 1);
  assert.equal(calls.cancel[0].notifications[0].id, 7331);
  service.start({ durationMinutes: 15, sourceEntryId: 'entry-5' });
  await flushNative();
  assert.equal(calls.schedule.length, 2);
  service.dismiss();
  await flushNative();
  assert.equal(calls.cancel.length, 2);
});

test('native: adjusting the timer reschedules the notification', async () => {
  const { service, calls } = createNativeTimerService();
  const timer = service.start({ durationMinutes: 15, sourceEntryId: 'entry-6' });
  await flushNative();
  const adjusted = service.adjustMinutes(5);
  await flushNative();
  assert.equal(calls.schedule.length, 2);
  assert.equal(calls.schedule[1].notifications[0].schedule.at.getTime(), adjusted.endsAt);
  assert.equal(adjusted.endsAt, timer.endsAt + 5 * 60 * 1000);
});

test('native: permission is requested when prompted, and denial skips scheduling', async () => {
  const prompted = createNativeTimerService({ initialDisplay: 'prompt', requestedDisplay: 'granted' });
  prompted.service.start({ durationMinutes: 15, sourceEntryId: 'entry-7' });
  await flushNative();
  assert.equal(prompted.calls.requestPermissions, 1);
  assert.equal(prompted.calls.schedule.length, 1);

  const denied = createNativeTimerService({ initialDisplay: 'denied' });
  denied.service.start({ durationMinutes: 15, sourceEntryId: 'entry-8' });
  await flushNative();
  assert.equal(denied.calls.requestPermissions, 0);
  assert.equal(denied.calls.schedule.length, 0);

  const deniedAfterPrompt = createNativeTimerService({ initialDisplay: 'prompt', requestedDisplay: 'denied' });
  deniedAfterPrompt.service.start({ durationMinutes: 15, sourceEntryId: 'entry-9' });
  await flushNative();
  assert.equal(deniedAfterPrompt.calls.requestPermissions, 1);
  assert.equal(deniedAfterPrompt.calls.schedule.length, 0);
});

test('native: no plugin calls when the shell is not native', async () => {
  const { service, calls } = createNativeTimerService({ native: false });
  service.start({ durationMinutes: 15, sourceEntryId: 'entry-10' });
  service.adjustMinutes(1);
  service.stop();
  service.dismiss();
  await flushNative();
  assert.equal(calls.checkPermissions, 0);
  assert.equal(calls.schedule.length, 0);
  assert.equal(calls.cancel.length, 0);
});
