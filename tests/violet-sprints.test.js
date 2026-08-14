import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const sprintsSource = readFileSync(new URL('../js/sprints-app.js', import.meta.url), 'utf8');

function createLocalStorage(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem: (key) => store.get(key) || null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    dump: () => Object.fromEntries(store),
  };
}

function createRoot() {
  return {
    hidden: false,
    innerHTML: '',
    appended: [],
    cloneNode() {
      return createRoot();
    },
    replaceWith(next) {
      this.replacement = next;
    },
    addEventListener() {},
    appendChild(child) {
      this.appended.push(child);
    },
    querySelector() {
      return null;
    },
  };
}

function createSprintsRuntime({ localStorage = createLocalStorage(), autoLoad = true, now = 1_800_000_000_000 } = {}) {
  const documentListeners = {};
  const intervals = new Map();
  let intervalId = 0;
  const sprintsRoot = createRoot();
  let currentTime = now;
  class MockDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [currentTime]));
    }

    static now() {
      return currentTime;
    }
  }
  Object.setPrototypeOf(MockDate, Date);
  const context = {
    console: {
      ...console,
      warn: () => {},
      log: () => {},
    },
    Date: MockDate,
    JSON,
    Map,
    Math,
    Number,
    Object,
    Promise,
    String,
    clearInterval(id) {
      intervals.delete(id);
    },
    clearTimeout() {},
    document: {
      activeElement: null,
      body: {
        appendChild() {},
      },
      addEventListener(type, handler) {
        documentListeners[type] = handler;
      },
      createElement() {
        return {
          dataset: {},
          addEventListener() {},
          remove() {},
        };
      },
      getElementById(id) {
        if (id === 'sprints-view') return sprintsRoot;
        return null;
      },
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      visibilityState: 'visible',
    },
    localStorage,
    location: {
      hash: '',
    },
    navigator: {
      platform: 'MacIntel',
      userAgent: 'node-test',
      maxTouchPoints: 0,
      standalone: false,
    },
    setInterval(fn) {
      intervalId += 1;
      intervals.set(intervalId, fn);
      return intervalId;
    },
    setTimeout(fn) {
      fn();
      return 1;
    },
    window: null,
  };
  context.window = context;
  context.globalThis = context;
  context.matchMedia = () => ({ matches: false });
  vm.runInNewContext(sprintsSource, context);
  if (autoLoad) documentListeners.DOMContentLoaded?.();
  return {
    api: context.VioletSprints,
    context,
    advanceTime(seconds) {
      currentTime += seconds * 1000;
    },
    intervals,
    localStorage,
  };
}

function futbolWorkout(api) {
  return api.sourceDefinedWorkouts().find((workout) => workout.id === 'futbol-game-timer');
}

function builtInWorkoutsByName(api) {
  return Object.fromEntries(api.sourceDefinedWorkouts().map((workout) => [workout.name, workout]));
}

function tick(intervals, count = 1, advanceTime = () => {}) {
  for (let index = 0; index < count; index += 1) {
    advanceTime(1);
    const callbacks = [...intervals.values()];
    callbacks.forEach((callback) => callback());
  }
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('Futbol Game Timer is a source-defined built-in workout with the regulation sequence', () => {
  const { api } = createSprintsRuntime({ autoLoad: false });
  const workout = futbolWorkout(api);
  const steps = api.stepsForWorkout(workout);

  assert.equal(workout.id, 'futbol-game-timer');
  assert.equal(workout.name, 'Futbol Game Timer');
  assert.equal(workout.sourceDefined, true);
  assert.deepEqual(plain(workout.blocks.map((block) => [block.title, block.type])), [
    ['First Half', 'work'],
    ['Half Time', 'recovery'],
    ['Second Half', 'work'],
  ]);
  assert.deepEqual(plain(steps.map((step) => [step.label, step.duration, api.formatDuration(step.duration)])), [
    ['First Half', 40 * 60, '40:00'],
    ['Half Time', 10 * 60, '10:00'],
    ['Second Half', 40 * 60, '40:00'],
  ]);
  assert.equal(api.totalWorkoutDuration(steps), 90 * 60);
});

test('all canonical Violet Sprints workouts are source-defined and protected in workout-card actions', () => {
  const { api } = createSprintsRuntime({ autoLoad: false });
  const builtIns = builtInWorkoutsByName(api);

  assert.deepEqual(Object.keys(builtIns), [
    'Treadmill Sprints',
    'Soccer Match Simulation',
    'Tabata',
    'Futbol Game Timer',
  ]);

  Object.values(builtIns).forEach((workout) => {
    assert.equal(api.isBuiltInWorkout(workout), true, `${workout.name} should be built in`);
    const html = api.renderWorkoutListItem(workout);
    assert.match(html, /data-action="view"/);
    assert.match(html, /data-action="start"/);
    assert.match(html, /data-action="duplicate"/);
    assert.doesNotMatch(html, /data-action="delete"/);
  });
});

test('fresh and existing storage both include the source-defined Futbol preset without deleting custom workouts', () => {
  const fresh = createSprintsRuntime();
  const freshStored = JSON.parse(fresh.localStorage.getItem(fresh.api.STORAGE_KEY));
  assert.deepEqual(freshStored.filter((workout) => workout.sourceDefined).map((workout) => workout.id), [
    'treadmill-sprints',
    'soccer-match-simulation',
    'tabata',
    'futbol-game-timer',
  ]);

  const customWorkout = {
    id: 'custom-futbol-name',
    name: 'Futbol Game Timer',
    steps: [{ id: 'custom-step', label: 'Custom Section', duration: 123 }],
  };
  const existing = createSprintsRuntime({
    localStorage: createLocalStorage({
      violet_sprints_workouts_v1: JSON.stringify([customWorkout]),
    }),
  });
  const existingStored = JSON.parse(existing.localStorage.getItem(existing.api.STORAGE_KEY));

  assert.ok(existingStored.some((workout) => workout.id === 'futbol-game-timer' && workout.sourceDefined === true));
  assert.ok(existingStored.some((workout) => workout.id === 'custom-futbol-name' && workout.name === 'Futbol Game Timer'));
  assert.equal(existingStored.filter((workout) => workout.name === 'Futbol Game Timer').length, 2);
});

test('existing canonical default workouts are normalized to protected built-ins without deleting custom workouts', () => {
  const { api } = createSprintsRuntime({ autoLoad: false });
  const legacyDefaults = api.defaultWorkouts().map((workout) => {
    const legacy = JSON.parse(JSON.stringify(workout));
    delete legacy.sourceDefined;
    if (legacy.id === 'treadmill-sprints') legacy.id = 'legacy-treadmill-random';
    if (legacy.id === 'soccer-match-simulation') legacy.id = 'legacy-soccer-random';
    if (legacy.id === 'tabata') legacy.id = 'legacy-tabata-random';
    return legacy;
  }).filter((workout) => workout.name !== 'Futbol Game Timer');
  const custom = {
    id: 'custom-workout',
    name: 'Tabata',
    steps: [{ id: 'custom-step', label: 'Custom', duration: 30 }],
  };
  const existing = createSprintsRuntime({
    localStorage: createLocalStorage({
      violet_sprints_workouts_v1: JSON.stringify([...legacyDefaults, custom]),
    }),
  });
  const stored = JSON.parse(existing.localStorage.getItem(existing.api.STORAGE_KEY));

  assert.deepEqual(stored.filter((workout) => workout.sourceDefined).map((workout) => workout.id), [
    'treadmill-sprints',
    'soccer-match-simulation',
    'tabata',
    'futbol-game-timer',
  ]);
  assert.ok(stored.some((workout) => workout.id === 'custom-workout' && workout.name === 'Tabata'));
});

test('built-in deletion is rejected while user-created workout deletion still works', async () => {
  const { api, localStorage } = createSprintsRuntime();
  const beforeBuiltInDelete = JSON.parse(localStorage.getItem(api.STORAGE_KEY));
  const rejected = await api.deleteWorkout('tabata', { confirm: () => Promise.resolve(true) });
  const afterBuiltInDelete = JSON.parse(localStorage.getItem(api.STORAGE_KEY));

  assert.equal(rejected, false);
  assert.ok(afterBuiltInDelete.some((workout) => workout.id === 'tabata'));
  assert.deepEqual(afterBuiltInDelete.map((workout) => workout.id), beforeBuiltInDelete.map((workout) => workout.id));

  const custom = api.createWorkout('My Custom Workout', [{ id: 'custom-step', label: 'Walk', duration: 60 }]);
  const merged = [...afterBuiltInDelete, custom];
  localStorage.setItem(api.STORAGE_KEY, JSON.stringify(merged));
  api.loadWorkouts();

  const customHtml = api.renderWorkoutListItem(custom);
  assert.equal(api.isBuiltInWorkout(custom), false);
  assert.match(customHtml, /data-action="delete"/);

  const deleted = await api.deleteWorkout(custom.id, { confirm: () => Promise.resolve(true) });
  const afterCustomDelete = JSON.parse(localStorage.getItem(api.STORAGE_KEY));
  assert.equal(deleted, true);
  assert.equal(afterCustomDelete.some((workout) => workout.id === custom.id), false);
});

test('duplicates of built-in and user-created workouts become deletable user-created workouts', () => {
  const { api } = createSprintsRuntime({ autoLoad: false });
  Object.values(builtInWorkoutsByName(api)).forEach((workout) => {
    const copy = api.duplicateWorkout(workout);
    assert.equal(api.isBuiltInWorkout(copy), false, `${workout.name} copy should be user-created`);
    assert.match(api.renderWorkoutListItem(copy), /data-action="delete"/);
  });

  const custom = api.createWorkout('Custom Hills', [{ id: 'hill', label: 'Hill', duration: 45 }]);
  const customCopy = api.duplicateWorkout(custom);
  assert.equal(api.isBuiltInWorkout(customCopy), false);
  assert.match(api.renderWorkoutListItem(customCopy), /data-action="delete"/);
});

test('Futbol Game Timer uses the existing timer engine for transitions, pause resume, and warnings', () => {
  const { api, intervals, advanceTime } = createSprintsRuntime({ autoLoad: false });
  const updates = [];
  const timer = api.createWorkoutTimer(futbolWorkout(api), {
    onUpdate: (state) => updates.push({ ...state }),
  });

  timer.start();
  assert.equal(updates.at(-1).workoutName, 'Futbol Game Timer');
  assert.equal(updates.at(-1).blockTitle, 'First Half');
  assert.equal(updates.at(-1).stepLabel, 'First Half');
  assert.equal(updates.at(-1).countdown, '40:00');
  assert.equal(updates.at(-1).remaining, '90:00');

  tick(intervals, 2390, advanceTime);
  assert.equal(updates.at(-1).countdown, '00:10');
  timer.pause();
  const pausedAt = updates.at(-1).countdown;
  tick(intervals, 3, advanceTime);
  assert.equal(updates.at(-1).countdown, pausedAt);
  timer.resume();
  assert.equal(updates.at(-1).countdown, pausedAt);

  tick(intervals, 5, advanceTime);
  assert.equal(updates.at(-1).countdown, '00:05');
  assert.equal(updates.at(-1).warningActive, true);

  tick(intervals, 5, advanceTime);
  assert.equal(updates.at(-1).blockTitle, 'Half Time');
  assert.equal(updates.at(-1).stepLabel, 'Half Time');
  assert.equal(updates.at(-1).countdown, '10:00');

  tick(intervals, 600, advanceTime);
  assert.equal(updates.at(-1).blockTitle, 'Second Half');
  assert.equal(updates.at(-1).stepLabel, 'Second Half');
  assert.equal(updates.at(-1).countdown, '40:00');

  tick(intervals, 2400, advanceTime);
  assert.equal(updates.at(-1).complete, true);
});

test('running timers reconcile from wall-clock time across multiple elapsed steps', () => {
  const { api, advanceTime } = createSprintsRuntime({ autoLoad: false });
  const updates = [];
  const timer = api.createWorkoutTimer(futbolWorkout(api), {
    onUpdate: (state) => updates.push({ ...state }),
  });

  timer.start();
  advanceTime((38 * 60) + (17 * 60));
  timer.reconcile({ sound: false, persist: true });

  assert.equal(updates.at(-1).blockTitle, 'Second Half');
  assert.equal(updates.at(-1).stepLabel, 'Second Half');
  assert.equal(updates.at(-1).countdown, '35:00');
  assert.equal(updates.at(-1).remaining, '35:00');
});

test('paused timers preserve remaining time while wall-clock time advances', () => {
  const { api, intervals, advanceTime } = createSprintsRuntime({ autoLoad: false });
  const updates = [];
  const timer = api.createWorkoutTimer(futbolWorkout(api), {
    onUpdate: (state) => updates.push({ ...state }),
  });

  timer.start();
  tick(intervals, (21 * 60) + 37, advanceTime);
  timer.pause();
  assert.equal(updates.at(-1).countdown, '18:23');

  advanceTime(10 * 60);
  timer.reconcile({ sound: false, persist: true });
  assert.equal(updates.at(-1).paused, true);
  assert.equal(updates.at(-1).countdown, '18:23');

  timer.resume();
  advanceTime(23);
  timer.reconcile({ sound: false, persist: true });
  assert.equal(updates.at(-1).countdown, '18:00');
});

test('active timer state is persisted with timestamps and restored accurately', () => {
  const localStorage = createLocalStorage();
  const firstRuntime = createSprintsRuntime({ autoLoad: false, localStorage, now: 1_900_000_000_000 });
  const firstUpdates = [];
  const firstTimer = firstRuntime.api.createWorkoutTimer(futbolWorkout(firstRuntime.api), {
    onUpdate: (state) => firstUpdates.push({ ...state }),
  });

  firstTimer.start();
  firstRuntime.advanceTime(20 * 60);
  firstTimer.reconcile({ sound: false, persist: true });
  const persisted = JSON.parse(localStorage.getItem(firstRuntime.api.ACTIVE_TIMER_KEY));
  assert.equal(persisted.workoutId, 'futbol-game-timer');
  assert.equal(persisted.phase, 'running');
  assert.equal(persisted.stepIndex, 0);
  assert.equal(persisted.stepEndsAt - persisted.stepStartedAt, 40 * 60 * 1000);

  const secondRuntime = createSprintsRuntime({ autoLoad: false, localStorage, now: 1_900_000_000_000 + (27 * 60 * 1000) });
  const restoredUpdates = [];
  const restoredTimer = secondRuntime.api.createWorkoutTimer(futbolWorkout(secondRuntime.api), {
    onUpdate: (state) => restoredUpdates.push({ ...state }),
  }, { restoreState: persisted });
  restoredTimer.start();

  assert.equal(restoredUpdates.at(-1).blockTitle, 'First Half');
  assert.equal(restoredUpdates.at(-1).countdown, '13:00');
});

test('manual skip advances exactly one step and resets the next step timestamp', () => {
  const { api, localStorage, advanceTime } = createSprintsRuntime({ autoLoad: false });
  const updates = [];
  const timer = api.createWorkoutTimer(futbolWorkout(api), {
    onUpdate: (state) => updates.push({ ...state }),
  });

  timer.start();
  advanceTime(7 * 60);
  timer.skip();

  assert.equal(updates.at(-1).blockTitle, 'Half Time');
  assert.equal(updates.at(-1).stepLabel, 'Half Time');
  assert.equal(updates.at(-1).countdown, '10:00');

  const persisted = JSON.parse(localStorage.getItem(api.ACTIVE_TIMER_KEY));
  assert.equal(persisted.stepIndex, 1);
  assert.equal(persisted.stepEndsAt - persisted.stepStartedAt, 10 * 60 * 1000);
});
