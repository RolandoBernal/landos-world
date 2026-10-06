// Opt-in local-only integration tests. No URLs, keys, env connection strings or
// existing databases are used. A fresh database is created and removed each run.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';

const enabled = process.env.LLT_LOCAL_LOW_GLUCOSE_DB_TEST === '1';
const docker = '/Applications/Docker.app/Contents/Resources/bin/docker';
const container = 'supabase_db_llt-14-5-curated';
const database = `llt15_guard_test_${process.pid}_${Date.now()}`;
const migration = '202610060001_guard_lee_lee_low_glucose_writes.sql';
const directory = new URL('../supabase/migrations/', import.meta.url);
const owner = randomUUID();
const otherOwner = randomUUID();
let created = false;
let oldWrite;
let markerRows;
let rpcBefore;
let securityBefore;
const literal = value => value == null ? 'null' : `'${String(typeof value === 'object' ? JSON.stringify(value) : value).replaceAll("'", "''")}'`;
function execute(query, db = database) {
  return spawnSync(docker, ['exec', '-i', container, 'psql', '-h', '/var/run/postgresql', '-U', 'postgres', '-d', db,
    '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'], { input: query, encoding: 'utf8' });
}
function sql(query, db) {
  const result = execute(query, db);
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message);
  return result.stdout.trim();
}
const role = query => `begin; set local role authenticated; set local request.jwt.claim.sub=${literal(owner)}; ${query} commit;`;
const snapshot = id => JSON.parse(sql(`select row_to_json(r) from public.lee_lee_records r where id=${literal(id)};`));
function record(type = 'Low Glucose') {
  const low = type === 'Low Glucose';
  return { id: randomUUID(), user_id: owner, record_type: type, blood_sugar: 53,
    insulin_units: low ? null : 2, administered_insulin_units: low ? null : 2,
    suggested_base_units: null, suggested_correction_units: null, suggested_total_units: null,
    insulin_plan_id: null, insulin_plan_snapshot: null,
    dose_calculation_status: low ? 'not-applicable' : 'manual',
    recorded_at: '2026-10-05T20:02:00Z', notes: 'SYNTHETIC_PRIVATE_NOTE', entered_by: 'Unknown', version: 1,
    payload: { type, eventType: 'check-insulin', doseCalculationStatus: low ? 'not-applicable' : 'manual',
      ...(low ? {lowGlucoseEpisode: { version: 1, thresholdSnapshot: {lowMgDl: 70}, rechecks: [], closure: null, pendingRecheck: null }} : {}) } };
}
function insert(row, authenticated = true) {
  const query = `insert into public.lee_lee_records (${Object.keys(row).join(',')}) values (${Object.values(row).map(literal).join(',')});`;
  return authenticated ? role(query) : query;
}
function seed(type) { const r = record(type); sql(insert(r)); return r; }
const parameters = [
  'id', 'expected_version', 'record_type', 'blood_sugar', 'insulin_units',
  'administered_insulin_units', 'suggested_base_units', 'suggested_correction_units',
  'suggested_total_units', 'insulin_plan_id', 'insulin_plan_snapshot',
  'dose_calculation_status', 'notes', 'recorded_at', 'entered_by', 'last_edited_by',
  'deleted_at', 'deleted_by', 'source', 'client_created_at', 'migration_fingerprint',
  'import_fingerprint', 'app_schema_version', 'payload'
];
function rpc(row, expected = row.version) {
  const args = {...row, expected_version: expected, source: row.source || 'app', app_schema_version: row.app_schema_version || 1};
  return role(`select coalesce(to_jsonb(public.update_lee_lee_record_with_version(${parameters.map(k => literal(args[k])).join(',')}))::text,'null');`);
}
function reject(query, id, expectedCode = '23514') {
  const before = id ? snapshot(id) : null;
  const result = execute(query);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, new RegExp(expectedCode));
  if (expectedCode === '23514') {
    assert.match(result.stderr, /LLT_LOW_GLUCOSE_WRITE_INCOMPATIBLE/);
    assert.match(result.stderr, /lee_lee_records_low_glucose_write_guard/);
    for (const privateText of [owner, id, 'SYNTHETIC_PRIVATE_NOTE', 'lowMgDl', '"bloodSugar"']) {
      if (privateText) assert.equal(result.stderr.includes(privateText), false);
    }
  }
  if (id) assert.deepEqual(snapshot(id), before);
}
function updateCase(name, mutate, accepted = true) {
  test(name, {skip: !enabled}, () => {
    const r = seed(); const before = snapshot(r.id); const next = structuredClone(before); mutate(next);
    if (!accepted) return reject(rpc(next), r.id);
    const result = JSON.parse(sql(rpc(next)));
    assert.equal(result.version, before.version + 1);
    assert.deepEqual(result.payload, next.payload);
    assert.equal(result.record_type, next.record_type);
    assert.equal(result.notes, next.notes);
  });
}
function baselineSource(path) {
  const result = spawnSync('git', ['show', `d30936fc3f78946448a4294961a4dfacd0623da6:${path}`], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Reviewed shipped baseline unavailable');
  return result.stdout;
}
function oldClientWrite(baseline = true) {
  // The deployed old writer is frozen at the reviewed baseline; the working
  // client is now intentionally compatible and must not replace this evidence.
  const tracker = baseline ? baselineSource('js/lee-lee-diabetes-tracker.js')
    : readFileSync(new URL('../js/lee-lee-diabetes-tracker.js', import.meta.url), 'utf8');
  const harness = readFileSync(new URL('./lee-lees-tracker-storage.test.js', import.meta.url), 'utf8');
  const helpers = harness.slice(harness.indexOf('function createLocalStorage'), harness.indexOf('function sampleRecord'));
  const instrumented = tracker.replace('  window.LeeLeeTrackerStorage = {',
    '  window.Audit = {normalizeRecord, buildRecordFromForm, setEditor(v) {currentEditor=v;}};\n  window.LeeLeeTrackerStorage = {')
    .replace('    helpers: window.LeeLeeTrackerDoseHelper,', '    audit: window.Audit,\n    helpers: window.LeeLeeTrackerDoseHelper,');
  const factory = new Function('vm', 'trackerSource', 'Blob', helpers + '\nreturn createTracker;')(vm, instrumented, Blob);
  const {storage} = factory();
  const row = record();
  const initial = {id:row.id, eventType:'check-insulin', type:'Low Glucose', bloodSugar:53,
    recordTimestamp:row.recorded_at, version:1, doseCalculationStatus:'not-applicable',
    lowGlucoseEpisode:row.payload.lowGlucoseEpisode, notes:row.notes};
  const normalized = storage.audit.normalizeRecord(initial);
  assert.equal(normalized.type, baseline ? 'Other' : 'Low Glucose');
  storage.audit.setEditor({id:row.id, type:normalized.type, eventType:normalized.eventType, originalRecord:normalized, mealComponents:[]});
  const value = value => ({value});
  const rebuilt = storage.audit.buildRecordFromForm({dataset:{}, elements:{
    type:value(normalized.type), eventType:value(normalized.eventType), bloodSugar:value('53'),
    date:value(normalized.date), time:value(normalized.time), insulinUnits:value(''), mealCarbs:value(''), notes:value('SYNTHETIC_PRIVATE_NOTE edited') }});
  assert.equal('lowGlucoseEpisode' in rebuilt, !baseline);
  const ctx = {console, Date, JSON, Math, Number, Object, Promise, String, Map, Set, URL, navigator:{}, location:{hostname:'localhost'},
    localStorage:{getItem:()=>null,setItem(){},removeItem(){}}, crypto:{randomUUID}};
  ctx.globalThis=ctx;
  vm.runInNewContext(baseline ? baselineSource('js/lee-lees-tracker-sync.js') : readFileSync(new URL('../js/lee-lees-tracker-sync.js', import.meta.url),'utf8'),ctx);
  const remote = ctx.LeeLeeTrackerSync.sanitizeRecordForRemote(rebuilt, owner);
  return {row, remote};
}
function security() {
  return sql(`select jsonb_build_object(
    'rls',(select relrowsecurity from pg_class where oid='public.lee_lee_records'::regclass),
    'select',has_table_privilege('authenticated','public.lee_lee_records','select'),
    'insert',has_table_privilege('authenticated','public.lee_lee_records','insert'),
    'update',has_table_privilege('authenticated','public.lee_lee_records','update'),
    'delete',has_table_privilege('authenticated','public.lee_lee_records','delete'),
    'policies',(select jsonb_agg(to_jsonb(p)) from pg_policies p where tablename='lee_lee_records'));`);
}
before(() => {
  if (!enabled) return;
  const identity = sql('select current_database(), inet_server_addr(), version();', 'postgres');
  console.log('Local-only target:', container, database, identity);
  assert.match(identity, /^postgres\|/); // docker exec / Unix socket, never a remote URL.
  sql(`create database ${database};`, 'postgres'); created = true;
  // Only Supabase external prerequisites are scaffolded; all application schema
  // objects, grants, RLS, RPCs and triggers come from the full migration history.
  sql(`create schema auth; create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated,anon;
    create publication supabase_realtime;
    insert into auth.users values (${literal(owner)},'synthetic@local.test'),(${literal(otherOwner)},'other@local.test');`);
  for (const file of readdirSync(directory).filter(f=>f.endsWith('.sql') && f<migration).sort()) {
    // Existing unrelated audit migration changes two return types with CREATE
    // OR REPLACE. PostgreSQL requires dropping these superseded functions first.
    // This accommodation is isolated here; production migration files stay intact.
    if (file === '202609170002_llt_settings_audit_final.sql') sql(`
      drop function public.update_lee_lee_shared_settings_with_audit(integer,text,date,text,text,text,jsonb,integer,jsonb);
      drop function public.insert_lee_lee_shared_settings_with_audit(jsonb,jsonb);`);
    sql(readFileSync(new URL(file,directory),'utf8'));
  }
  rpcBefore = sql(`select pg_get_functiondef(oid) from pg_proc where proname='update_lee_lee_record_with_version';`);
  securityBefore = security();
  oldWrite = oldClientWrite(); sql(insert(oldWrite.row));
  const destructive = {...snapshot(oldWrite.row.id), ...oldWrite.remote};
  const preguard = JSON.parse(sql(rpc(destructive)));
  assert.equal(preguard.record_type,'Other');
  assert.equal('lowGlucoseEpisode' in preguard.payload,false);
  // Remove only our synthetic row to replay exactly the same operation post-guard.
  sql(`delete from public.lee_lee_records where id=${literal(oldWrite.row.id)};`);
  markerRows = [record(),record(),record()];
  markerRows[0].payload = {}; // only SQL context marks OLD
  markerRows[1].record_type = 'Other'; delete markerRows[1].payload.lowGlucoseEpisode; // only payload context
  markerRows[2].record_type = 'Other'; markerRows[2].payload.type='Other'; // only episode key
  for (const r of markerRows) sql(insert(r,false));
  sql(readFileSync(new URL(migration,directory),'utf8'));
  sql(insert(oldWrite.row));
});
after(() => { if (created) { sql(`drop database ${database} with (force);`, 'postgres'); console.log('Removed disposable database:', database); } });

test('actual baseline notes-only destructive write: succeeds before guard, rejected afterward with unchanged row', {skip:!enabled},()=> {
  reject(rpc({...snapshot(oldWrite.row.id),...oldWrite.remote}),oldWrite.row.id);
});
updateCase('context and episode removal rejected',r=>{r.record_type='Other';r.payload={type:'Other'};},false);
updateCase('episode retained but context changed rejected',r=>{r.record_type='Other';r.payload.type='Other';},false);
for (const field of ['insulin_units','administered_insulin_units','suggested_base_units','suggested_correction_units','suggested_total_units','insulin_plan_id','insulin_plan_snapshot']) {
  updateCase(`SQL non-insulin invariant: ${field}`,r=>{r[field]=field==='insulin_plan_snapshot'?{}:field==='insulin_plan_id'?'plan':1;},false);
}
for (const field of ['insulinUnits','administeredInsulinUnits','suggestedBaseUnits','suggestedCorrectionUnits','suggestedTotalUnits','insulinPlanId','insulinPlanSnapshot','suggestedCarbDoseUnits','carbDoseUnits','roundedCarbDose','rawCarbDose','rawAggregateDose','roundedBaseDose','temporaryEatingAdjustmentUnits','temporaryEatingAdjustmentApplied']) {
  updateCase(`payload non-insulin invariant: ${field}`,r=>{r.payload[field]=field==='temporaryEatingAdjustmentApplied'?true:1;},false);
}
updateCase('compatible Notes edit accepted',r=>{r.notes='changed';});
updateCase('append recheck accepted',r=>{r.payload.lowGlucoseEpisode.rechecks.push({id:randomUUID(),bloodSugar:61,recordTimestamp:'2026-10-05T20:17:00Z'});});
updateCase('edit recheck accepted',r=>{r.payload.lowGlucoseEpisode.rechecks=[{id:randomUUID(),bloodSugar:84,notes:'edited'}];});
updateCase('confirmed closure accepted',r=>{r.payload.lowGlucoseEpisode.closure={kind:'recovery-confirmed',recheckId:randomUUID()};});
updateCase('manual ending accepted',r=>{r.payload.lowGlucoseEpisode.closure={kind:'ended-without-confirmed-recovery'};});
updateCase('pending recheck accepted',r=>{r.payload.lowGlucoseEpisode.pendingRecheck={sourceRoundId:randomUUID(),startedAt:'2026-10-05T20:02:00Z',dueAt:'2026-10-05T20:17:00Z'};});
for (const type of ['Breakfast','Lunch','Dinner','Snacks','Correction','Bedtime']) {
  test(`normal ${type} insert/update unaffected`,{skip:!enabled},()=>{const r=seed(type);const next=snapshot(r.id);next.notes='normal edit';assert.equal(JSON.parse(sql(rpc(next))).version,2);});
}
test('compatible soft delete and restore preserve episode', {skip:!enabled},()=> {
  const r=seed();let next=snapshot(r.id);const payload=next.payload;
  next.deleted_at='2026-10-05T21:00:00Z';next.deleted_by='Unknown';
  next=JSON.parse(sql(rpc(next)));assert.ok(next.deleted_at);assert.deepEqual(next.payload,payload);
  next.deleted_at=null;next.deleted_by=null;next=JSON.parse(sql(rpc(next)));assert.equal(next.deleted_at,null);assert.deepEqual(next.payload,payload);
});
test('stale compatible and incompatible writes return existing no-row conflict', {skip:!enabled},()=> {
  const r=seed();const next=snapshot(r.id);const before=snapshot(r.id);
  assert.equal(JSON.parse(sql(rpc(next,0))).id,null);next.record_type='Other';next.payload={};
  assert.equal(JSON.parse(sql(rpc(next,0))).id,null);assert.deepEqual(snapshot(r.id),before);
});
updateCase('future episode v2 accepted',r=>{r.payload.lowGlucoseEpisode.version=2;});
test('episode format downgrade rejected', {skip:!enabled},()=>{const r=record();r.payload.lowGlucoseEpisode.version=2;sql(insert(r));const next=snapshot(r.id);next.payload.lowGlucoseEpisode.version=1;reject(rpc(next),r.id);});
test('authenticated direct UPDATE and DELETE remain forbidden', {skip:!enabled},()=>{const r=seed();reject(role(`update public.lee_lee_records set notes='changed' where id=${literal(r.id)};`),r.id,'42501');reject(role(`delete from public.lee_lee_records where id=${literal(r.id)};`),r.id,'42501');});
test('authenticated valid low insert and owned SELECT accepted', {skip:!enabled},()=>{const r=seed();assert.equal(sql(role(`select count(*) from public.lee_lee_records where id=${literal(r.id)};`)),'1');});
for (const [name,mutate] of [
  ['old import context',r=>{r.record_type='Other';r.payload.type='Other';r.dose_calculation_status='manual';}],
  ['missing episode',r=>{delete r.payload.lowGlucoseEpisode;}],
  ['insulin bearing',r=>{r.insulin_units=1;}]
]) test(`malformed authenticated insert: ${name}`,{skip:!enabled},()=>{const r=record();mutate(r);reject(insert(r));assert.equal(sql(`select count(*) from public.lee_lee_records where id=${literal(r.id)};`),'0');});
test('import-like current-version replacement rejected and repeated retry cannot alter row/version', {skip:!enabled},()=>{const r=seed();const next=snapshot(r.id);next.record_type='Other';next.payload={type:'Other'};reject(rpc(next),r.id);reject(rpc(next),r.id);});
for (const [name,mutate] of [
  ['JSON null episode',e=>null],['string episode',e=>'unknown'],
  ...['version','thresholdSnapshot','rechecks','closure','pendingRecheck'].map(k=>[`missing ${k}`,e=>{delete e[k];return e;}]),
  ...['thresholdSnapshot','rechecks','closure','pendingRecheck'].map(k=>[`wrong ${k} type`,e=>{e[k]='bad';return e;}]),
  ...[0,-1,1.5,'1',null].map(v=>[`invalid version ${JSON.stringify(v)}`,e=>{e.version=v;return e;}])
]) updateCase(`malformed envelope: ${name}`,r=>{r.payload.lowGlucoseEpisode=mutate(r.payload.lowGlucoseEpisode);},false);
updateCase('SQL Low Glucose / payload Other rejected',r=>{r.payload.type='Other';},false);
updateCase('payload Low Glucose / SQL Other rejected',r=>{r.record_type='Other';},false);
updateCase('wrong event type rejected',r=>{r.payload.eventType='meal';},false);
updateCase('SQL applicable dose status rejected',r=>{r.dose_calculation_status='manual';},false);
updateCase('payload applicable dose status rejected',r=>{r.payload.doseCalculationStatus='calculated';},false);
updateCase('nested rechecks deliberately left to client validation',r=>{r.payload.lowGlucoseEpisode.rechecks=[null,'unusual',{id:'same',bloodSugar:-1,recordTimestamp:'not-a-date'},{id:'same'}];});
updateCase('initial glucose and threshold semantics deliberately left to client',r=>{r.blood_sugar=null;r.payload.lowGlucoseEpisode.thresholdSnapshot={lowMgDl:'unresolved'};});
test('arbitrary unrelated JSON extension unaffected', {skip:!enabled},()=>{const r=record('Breakfast');r.payload.futureExtension={arbitrary:[null,'value']};sql(insert(r));const next=snapshot(r.id);assert.deepEqual(JSON.parse(sql(rpc(next))).payload,r.payload);});
test('multi-row failure is atomic, including existing updated_at trigger effects', {skip:!enabled},()=>{const a=seed('Breakfast'),b=seed();const before=[snapshot(a.id),snapshot(b.id)];reject(`update public.lee_lee_records set record_type='Other',payload='{}',notes='batch' where id in (${literal(a.id)},${literal(b.id)});`,b.id);assert.deepEqual([snapshot(a.id),snapshot(b.id)],before);});
test('privileged direct UPDATE and INSERT remain guarded', {skip:!enabled},()=>{const r=seed();reject(`update public.lee_lee_records set payload='{}' where id=${literal(r.id)};`,r.id);const malformed=record();malformed.payload={};reject(insert(malformed,false));});
test('protected identity and ownership cannot change', {skip:!enabled},()=>{const r=seed();reject(`update public.lee_lee_records set id=${literal(randomUUID())} where id=${literal(r.id)};`,r.id);reject(`update public.lee_lee_records set user_id=${literal(otherOwner)} where id=${literal(r.id)};`,r.id);});
test('RLS owner filtering and ownership checks unchanged', {skip:!enabled},()=>{const r=record();r.user_id=otherOwner;sql(insert(r,false));assert.equal(sql(role(`select count(*) from public.lee_lee_records where id=${literal(r.id)};`)),'0');assert.equal(JSON.parse(sql(rpc(snapshot(r.id)))).id,null);reject(insert({...record(),user_id:otherOwner}),null,'42501');});
test('migration replay is idempotent; RPC, policies, grants, trigger security unchanged', {skip:!enabled},()=>{
  sql(readFileSync(new URL(migration,directory),'utf8'));
  assert.equal(sql(`select pg_get_functiondef(oid) from pg_proc where proname='update_lee_lee_record_with_version';`),rpcBefore);
  assert.equal(security(),securityBefore);
  const guard = JSON.parse(sql(`select jsonb_build_object('definer',prosecdef,'config',proconfig,'authExecute',has_function_privilege('authenticated',oid,'execute'),'anonExecute',has_function_privilege('anon',oid,'execute')) from pg_proc where proname='guard_lee_lee_low_glucose_write';`));
  assert.equal(guard.definer,false);assert.deepEqual(guard.config,['search_path=""']);assert.equal(guard.authExecute,false);assert.equal(guard.anonExecute,false);
  assert.equal(sql(`select count(*) from pg_trigger where tgrelid='public.lee_lee_records'::regclass and not tgisinternal;`),'2');
});

for (let i=0;i<3;i++) test(`OLD defensive marker ${i+1} cannot escape by removing all NEW markers`,{skip:!enabled},()=> {
  const r=markerRows[i];reject(`update public.lee_lee_records set record_type='Other',payload='{}' where id=${literal(r.id)};`,r.id);
});
updateCase('numeric zero is not non-applicable insulin',r=>{r.insulin_units=0;},false);

test('integral JSON numeric version notation accepted without lexical restrictions', {skip:!enabled},()=> {
  const r=seed();sql(`update public.lee_lee_records set payload=jsonb_set(payload,'{lowGlucoseEpisode,version}','1.0'::jsonb) where id=${literal(r.id)};`);
  assert.equal(snapshot(r.id).payload.lowGlucoseEpisode.version,1);
});

test('actual new client normalization/build/serialization satisfies the unchanged installed guard', { skip: !enabled }, () => {
  const compatible = oldClientWrite(false);
  const row = { ...compatible.row, ...compatible.remote };
  sql(insert(row));
  const stored = snapshot(row.id);
  assert.equal(stored.record_type, 'Low Glucose');
  assert.equal(stored.dose_calculation_status, 'not-applicable');
  assert.equal(stored.insulin_units, null);
  assert.equal(stored.payload.lowGlucoseEpisode.version, 1);
  const next = { ...stored, ...compatible.remote };
  const updated = JSON.parse(sql(rpc(next)));
  assert.equal(updated.version, 2);
  assert.deepEqual(updated.payload.lowGlucoseEpisode, stored.payload.lowGlucoseEpisode);
});
