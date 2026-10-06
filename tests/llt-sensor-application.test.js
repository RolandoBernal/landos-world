import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
function modules(extra = {}) {
  const context = {
    Date,
    JSON,
    Math,
    Number,
    String,
    Object,
    Set,
    Promise,
    Intl,
    Error,
    crypto: { randomUUID },
    navigator: { onLine: true },
    ...extra,
  };
  vm.createContext(context);
  for (const file of [
    "lee-lee-dexcom-sensor",
    "lee-lee-sensor-sync",
    "lee-lee-deadline-alerts",
  ])
    vm.runInContext(fs.readFileSync(`js/${file}.js`, "utf8"), context);
  return context;
}
const D = modules().LeeLeeDexcomSensor,
  H = 3600000;
const cycle = (start = "2026-03-01T12:00:00Z", id = "cycle") => ({
  id,
  user_id: "A",
  sensor_type: D.MODEL,
  started_at: start,
  state: "current",
  ended_at: null,
  cancelled_at: null,
  previous_cycle_id: null,
  revision: 1,
});
const c = cycle(),
  start = Date.parse(c.started_at);
for (const [label, offset, status] of [
  ["active", 0, "active"],
  ["before reminder", 216 * H - 1, "active"],
  ["exact reminder", 216 * H, "approaching"],
  ["inside reminder", 220 * H, "approaching"],
  ["exact expiration", 240 * H, "grace"],
  ["inside grace", 245 * H, "grace"],
  ["exact grace end", 252 * H, "expired"],
  ["after grace", 260 * H, "expired"],
])
  test(`lifecycle ${label}`, () =>
    assert.equal(D.lifecycle(c, start + offset).status, status));
test("no sensor and cancelled cycle have no lifecycle", () => {
  assert.equal(D.lifecycle(null).status, "none");
  assert.equal(D.lifecycle({ ...c, state: "cancelled" }).status, "none");
});
test("closed early classification and restored expired predecessor", () => {
  assert.equal(
    D.lifecycle({
      ...c,
      state: "closed",
      ended_at: new Date(start + 50 * H).toISOString(),
    }).early,
    true,
  );
  assert.equal(D.lifecycle(c, start + 260 * H).status, "expired");
});
test("correction changes derived deadlines and milestone identities", () => {
  const edited = { ...c, started_at: "2026-03-02T12:00:00Z" };
  assert.equal(D.lifecycle(edited).expires - D.lifecycle(c).expires, 24 * H);
  assert.notEqual(D.milestones(c, "A")[0].id, D.milestones(edited, "A")[0].id);
  assert.equal(
    D.milestones(c, "A")[0].id,
    D.milestones({ ...c, revision: 8 }, "A")[0].id,
  );
});
for (const date of [
  "2026-03-07T12:00:00-06:00",
  "2026-10-31T12:00:00-05:00",
  "2026-12-31T23:59:00Z",
  "2028-02-29T23:59:00Z",
  "2026-01-31T23:59:00Z",
])
  test(`elapsed lifetime across ${date}`, () => {
    const d = D.lifecycle(cycle(date));
    assert.equal(d.expires - d.start, 240 * H);
    assert.equal(d.graceEnd - d.expires, 12 * H);
  });
test("local fields default to supplied now and retain editable components", () => {
  const v = D.localFields(start);
  assert.equal(D.wallCandidates(v.date, v.time).includes(start), true);
  assert.equal(D.wallCandidates("2026-02-30", "10:00").length, 0);
});
test("DST gap rejected and repeated hour resolves into two instants", () => {
  const old = process.env.TZ;
  process.env.TZ = "America/Chicago";
  try {
    assert.equal(D.wallCandidates("2026-03-08", "02:30").length, 0);
    const values = D.wallCandidates("2026-11-01", "01:30");
    assert.equal(values.length, 2);
    assert.equal(values[1] - values[0], H);
  } finally {
    if (old === undefined) delete process.env.TZ;
    else process.env.TZ = old;
  }
});
test("timezone display changes without changing absolute lifetime", () => {
  const a = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      hour: "numeric",
    }).format(start),
    b = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      hour: "numeric",
    }).format(start);
  assert.notEqual(a, b);
  assert.equal(D.lifecycle(c).expires, start + 240 * H);
});
test("snapshot rejects foreign owner, wrong pointer and two current cycles", () => {
  for (const bad of [
    { revision: 1, currentCycleId: "missing", cycles: [c] },
    { revision: 1, currentCycleId: c.id, cycles: [c, { ...c, id: "other" }] },
    { revision: 1, currentCycleId: c.id, cycles: [{ ...c, user_id: "B" }] },
  ])
    assert.throws(() => D.validate(bad, "A"));
});
function setup({ rpc, storageFails = false, seed = {}, online = true } = {}) {
  const store = new Map(Object.entries(seed));
  let isOnline = online;
  const storage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => {
      if (storageFails) throw Error("disk full");
      store.set(k, v);
    },
    removeItem: (k) => store.delete(k),
  };
  const ctx = modules(),
    locks = { request: async (k, fn) => fn() };
  const data = { revision: 0, currentCycleId: null, cycles: [] };
  let invalidated;
  const transport = {
    channel: () => ({
      on(event, filter, handler) {
        assert.equal(event, "postgres_changes");
        assert.equal(filter.table, "llt_sensor_contexts");
        invalidated = handler;
        return this;
      },
      subscribe() {
        return this;
      },
    }),
    removeChannel() {},
    rpc:
      rpc ||
      (async () => ({
        data: { status: "ok", snapshot: structuredClone(data) },
      })),
  };
  const client = ctx.LeeLeeSensorSync.create({
    storage,
    online: () => isOnline,
    locks,
  });
  return {
    client,
    store,
    transport,
    data,
    storage,
    invalidate: () => invalidated(),
    setOnline: (v) => {
      isOnline = v;
    },
  };
}
test("realtime invalidation refetches authoritative snapshot and tolerates unavailable cache", async () => {
  const s = await connected({ storageFails: true });
  assert.match(s.client.get().error, /cache could not be saved/);
  s.data.revision = 1;
  s.invalidate();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(s.client.get().snapshot.revision, 1);
  assert.equal(s.client.get().verified, true);
});
async function connected(options = {}) {
  const s = setup(options);
  s.client.connect({ uid: "A", client: s.transport });
  await s.client.refresh();
  return s;
}
test("initial unavailable vs verified empty snapshot", async () => {
  const s = setup();
  assert.equal(s.client.get().snapshot, null);
  s.client.connect({ uid: "A", client: s.transport });
  await s.client.refresh();
  assert.equal(s.client.get().verified, true);
  assert.equal(s.client.get().snapshot.currentCycleId, null);
});
test("cache restores offline without declaring a new authoritative fetch", () => {
  const seed = {
    "lando-world:llt-sensor:cache:v1:A": JSON.stringify({
      snapshot: { revision: 1, currentCycleId: c.id, cycles: [c] },
      lastFetchedAt: "2026-01-01T00:00:00Z",
    }),
  };
  const s = setup({ seed, online: false });
  s.client.connect({ uid: "A", client: s.transport });
  assert.equal(s.client.get().snapshot.currentCycleId, c.id);
  assert.equal(s.client.get().verified, false);
  assert.equal(s.client.get().offline, true);
});
test("offline mutation cannot become authoritative or auto-submit", async () => {
  const s = await connected();
  s.setOnline(false);
  const result = await s.client.submit({ p_action: "start" });
  assert.equal(result.status, "offline");
  assert.equal(s.client.get().pending, null);
  assert.equal(s.client.get().snapshot.revision, 0);
});
test("pending persistence failure prevents transport send", async () => {
  let writes = 0;
  const s = await connected({
    storageFails: true,
    rpc: async (name) => {
      if (name === "llt_mutate_sensor_cycle") writes++;
      return {
        data: {
          status: "ok",
          snapshot: { revision: 0, currentCycleId: null, cycles: [] },
        },
      };
    },
  });
  const result = await s.client.submit(
    s.client.request("start", { start: c.started_at }),
  );
  assert.equal(result.status, "storage_failed");
  assert.equal(writes, 0);
});
test("lost response retains exact request, blocks second mutation and retries same ID", async () => {
  let first = true;
  const sent = [];
  const s = await connected({
    rpc: async (name, p) => {
      if (name === "llt_get_sensor_snapshot")
        return {
          data: {
            status: "ok",
            snapshot: { revision: 0, currentCycleId: null, cycles: [] },
          },
        };
      sent.push(structuredClone(p));
      if (first) {
        first = false;
        throw Error("lost");
      }
      return {
        data: {
          status: "accepted",
          snapshot: { revision: 1, currentCycleId: c.id, cycles: [c] },
        },
      };
    },
  });
  const request = s.client.request("start", { start: c.started_at });
  assert.equal((await s.client.submit(request)).status, "unknown");
  assert.equal(
    (await s.client.submit({ ...request, p_operation_id: "new" })).status,
    "pending",
  );
  assert.equal((await s.client.submit()).status, "accepted");
  assert.equal(JSON.stringify(sent[0]), JSON.stringify(sent[1]));
  assert.equal(s.client.get().pending, null);
});
test("conflict retains authoritative snapshot without auto-rebase", async () => {
  const s = await connected({
    rpc: async (name) =>
      name === "llt_get_sensor_snapshot"
        ? {
            data: {
              status: "ok",
              snapshot: { revision: 0, currentCycleId: null, cycles: [] },
            },
          }
        : {
            data: {
              status: "conflict",
              reason: "stale_context",
              snapshot: { revision: 1, currentCycleId: c.id, cycles: [c] },
            },
          },
  });
  const old = s.client.request("start", { start: c.started_at });
  const result = await s.client.submit(old);
  assert.equal(result.status, "conflict");
  assert.equal(s.client.get().snapshot.revision, 1);
  assert.equal(old.p_expected_revision, 0);
  assert.equal(s.client.get().pending, null);
});
test("sign-out and account switch hide previous account cache", async () => {
  const s = await connected();
  s.client.connect(null);
  assert.equal(s.client.get().uid, null);
  assert.equal(s.client.get().snapshot, null);
  s.client.connect({ uid: "B", client: s.transport });
  await s.client.refresh();
  assert.equal(s.client.get().uid, "B");
  assert.equal(s.client.get().snapshot.cycles.length, 0);
});
test("late signed-out response cannot repopulate sensor cache", async () => {
  let resolve;
  const s = setup({
    rpc: () =>
      new Promise((r) => {
        resolve = r;
      }),
  });
  s.client.connect({ uid: "A", client: s.transport });
  s.client.connect(null);
  resolve({
    data: {
      status: "ok",
      snapshot: { revision: 1, currentCycleId: c.id, cycles: [c] },
    },
  });
  await Promise.resolve();
  assert.equal(s.client.get().snapshot, null);
});
test("older snapshot cannot regress cache and equal-revision disagreement is surfaced", async () => {
  let data = { revision: 1, currentCycleId: c.id, cycles: [c] };
  const s = await connected({
    rpc: async () => ({
      data: { status: "ok", snapshot: structuredClone(data) },
    }),
  });
  data = { revision: 0, currentCycleId: null, cycles: [] };
  await s.client.refresh();
  assert.equal(s.client.get().snapshot.revision, 1);
  data = {
    revision: 1,
    currentCycleId: c.id,
    cycles: [{ ...c, started_at: "2026-03-02T12:00:00Z" }],
  };
  await s.client.refresh();
  assert.match(s.client.get().error, /disagrees/);
  assert.equal(s.client.get().snapshot.cycles[0].started_at, c.started_at);
});
test("pending exact request restores after reload only under same account", async () => {
  const request = { p_operation_id: "fixed", p_expected_revision: 0 };
  const s = setup({
    online: false,
    seed: { "lando-world:llt-sensor:pending:v1:A": JSON.stringify(request) },
  });
  s.client.connect({ uid: "A", client: s.transport });
  assert.equal(s.client.get().pending.p_operation_id, "fixed");
  s.client.connect({ uid: "B", client: s.transport });
  assert.equal(s.client.get().pending, null);
});
test("unsupported audio and rejected unlock do not break completion", () => {
  const ctx = modules();
  assert.equal(ctx.LeeLeeDeadlineAlerts.chime(), false);
  assert.doesNotThrow(() => ctx.LeeLeeDeadlineAlerts.unlock());
  const rejected = modules({
    AudioContext: class {
      resume() {
        return Promise.reject(Error("denied"));
      }
    },
  });
  assert.doesNotThrow(() => rejected.LeeLeeDeadlineAlerts.unlock());
});
function alerts() {
  const store = new Map();
  let chain = Promise.resolve();
  const locks = {
    request(k, fn) {
      const p = chain.then(fn);
      chain = p.catch(() => {});
      return p;
    },
  };
  const context = modules({
    localStorage: {
      getItem: (k) => store.get(k) || null,
      setItem: (k, v) => store.set(k, v),
    },
    navigator: { locks },
    indexedDB: undefined,
  });
  return context.LeeLeeDeadlineAlerts;
}
test("atomic fallback claims once across concurrent evaluations and repeated ticks", async () => {
  const a = alerts();
  let count = 0;
  const options = { now: 1000, dispatch: () => count++ };
  await Promise.all([
    a.evaluate([{ id: "timer:1", due: 999 }], options),
    a.evaluate([{ id: "timer:1", due: 999 }], options),
  ]);
  await a.evaluate([{ id: "timer:1", due: 999 }], options);
  assert.equal(count, 1);
});
test("catch-up consumes obsolete milestones and emits only current one", async () => {
  const a = alerts(),
    sent = [];
  const milestones = [
    { id: "approaching", due: 500 },
    { id: "grace", due: 900 },
  ];
  await a.evaluate(milestones, { now: 1000, dispatch: (d) => sent.push(d.id) });
  assert.deepEqual(sent, ["grace"]);
});
test("first fetch suppresses historical alerts and restore does not replay", async () => {
  const a = alerts();
  let count = 0;
  await a.evaluate([{ id: "old", due: 999 }], {
    now: 1000,
    initial: true,
    dispatch: () => count++,
  });
  await a.evaluate([{ id: "old", due: 999 }], {
    now: 1001,
    dispatch: () => count++,
  });
  assert.equal(count, 0);
});
test("audio dispatch failure is consumed once and ancient claims never replay after pruning", async () => {
  const a = alerts();
  let count = 0;
  await a.evaluate([{ id: "fail", due: 999 }], {
    now: 1000,
    dispatch: () => {
      count++;
      throw Error("audio");
    },
  });
  await a.evaluate([{ id: "fail", due: 999 }], {
    now: 1001,
    dispatch: () => count++,
  });
  await a.evaluate([{ id: "ancient", due: 1 }], {
    now: 31 * 86400000,
    dispatch: () => count++,
  });
  assert.equal(count, 1);
});


test("UUID compatibility prefers native, formats secure fallback and fails without crypto", () => {
  const domain = modules().LeeLeeDexcomSensor;
  let nativeCalls = 0;
  assert.equal(domain.generateUuid({ randomUUID() { nativeCalls++; return "native-id"; }, getRandomValues() { throw Error("unexpected fallback"); } }), "native-id");
  assert.equal(nativeCalls, 1);
  let calls = 0;
  const secure = { getRandomValues(bytes) { assert.equal(bytes.length, 16); bytes.fill(++calls); return bytes; } };
  const first = domain.generateUuid(secure), second = domain.generateUuid(secure);
  assert.equal(typeof first, "string");
  assert.equal(first.length, 36);
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(first, "01010101-0101-4101-8101-010101010101");
  assert.notEqual(first, second);
  assert.equal(calls, 2);
  assert.throws(() => domain.generateUuid({}), /Secure random generation/);
});

for (const value of ['2345','0042','0000','9999'])
  test(`sensor code string ${value} validates, labels and hydrates unchanged`, () => {
    assert.equal(D.isValidSensorCode(value),true);
    const coded={...c,sensor_code:value};
    const snap={revision:1,currentCycleId:c.id,cycles:[coded]};
    const before=JSON.stringify(snap);
    assert.equal(D.validate(snap,'A'),snap);
    assert.equal(JSON.stringify(snap),before);
    assert.equal(D.formatSensorLabel(coded),`Dexcom G7 · ${value}`);
  });
for (const value of ['', '234','23456','23A5','12 34',' 2345','2345 ','2345\n','+234','-234','2e34','٢٣٤٥','２３４５',2345])
  test(`invalid sensor code ${JSON.stringify(value)} rejected without normalization`,()=>{
    assert.equal(D.isValidSensorCode(value),false);
    assert.throws(()=>D.validate({revision:1,currentCycleId:c.id,cycles:[{...c,sensor_code:value}]},'A'));
  });
test('absent and null legacy codes keep raw snapshot shape and plain label',()=>{
  for(const row of [c,{...c,sensor_code:null}]) {
    const snap={revision:1,currentCycleId:c.id,cycles:[row]}, before=JSON.stringify(snap);
    assert.equal(D.validate(snap,'A'),snap);
    assert.equal(JSON.stringify(snap),before);
    assert.equal(D.formatSensorLabel(row),'Dexcom G7');
  }
});
test('coded starts use optional installed parameter; edits/undo/legacy starts omit it',async()=>{
  const s=await connected();
  assert.equal(s.client.request('start',{sensorCode:'0042'}).p_sensor_code,'0042');
  for(const action of ['start','edit_start','undo_current'])
    assert.equal('p_sensor_code' in s.client.request(action),false);
  assert.throws(()=>s.client.request('start',{sensorCode:'2345 '}));
  assert.throws(()=>s.client.request('edit_start',{sensorCode:'0042'}));
});
test('coded pending retry, realtime refetch and offline cache retain exact leading-zero string',async()=>{
  let snap={revision:0,currentCycleId:null,cycles:[]},lost=true;
  const sent=[];
  const s=await connected({rpc:async(name,p)=>{
    if(name==='llt_get_sensor_snapshot') return {data:{status:'ok',snapshot:structuredClone(snap)}};
    sent.push(structuredClone(p));
    if(lost){lost=false;throw Error('lost');}
    snap={revision:1,currentCycleId:c.id,cycles:[{...c,sensor_code:p.p_sensor_code}]};
    return {data:{status:'accepted',snapshot:structuredClone(snap)}};
  }});
  const request=s.client.request('start',{start:c.started_at,sensorCode:'0042'});
  assert.equal((await s.client.submit(request)).status,'unknown');
  const pending=JSON.parse(s.store.get('lando-world:llt-sensor:pending:v1:A'));
  assert.equal(pending.p_sensor_code,'0042');
  assert.equal((await s.client.submit()).status,'accepted');
  assert.equal(JSON.stringify(sent[0]),JSON.stringify(sent[1]));
  const second=setup({rpc:async()=>({data:{status:'ok',snapshot:structuredClone(snap)}})});
  second.client.connect({uid:'A',client:second.transport});await second.client.refresh();
  assert.equal(D.current(second.client.get().snapshot).sensor_code,'0042');
  snap={...snap,revision:2,cycles:[{...snap.cycles[0],revision:2,sensor_code:'2345'}]};
  second.invalidate();await new Promise(r=>setImmediate(r));
  assert.equal(D.current(second.client.get().snapshot).sensor_code,'2345');
  const offline=setup({online:false,seed:Object.fromEntries(s.store)});
  offline.client.connect({uid:'A',client:offline.transport});
  assert.equal(D.current(offline.client.get().snapshot).sensor_code,'0042');
});
