// LOCAL ONLY: disposable database in the known local Supabase container.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync, spawn } from 'node:child_process';
import { randomUUID, createHmac, webcrypto } from 'node:crypto';
import vm from 'node:vm';
const enabled = process.env.LLT_LOCAL_SENSOR_DB_TEST === '1';
const docker = '/Applications/Docker.app/Contents/Resources/bin/docker';
const container = 'supabase_db_llt-14-5-curated';
const db = `llt_metadata_test_${process.pid}_${Date.now()}`;
let created = false, legacy, legacySnapshot, legacyReceipt, restCreated = false, roleCreated = false, baseURL;
const rest = `llt-metadata-rest-${process.pid}`, login = `llt_metadata_login_${process.pid}`;
const secret = 'local-sensor-metadata-tests-only-32-byte-secret';
const migration = readFileSync('supabase/migrations/202610090001_add_llt_sensor_replacement_metadata.sql', 'utf8');
const q = v => v == null ? 'null' : typeof v === 'boolean' || typeof v === 'number' ? String(v) : `'${String(typeof v === 'object' ? JSON.stringify(v) : v).replaceAll("'", "''")}'`;
function sql(query, database = db) {
  const r = spawnSync(docker, ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', database, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], { input: query, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
}
const role = (uid, query) => `begin;set local role authenticated;set local request.jwt.claim.sub=${q(uid)};${query}commit;`;
function user() { const uid = randomUUID(); sql(`insert into auth.users values(${q(uid)},${q(uid + '@synthetic.local')});`); return uid; }
const at = hours => new Date(Date.now() - hours * 3600000).toISOString();
function request(uid, revision = 0, current = null, action = 'start', start = at(1)) {
  return { uid, p: { p_operation_id: randomUUID(), p_action: action, p_expected_revision: revision,
    p_expected_current_cycle_id: current, p_new_cycle_id: action === 'start' ? randomUUID() : null,
    p_started_at: ['undo_current', 'update_metadata'].includes(action) ? null : start,
    p_confirm_replace: action === 'start' && !!current, p_actor_label: 'Emily', p_device_metadata: {} } };
}
function call(c) { return JSON.parse(sql(role(c.uid, `select public.llt_mutate_sensor_cycle(${Object.entries(c.p).map(([k, v]) => k + ' => ' + q(v)).join(',')});`))); }
function snapshot(uid) { return JSON.parse(sql(role(uid, 'select public.llt_get_sensor_snapshot();'))); }
const metadata = (reason = 'fell_off', notes = 'Synthetic note', requested = false) => ({ replacement_reason_id: reason, replacement_notes: notes, replacement_requested: requested });
function pair() {
  const uid = user(), first = request(uid, 0, null, 'start', at(300)), a = call(first);
  const second = request(uid, 1, a.snapshot.currentCycleId, 'start', at(1));
  second.p.p_sensor_code = '0042'; second.p.p_replacement_metadata = metadata();
  const b = call(second); assert.equal(b.status, 'accepted'); return { uid, first, second, snapshot: b.snapshot };
}
function edit(pair, value = metadata('sensor_failed', 'Edited', true)) {
  const c = request(pair.uid, pair.snapshot.revision, pair.snapshot.currentCycleId, 'update_metadata');
  c.p.p_target_cycle_id = pair.first.p.p_new_cycle_id; c.p.p_replacement_metadata = value; return c;
}
function check(name, fn) { test(name, { skip: !enabled }, fn); }
before(async () => {
  if (!enabled) return;
  assert.match(sql('select current_database(),inet_server_addr();', 'postgres'), /^postgres\|$/);
  sql(`create database ${db};`, 'postgres'); created = true;
  sql(`create schema auth;create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
    grant usage on schema public,auth to authenticated,anon;create publication supabase_realtime;`);
  sql(readFileSync('supabase/migrations/202610030001_create_llt_sensor_cycles.sql', 'utf8'));
  sql(readFileSync('supabase/migrations/202610060002_add_llt_sensor_code.sql', 'utf8'));
  legacy = request(user(), 0, null, 'start', at(300)); assert.equal(call(legacy).status, 'accepted');
  legacySnapshot = snapshot(legacy.uid).snapshot;
  legacyReceipt = sql(`select request::text from public.llt_sensor_operations where operation_id=${q(legacy.p.p_operation_id)};`);
  sql(`create view public.synthetic_metadata_dependency as select public.llt_mutate_sensor_cycle(null::uuid,null::text,null::bigint,null::uuid,null::uuid,null::timestamptz,null::boolean,null::text,null::jsonb,null::text) receipt;`);
  assert.throws(()=>sql(migration),/depend/);
  assert.equal(sql("select count(*) from information_schema.columns where table_name='llt_sensor_cycles' and column_name like 'replacement_%';"),'0');
  assert.deepEqual(snapshot(legacy.uid).snapshot,legacySnapshot);
  sql('drop view public.synthetic_metadata_dependency;');
  sql(migration);
  sql(`create role ${login} login password 'local-disposable-only';grant authenticated,anon to ${login};`, 'postgres'); roleCreated = true;
  const r = spawnSync(docker,['run','-d','--name',rest,'--network','supabase_network_llt-14-5-curated','-p','127.0.0.1::3000','-e',`PGRST_DB_URI=postgres://${login}:local-disposable-only@${container}:5432/${db}`,'-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e',`PGRST_JWT_SECRET=${secret}`,'public.ecr.aws/supabase/postgrest:v16.1'],{encoding:'utf8'});
  if(r.status !== 0) throw new Error(r.stderr); restCreated = true;
  const port=spawnSync(docker,['port',rest,'3000/tcp'],{encoding:'utf8'}).stdout.trim().split(':').at(-1); baseURL=`http://127.0.0.1:${port}`;
  for(let i=0;i<100;i++) {try {if((await fetch(baseURL)).status===200)return;}catch{} await new Promise(resolve=>setTimeout(resolve,100));}
  throw new Error('Disposable metadata PostgREST unavailable');
});
after(() => { if(restCreated) spawnSync(docker,['rm','-f',rest]); if (created) sql(`drop database ${db} with (force);`, 'postgres'); if(roleCreated) sql(`drop role ${login};`,'postgres'); });
check('existing migration preserves legacy snapshot byte shape and receipt identity', () => {
  assert.deepEqual(snapshot(legacy.uid).snapshot, legacySnapshot);
  assert.equal(snapshot(legacy.uid).capabilities.sensorMetadata, 1);
  assert.equal(sql(`select request::text from public.llt_sensor_operations where operation_id=${q(legacy.p.p_operation_id)};`), legacyReceipt);
  assert.equal(call(legacy).replayed, true);
});
check('repeated installation is idempotent with a single unambiguous RPC', () => {
  const before = snapshot(legacy.uid); sql(migration); const after = snapshot(legacy.uid); delete before.serverTime; delete after.serverTime; assert.deepEqual(after, before);
  assert.equal(sql("select count(*) from pg_proc where pronamespace='public'::regnamespace and proname='llt_mutate_sensor_cycle';"), '1');
});
check('fresh empty sensor schema installation is transactional and repeatable', () => {
  // Empty schema in another disposable database, not the existing local service DB.
  const fresh = db + '_fresh'; sql(`create database ${fresh};`, 'postgres');
  try {
    sql(`create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;grant usage on schema public,auth to authenticated,anon;create publication supabase_realtime;`, fresh);
    for (const path of ['202610030001_create_llt_sensor_cycles.sql', '202610060002_add_llt_sensor_code.sql', '202610090001_add_llt_sensor_replacement_metadata.sql']) sql(readFileSync('supabase/migrations/' + path, 'utf8'), fresh);
    sql(migration, fresh);
    assert.equal(sql('select count(*) from public.llt_sensor_cycles;', fresh), '0');
  } finally { sql(`drop database ${fresh} with (force);`, 'postgres'); }
});
check('replacement atomically records metadata on previous sensor at new start; explicit false survives snapshot', () => {
  const p = pair(), closed = p.snapshot.cycles.find(c => c.id === p.first.p.p_new_cycle_id), active = p.snapshot.cycles[0];
  assert.equal(Date.parse(closed.ended_at), Date.parse(p.second.p.p_started_at));
  assert.equal(closed.replacement_reason_id, 'fell_off'); assert.equal(closed.replacement_requested, false);
  assert.equal(closed.replacement_notes, 'Synthetic note'); assert.equal(active.sensor_code, '0042');
  assert.equal(Object.hasOwn(active, 'replacement_notes'), false);
});
check('historical metadata edit changes only metadata and revision/audit; replay/payload identity protected', () => {
  const p = pair(), before = p.snapshot.cycles.find(c => c.id === p.first.p.p_new_cycle_id), c = edit(p), result = call(c);
  assert.equal(result.status, 'accepted'); const after = result.snapshot.cycles.find(x => x.id === before.id);
  for (const key of ['id', 'started_at', 'ended_at', 'state', 'previous_cycle_id']) assert.equal(after[key], before[key]);
  assert.equal(result.snapshot.currentCycleId, p.snapshot.currentCycleId);
  assert.equal(after.replacement_requested, true); assert.equal(call(c).replayed, true);
  c.p.p_replacement_metadata.replacement_notes = 'different'; assert.equal(call(c).reason, 'operation_id_reused');
});
check('clearing metadata preserves unknown vs No without timestamp changes', () => {
  const p = pair(), r = call(edit(p, metadata(null, null, null))); assert.equal(r.status, 'accepted');
  const closed = r.snapshot.cycles.find(c => c.id === p.first.p.p_new_cycle_id);
  assert.equal(Object.hasOwn(closed, 'replacement_requested'), false);
});
for (const [name, value] of [['invalid reason', metadata('unknown')], ['long notes', metadata('other', 'x'.repeat(2001))], ['string boolean', metadata('other', null, 'false')], ['extra timestamps', { ...metadata(), started_at: at(3) }]]) check(name + ' rejected without modifying data', () => {
  const p = pair(), r = call(edit(p, value)); assert.equal(r.status, 'invalid_request'); assert.deepEqual(snapshot(p.uid).snapshot, p.snapshot);
});
check('2000 Unicode characters accepted consistently with bounded receipt bytes', () => {
  const p = pair(), r = call(edit(p, metadata('other', '😀'.repeat(2000)))); assert.equal(r.status, 'accepted');
  assert.equal(Array.from(r.snapshot.cycles.find(c => c.id === p.first.p.p_new_cycle_id).replacement_notes).length, 2000);
});
check('timestamp argument rejected for metadata mutation', () => {
  const p = pair(), c = edit(p); c.p.p_started_at = at(100); assert.equal(call(c).reason, 'invalid_action_shape');
});
check('stale revision/current pointer rejected; nonexistent target and active target rejected', () => {
  const p = pair(); let c = edit(p); c.p.p_expected_revision--; assert.equal(call(c).status, 'conflict');
  c = edit(p); c.p.p_expected_current_cycle_id = null; assert.equal(call(c).status, 'conflict');
  c = edit(p); c.p.p_target_cycle_id = randomUUID(); assert.equal(call(c).reason, 'target_not_found');
  c = edit(p); c.p.p_target_cycle_id = p.snapshot.currentCycleId; assert.equal(call(c).reason, 'target_not_closed');
});
check('Undo retains cancelled sensor and prior metadata; cancelled metadata editing is rejected', () => {
  const p = pair(), undo = request(p.uid, p.snapshot.revision, p.snapshot.currentCycleId, 'undo_current'), r = call(undo);
  assert.equal(r.status, 'accepted'); const restored = r.snapshot.cycles.find(c => c.id === r.snapshot.currentCycleId);
  assert.equal(restored.replacement_requested, false); const c = edit({ ...p, snapshot: r.snapshot });
  c.p.p_target_cycle_id = p.second.p.p_new_cycle_id; assert.equal(call(c).reason, 'target_not_closed');
});
check('anonymous access fails and account/RLS boundaries prevent reading or editing others', () => {
  const p = pair(), stranger = user();
  assert.equal(sql(role(stranger, 'select count(*) from public.llt_sensor_cycles;')), '0');
  const c = edit(p); c.uid = stranger; c.p.p_expected_revision = 0; c.p.p_expected_current_cycle_id = null;
  assert.equal(call(c).reason, 'target_not_found');
  assert.throws(() => sql(role(p.uid, `update public.llt_sensor_cycles set replacement_notes='bypass';`)), /permission denied/);
  assert.throws(() => sql('begin;set local role anon;select public.llt_get_sensor_snapshot();commit;'), /permission denied/);
  assert.throws(() => sql('select public.llt_get_sensor_snapshot();'), /Authentication required/);
});

check('simultaneous metadata writes serialize and only one expected revision succeeds', async () => {
  const p = pair(), commands = [edit(p, metadata('signal_loss','one')),edit(p,metadata('sensor_failed','two'))];
  const results = await Promise.all(commands.map(c => new Promise((resolve,reject)=>{
    const child=spawn(docker,['exec','-i',container,'psql','-U','postgres','-d',db,'-X','-qAt','-v','ON_ERROR_STOP=1']);
    let output='',error='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>error+=d);
    child.on('error',reject);child.on('close',code=>{if(code) reject(new Error(error));else resolve(JSON.parse(output.trim()));});
    child.stdin.end(role(c.uid,`select public.llt_mutate_sensor_cycle(${Object.entries(c.p).map(([k,v])=>k+' => '+q(v)).join(',')});`));
  })));
  assert.deepEqual(results.map(r=>r.status).sort(),['accepted','conflict']);
  assert.equal(snapshot(p.uid).snapshot.revision,p.snapshot.revision+1);
});

function token(uid) { const b=value=>Buffer.from(JSON.stringify(value)).toString('base64url'); const payload=`${b({alg:'HS256',typ:'JWT'})}.${b({role:'authenticated',sub:uid,exp:Math.floor(Date.now()/1000)+600})}`; return `${payload}.${createHmac('sha256',secret).update(payload).digest('base64url')}`; }
async function api(name,uid,body={}) { const r=await fetch(`${baseURL}/rpc/${name}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token(uid)}`},body:JSON.stringify(body)}); const data=await r.json(); assert.equal(r.status,200,JSON.stringify(data)); return data; }
check('actual isolated REST resolves legacy and metadata shapes and enforces JWT account ownership',async()=>{
  const uid=user(),first=request(uid,0,null,'start',at(300));assert.equal((await api('llt_mutate_sensor_cycle',uid,first.p)).status,'accepted');
  const replacement=request(uid,1,first.p.p_new_cycle_id,'start',at(1)); replacement.p.p_sensor_code='0042';replacement.p.p_replacement_metadata=metadata();
  const result=await api('llt_mutate_sensor_cycle',uid,replacement.p);assert.equal(result.status,'accepted');
  const change=edit({uid,first,snapshot:result.snapshot});assert.equal((await api('llt_mutate_sensor_cycle',uid,change.p)).status,'accepted');
  assert.equal((await api('llt_get_sensor_snapshot',uid)).snapshot.cycles.find(c=>c.id===first.p.p_new_cycle_id).replacement_requested,true);
  assert.deepEqual((await api('llt_get_sensor_snapshot',user())).snapshot.cycles,[]);
});
check('current client hydrates actual REST/DB metadata, persisted unknown retry, second-device refetch and stale conflict',async()=>{
  const uid=user(),ctx=vm.createContext({crypto:webcrypto,navigator:{onLine:true},setTimeout,clearTimeout});
  for(const file of ['js/lee-lee-dexcom-sensor.js','js/lee-lee-sensor-sync.js'])vm.runInContext(readFileSync(file,'utf8'),ctx);
  function device() {
    const cache=new Map();let invalidate,lost=false;
    const transport={channel:()=>({on(_e,_f,fn){invalidate=fn;return this;},subscribe(){return this;}}),removeChannel(){},rpc:async(name,p)=>{
      const data=await api(name,uid,p);if(name==='llt_mutate_sensor_cycle'&&lost){lost=false;throw new Error('Synthetic lost response');}return {data};
    }};
    const client=ctx.LeeLeeSensorSync.create({storage:{getItem:k=>cache.get(k)??null,setItem:(k,v)=>cache.set(k,v),removeItem:k=>cache.delete(k)},locks:{request:(_k,fn)=>fn()}});
    client.connect({uid,client:transport});return {client,cache,invalidate:()=>invalidate(),lose:()=>{lost=true;}};
  }
  const a=device(),b=device();await Promise.all([a.client.refresh(),b.client.refresh()]);
  const first=a.client.request('start',{start:at(300),sensorCode:'2345'});assert.equal((await a.client.submit(first)).status,'accepted');
  const replacement=a.client.request('start',{start:at(1),confirmed:true,sensorCode:'0042',replacementMetadata:metadata()});assert.equal((await a.client.submit(replacement)).status,'accepted');
  await b.client.refresh();assert.equal(b.client.get().snapshot.cycles.find(c=>c.id===first.p_new_cycle_id).replacement_requested,false);
  const stale=b.client.request('update_metadata',{targetId:first.p_new_cycle_id,replacementMetadata:metadata('signal_loss','stale')});
  const update=a.client.request('update_metadata',{targetId:first.p_new_cycle_id,replacementMetadata:metadata('sensor_failed','newest',true)});
  a.lose();assert.equal((await a.client.submit(update)).status,'unknown');
  const pending=JSON.parse(a.cache.get(`lando-world:llt-sensor:pending:v1:${uid}`));assert.equal(pending.p_operation_id,update.p_operation_id);
  assert.equal((await a.client.submit()).status,'accepted');assert.equal(a.client.get().pending,null);
  assert.equal((await b.client.submit(stale)).status,'conflict');
  b.invalidate();await b.client.refresh();assert.equal(b.client.get().snapshot.cycles.find(c=>c.id===first.p_new_cycle_id).replacement_notes,'newest');
  assert.equal(JSON.parse(b.cache.get(`lando-world:llt-sensor:cache:v1:${uid}`)).snapshot.cycles.find(c=>c.id===first.p_new_cycle_id).replacement_requested,true);
});
check('existing sensor SQL regression suite remains green on the upgraded disposable schema',()=>{
  const env={...process.env,LLT_LOCAL_SENSOR_DB_TEST:'1',LLT_LOCAL_SENSOR_DB_NAME:db};delete env.NODE_TEST_CONTEXT;
  const r=spawnSync(process.execPath,['--test','tests/llt-sensor-database.test.js'],{encoding:'utf8',env,maxBuffer:2000000});
  assert.equal(r.status,0,r.stdout+r.stderr);assert.match(r.stdout,/(?:# skipped|ℹ skipped) 0/);
  console.log('Existing sensor SQL regression summary:',r.stdout.slice(-240));
});
