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

function createSprintsRuntime({ localStorage = createLocalStorage(), autoLoad = true } = {}) {
  const documentListeners = {};
  const intervals = new Map();
  let intervalId = 0;
  const sprintsRoot = createRoot();
  const context = {
    console: {
      ...console,
      warn: () => {},
      log: () => {},
    },
    Date,
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
    intervals,
    localStorage,
  };
}

function futbolWorkout(api) {
  return api.sourceDefinedWorkouts().find((workout) => workout.id === 'futbol-game-timer');
}

function tick(intervals, count = 1) {
  for (let index = 0; index < count; index += 1) {
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
    ['Half Time', 15 * 60, '15:00'],
    ['Second Half', 40 * 60, '40:00'],
  ]);
  assert.equal(api.totalWorkoutDuration(steps), 95 * 60);
});

test('fresh and existing storage both include the source-defined Futbol preset without deleting custom workouts', () => {
  const fresh = createSprintsRuntime();
  const freshStored = JSON.parse(fresh.localStorage.getItem(fresh.api.STORAGE_KEY));
  assert.ok(freshStored.some((workout) => workout.id === 'futbol-game-timer'));

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

test('Futbol Game Timer uses the existing timer engine for transitions, pause resume, and warnings', () => {
  const { api, intervals } = createSprintsRuntime({ autoLoad: false });
  const updates = [];
  const timer = api.createWorkoutTimer(futbolWorkout(api), {
    onUpdate: (state) => updates.push({ ...state }),
  });

  timer.start();
  assert.equal(updates.at(-1).workoutName, 'Futbol Game Timer');
  assert.equal(updates.at(-1).blockTitle, 'First Half');
  assert.equal(updates.at(-1).stepLabel, 'First Half');
  assert.equal(updates.at(-1).countdown, '40:00');
  assert.equal(updates.at(-1).remaining, '95:00');

  tick(intervals, 2390);
  assert.equal(updates.at(-1).countdown, '00:10');
  timer.pause();
  const pausedAt = updates.at(-1).countdown;
  tick(intervals, 3);
  assert.equal(updates.at(-1).countdown, pausedAt);
  timer.resume();
  assert.equal(updates.at(-1).countdown, pausedAt);

  tick(intervals, 5);
  assert.equal(updates.at(-1).countdown, '00:05');
  assert.equal(updates.at(-1).warningActive, true);

  tick(intervals, 5);
  assert.equal(updates.at(-1).blockTitle, 'Half Time');
  assert.equal(updates.at(-1).stepLabel, 'Half Time');
  assert.equal(updates.at(-1).countdown, '15:00');

  tick(intervals, 900);
  assert.equal(updates.at(-1).blockTitle, 'Second Half');
  assert.equal(updates.at(-1).stepLabel, 'Second Half');
  assert.equal(updates.at(-1).countdown, '40:00');

  tick(intervals, 2400);
  assert.equal(updates.at(-1).complete, true);
});
