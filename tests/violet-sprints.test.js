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

function builtInWorkoutsByName(api) {
  return Object.fromEntries(api.sourceDefinedWorkouts().map((workout) => [workout.name, workout]));
}

test('Futbol Game Timer is no longer a Violet Sprints built-in workout', () => {
  const { api } = createSprintsRuntime({ autoLoad: false });
  const workouts = api.sourceDefinedWorkouts();

  assert.equal(workouts.some((workout) => workout.id === 'futbol-game-timer'), false);
  assert.equal(workouts.some((workout) => workout.name === 'Futbol Game Timer'), false);
  assert.doesNotMatch(sprintsSource, /function futbolGameTimerWorkout/);
});

test('all canonical Violet Sprints workouts are source-defined and protected in workout-card actions', () => {
  const { api } = createSprintsRuntime({ autoLoad: false });
  const builtIns = builtInWorkoutsByName(api);

  assert.deepEqual(Object.keys(builtIns), [
    'Treadmill Sprints',
    'Soccer Match Simulation',
    'Tabata',
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

test('fresh and existing storage omit the source-defined Futbol preset without deleting custom workouts', () => {
  const fresh = createSprintsRuntime();
  const freshStored = JSON.parse(fresh.localStorage.getItem(fresh.api.STORAGE_KEY));
  assert.deepEqual(freshStored.filter((workout) => workout.sourceDefined).map((workout) => workout.id), [
    'treadmill-sprints',
    'soccer-match-simulation',
    'tabata',
  ]);

  const oldBuiltIn = {
    id: 'futbol-game-timer',
    name: 'Futbol Game Timer',
    sourceDefined: true,
    blocks: [],
  };
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

  assert.equal(existingStored.some((workout) => workout.id === 'futbol-game-timer'), false);
  assert.ok(existingStored.some((workout) => workout.id === 'custom-futbol-name' && workout.name === 'Futbol Game Timer'));
  assert.equal(existingStored.filter((workout) => workout.name === 'Futbol Game Timer').length, 1);

  const oldExisting = createSprintsRuntime({
    localStorage: createLocalStorage({
      violet_sprints_workouts_v1: JSON.stringify([oldBuiltIn, customWorkout]),
    }),
  });
  const oldExistingStored = JSON.parse(oldExisting.localStorage.getItem(oldExisting.api.STORAGE_KEY));
  assert.equal(oldExistingStored.some((workout) => workout.id === 'futbol-game-timer'), false);
  assert.ok(oldExistingStored.some((workout) => workout.id === 'custom-futbol-name'));
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
