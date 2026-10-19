import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../js/launcher-preferences.js';
const api = globalThis.LandosLauncherPreferences;
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const registry = html.split('const APP_CARDS = [')[1].split('const WEATHER_CONFIG')[0];
const ids = [...registry.matchAll(/id: '([^']+)'/g)].map((match) => match[1]);
function fixture(raw = null) {
  let value = raw;
  let fail = false;
  const writes = [];
  const storage = { getItem: () => value, setItem: (key, next) => { if (fail) throw Error('quota'); writes.push(key); value = next; } };
  return { store: api.createStore(ids, () => storage), writes, set: (next) => { value = next; }, fail: () => { fail = true; }, raw: () => value };
}
const config = (visible = ids, order = ids) => ({ schemaVersion: 1, visibleAppIds: visible, appOrder: order });
test('missing preserves complete registry order without any write', () => {
  assert.equal(ids.length, 8);
  const f = fixture();
  assert.deepEqual(f.store.read(), { status: 'missing', preferences: config() });
  assert.deepEqual(f.writes, []);
});
test('recommended exact order, remaining saved order preserved', () => {
  const p = api.recommended(config(ids, [...ids].reverse()), ids);
  assert.deepEqual(p.visibleAppIds, ['digital-clock', 'weather', 'lee-lees-tracker']);
  assert.deepEqual(p.appOrder.slice(3), [...ids].reverse().filter((id) => !api.RECOMMENDED_IDS.includes(id)));
});
test('normalization removes duplicates/unknown IDs and appends new apps hidden', () => {
  const p = api.normalize(config(['weather', 'weather', 'unknown'], ['unknown', 'weather', 'weather']), [...ids, 'new-app']);
  assert.deepEqual(p.visibleAppIds, ['weather']);
  assert.deepEqual(p.appOrder, [...ids, 'new-app']);
  assert.deepEqual(api.normalize(p, ids.filter((id) => id !== 'weather')).visibleAppIds, []);
});
test('empty is intentional and serialization/persistence deterministic', () => {
  const f = fixture();
  f.store.change(() => config([]));
  assert.equal(f.raw(), JSON.stringify(config([])));
  assert.deepEqual(f.store.read().preferences.visibleAppIds, []);
  assert.deepEqual(f.writes, [api.STORAGE_KEY]);
});
for (const raw of ['{', 'null', '{}', JSON.stringify({ schemaVersion: 1, visibleAppIds: [3], appOrder: [] })]) {
  test(`invalid preferences preserved until an explicit edit: ${raw}`, () => {
    const f = fixture(raw);
    assert.equal(f.store.read().status, 'invalid');
    assert.equal(f.raw(), raw);
    assert.deepEqual(f.store.read().preferences, config());
    assert.equal(f.store.change(() => config([])).status, 'saved');
  });
}
test('newer schema is never overwritten', () => {
  const raw = JSON.stringify({ schemaVersion: 2 });
  const f = fixture(raw);
  assert.equal(f.store.change(() => config([])).status, 'unsupported');
  assert.equal(f.raw(), raw);
});
test('read restrictions and failed writes retain session changes honestly', () => {
  const denied = api.createStore(ids, () => { throw Error('denied'); });
  assert.equal(denied.read().status, 'unavailable');
  assert.equal(denied.change(() => config([])).status, 'unsaved');
  assert.deepEqual(denied.read().preferences.visibleAppIds, []);
  const f = fixture(); f.fail();
  assert.equal(f.store.change(() => config([])).status, 'unsaved');
  assert.equal(f.raw(), null);
  assert.deepEqual(f.store.read().preferences.visibleAppIds, []);
});
test('mutations read latest external state and protect future schemas', () => {
  const f = fixture(); f.store.read();
  f.set(JSON.stringify(config(['weather'], [...ids].reverse())));
  const result = f.store.change((p) => ({ ...p, visibleAppIds: [...p.visibleAppIds, 'digital-clock'] }));
  assert.deepEqual(result.preferences.appOrder, [...ids].reverse());
  assert.deepEqual(new Set(result.preferences.visibleAppIds), new Set(['weather', 'digital-clock']));
  f.set('{"schemaVersion":9}');
  assert.equal(f.store.change(() => config([])).status, 'unsupported');
});
test('moves are clamped, pure, persistent and visible reorder preserves hidden slots', () => {
  const p = config(['weather', 'digital-clock']);
  const moved = api.move(p, 'weather', 99, ids);
  assert.equal(moved.appOrder.at(-1), 'weather');
  assert.deepEqual(p.appOrder, ids);
  const next = api.reorderVisible(p, ['digital-clock', 'weather'], ids);
  assert.deepEqual(next.appOrder, ['digital-clock', 'weather', ...ids.slice(2)]);
  assert.deepEqual(api.move(p, 'absent', 0, ids), p);
});

for (const [name, id, from, to] of [
  ['move down', ids[0], 0, 1], ['move up', ids[1], 1, 0],
  ['move first to last', ids[0], 0, 7], ['move last to first', ids[7], 7, 0],
]) {
  test(`ordering: ${name} preserves visibility and other relative positions`, () => {
    const p = config([ids[0], ids[2]]);
    const moved = api.move(p, id, to, ids);
    const expected = [...ids]; expected.splice(from, 1); expected.splice(to, 0, id);
    assert.deepEqual(moved.appOrder, expected);
    assert.deepEqual(new Set(moved.visibleAppIds), new Set(p.visibleAppIds));
    assert.deepEqual(p.appOrder, ids);
  });
}
test('ordering hidden apps persists and reloads, visibility edits keep positions', () => {
  const f = fixture(JSON.stringify(config([ids[0]])));
  const moved = f.store.change((p) => api.move(p, ids[7], 0, ids)).preferences;
  assert.deepEqual(moved.visibleAppIds, [ids[0]]);
  assert.equal(moved.appOrder[0], ids[7]);
  const enabled = f.store.change((p) => ({ ...p, visibleAppIds: [...p.visibleAppIds, ids[7]] })).preferences;
  assert.deepEqual(enabled.appOrder, moved.appOrder);
  assert.deepEqual(enabled.visibleAppIds, [ids[7], ids[0]]);
  assert.deepEqual(fixture(f.raw()).store.read().preferences, enabled);
});
test('ordering boundary/no-op changes avoid redundant writes', () => {
  const f = fixture(JSON.stringify(config()));
  f.store.change((p) => api.move(p, ids[0], -10, ids));
  f.store.change((p) => api.move(p, ids[7], 99, ids));
  assert.deepEqual(f.writes, []);
  f.store.change((p) => api.move(p, ids[0], 1, ids));
  f.store.change((p) => api.move(p, ids[0], 1, ids));
  assert.deepEqual(f.writes, [api.STORAGE_KEY]);
});
test('ordering normalizes old saved arrays without losing valid custom order', () => {
  const f = fixture(JSON.stringify(config(['unknown', ids[2], ids[2]], [ids[7], ids[7], 'unknown', ids[2]])));
  assert.deepEqual(f.store.read().preferences.appOrder, [ids[7], ids[2], ...ids.filter((id) => id !== ids[7] && id !== ids[2])]);
  assert.deepEqual(f.store.read().preferences.visibleAppIds, [ids[2]]);
  assert.deepEqual(api.decode(JSON.stringify(config([], [])), ids).preferences, config([], ids));
});
test('ordering storage failures keep custom session order and never touch other keys', () => {
  const f = fixture(JSON.stringify(config([ids[2]]))); f.fail();
  const result = f.store.change((p) => api.move(p, ids[7], 0, ids));
  assert.equal(result.status, 'unsaved');
  assert.equal(f.store.read().preferences.appOrder[0], ids[7]);
  assert.deepEqual(f.store.read().preferences.visibleAppIds, [ids[2]]);
  assert.deepEqual(JSON.parse(f.raw()), config([ids[2]]));
  assert.deepEqual(f.writes, []);
});
