// Opt-in LOCAL ONLY: Unix-socket docker exec, fresh DB, synthetic identities.
// Never reads production configuration, URLs, keys or sensor rows.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomUUID, createHmac, webcrypto } from 'node:crypto';
import vm from 'node:vm';
const enabled = process.env.LLT_LOCAL_SENSOR_DB_TEST === '1';
const docker = '/Applications/Docker.app/Contents/Resources/bin/docker';
const container = 'supabase_db_llt-14-5-curated';
const db = `llt_code_test_${process.pid}_${Date.now()}`;
const rest = `llt-code-rest-${process.pid}`;
const login = `llt_code_login_${process.pid}`;
const secret = 'local-sensor-code-tests-only-32-byte-secret';
const migration = readFileSync('supabase/migrations/202610060002_add_llt_sensor_code.sql','utf8');
let created = false, roleCreated = false, restCreated = false, baseURL;
let legacy, beforeSnapshot, beforeReceipt, beforeSecurity, beforeFileNode;
const q = value => value == null ? 'null' : `'${String(value).replaceAll("'", "''")}'`;
function exec(query, database = db) {
  return spawnSync(docker, ['exec','-i',container,'psql','-h','/var/run/postgresql','-U','postgres','-d',database,'-X','-qAt','-v','ON_ERROR_STOP=1'], {input:query,encoding:'utf8'});
}
function sql(query, database) { const r=exec(query,database); if(r.status!==0) throw Error(r.stderr || r.error?.message); return r.stdout.trim(); }
function user() { const uid=randomUUID(); sql(`insert into auth.users values(${q(uid)},${q(uid+'@synthetic.local')});`); return uid; }
const at = hours => new Date(Date.now()-hours*3600000).toISOString();
function command(uid, revision=0, current=null, action='start', code=undefined, start=at(1)) {
  const p={p_operation_id:randomUUID(),p_action:action,p_expected_revision:revision,p_expected_current_cycle_id:current,p_new_cycle_id:action==='start'?randomUUID():null,p_started_at:action==='undo_current'?null:start,p_confirm_replace:action==='start'&&!!current,p_actor_label:'Emily',p_device_metadata:{}};
  if(code!==undefined) p.p_sensor_code=code;
  return {uid,p};
}
function call(c, named=false) {
  const values=Object.entries(c.p).map(([key,value])=>`${named?key+' => ':''}${q(typeof value==='object'&&value!==null?JSON.stringify(value):value)}`).join(',');
  return JSON.parse(sql(`begin;set local role authenticated;set local request.jwt.claim.sub=${q(c.uid)};select public.llt_mutate_sensor_cycle(${values});commit;`));
}
function snapshot(uid) { return JSON.parse(sql(`begin;set local role authenticated;set local request.jwt.claim.sub=${q(uid)};select public.llt_get_sensor_snapshot();commit;`)).snapshot; }
function start(code=undefined) { const uid=user(),c=command(uid,0,null,'start',code,at(300)),r=call(c); assert.equal(r.status,'accepted'); return {uid,c,r}; }
function security() {
  return sql(`select jsonb_build_object(
    'tables',(select jsonb_agg(jsonb_build_object('name',relname,'owner',pg_get_userbyid(relowner),'rls',relrowsecurity,'acl',relacl::text) order by relname) from pg_class where relname in ('llt_sensor_contexts','llt_sensor_cycles','llt_sensor_operations')),
    'policies',(select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p where tablename like 'llt_sensor_%'),
    'functions',(select jsonb_agg(jsonb_build_object('name',proname,'owner',pg_get_userbyid(proowner),'definer',prosecdef,'config',proconfig,'acl',proacl::text,'return',prorettype::regtype::text) order by proname) from pg_proc where proname in ('llt_sensor_snapshot_for_user','llt_get_sensor_snapshot','llt_mutate_sensor_cycle')),
    'indexes',(select jsonb_agg(indexdef order by indexname) from pg_indexes where tablename like 'llt_sensor_%'),
    'triggers',(select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relname like 'llt_sensor_%' and not t.tgisinternal));`);
}
function check(name, fn) { test(name,{skip:!enabled},fn); }
before(async () => {
  if(!enabled) return;
  assert.match(sql('select current_database(),inet_server_addr();','postgres'),/^postgres\|$/);
  sql(`create database ${db};`,'postgres'); created=true;
  sql(`create schema auth;create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
    grant usage on schema public,auth to authenticated,anon;
    create publication supabase_realtime;`);
  sql(readFileSync('supabase/migrations/202610030001_create_llt_sensor_cycles.sql','utf8'));
  legacy=start(); beforeSnapshot=snapshot(legacy.uid);
  beforeReceipt=sql(`select request::text from public.llt_sensor_operations where operation_id=${q(legacy.c.p.p_operation_id)};`);
  beforeSecurity=security();
  beforeFileNode=sql("select relfilenode from pg_class where oid='public.llt_sensor_cycles'::regclass;");
  assert.throws(()=>call(command(user(),0,null,'start','0042')),/does not exist/);
  // Counterfactual unadjusted projection reproduces same-revision incompatibility.
  const exposed=JSON.parse(sql(`begin;alter table public.llt_sensor_cycles add column sensor_code text;select public.llt_sensor_snapshot_for_user(${q(legacy.uid)});rollback;`));
  assert.notDeepEqual(exposed,beforeSnapshot);
  assert.equal(exposed.revision,beforeSnapshot.revision);
  assert.equal(exposed.cycles[0].sensor_code,null);
  // Unexpected dependencies stop signature replacement and roll back all DDL.
  sql(`create view public.synthetic_sensor_dependency as select public.llt_mutate_sensor_cycle(null::uuid,null::text,null::bigint,null::uuid,null::uuid,null::timestamptz,null::boolean,null::text,null::jsonb) as receipt;`);
  assert.throws(()=>sql(migration), /depend/);
  assert.equal(sql("select count(*) from information_schema.columns where table_name='llt_sensor_cycles' and column_name='sensor_code';"),'0');
  assert.deepEqual(snapshot(legacy.uid),beforeSnapshot);
  sql('drop view public.synthetic_sensor_dependency;');
  sql(migration);
  // Dedicated PostgREST connected only to our disposable DB, never existing REST.
  sql(`create role ${login} login password 'local-disposable-only';grant authenticated,anon to ${login};`,'postgres'); roleCreated=true;
  const r=spawnSync(docker,['run','-d','--name',rest,'--network','supabase_network_llt-14-5-curated','-p','127.0.0.1::3000','-e',`PGRST_DB_URI=postgres://${login}:local-disposable-only@${container}:5432/${db}`,'-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e',`PGRST_JWT_SECRET=${secret}`,'public.ecr.aws/supabase/postgrest:v16.1'],{encoding:'utf8'});
  if(r.status!==0) throw Error(r.stderr); restCreated=true;
  const port=spawnSync(docker,['port',rest,'3000/tcp'],{encoding:'utf8'}).stdout.trim().split(':').at(-1); baseURL=`http://127.0.0.1:${port}`;
  for(let i=0;i<100;i++) { try { const r=await fetch(baseURL); if(r.status===200) return; } catch {} await new Promise(r=>setTimeout(r,100)); }
  throw Error('Disposable PostgREST unavailable');
});
after(() => {
  if(restCreated) spawnSync(docker,['rm','-f',rest],{encoding:'utf8'});
  if(created) sql(`drop database ${db} with(force);`,'postgres');
  if(roleCreated) sql(`drop role ${login};`,'postgres');
  if(created) console.log('Removed disposable DB/PostgREST/login:',db);
});
check('pre/post migration legacy same-revision snapshot equality and old receipt replay',()=>{
  assert.deepEqual(snapshot(legacy.uid),beforeSnapshot);
  assert.equal(JSON.stringify(snapshot(legacy.uid)),JSON.stringify(beforeSnapshot));
  assert.equal('sensor_code' in snapshot(legacy.uid).cycles[0],false);
  assert.equal(call(legacy.c).replayed,true);
  assert.equal(sql(`select request::text from public.llt_sensor_operations where operation_id=${q(legacy.c.p.p_operation_id)};`),beforeReceipt);
  assert.equal(security(),beforeSecurity);
});
for(const code of [null,'2345','0042','0000','9999']) {
  check(`DB constraint accepts ${JSON.stringify(code)} without normalization`,()=>{
    const value=sql(`begin;update public.llt_sensor_cycles set sensor_code=${q(code)} where id=${q(legacy.c.p.p_new_cycle_id)};select coalesce(sensor_code,'<null>') from public.llt_sensor_cycles where id=${q(legacy.c.p.p_new_cycle_id)};rollback;`);
    assert.equal(value,code??'<null>');
  });
  check(`RPC accepts ${JSON.stringify(code)} and exact read round trip`,()=>{
    const a=start(code); assert.equal(snapshot(a.uid).cycles[0].sensor_code??null,code);
  });
}
for(const code of ['234','23456','23A5',' 2345','2345 ','','٢٣٤٥','２３４５','2345\n','234\t','+234','2e34','23.4']) {
  check(`DB constraint rejects ${JSON.stringify(code)}`,()=>{
    assert.throws(()=>sql(`update public.llt_sensor_cycles set sensor_code=${q(code)} where id=${q(legacy.c.p.p_new_cycle_id)};`),/llt_sensor_code_four_ascii_digits/);
  });
  check(`RPC rejects ${JSON.stringify(code)} before any write`,()=>{
    const uid=user(),r=call(command(uid,0,null,'start',code));
    assert.equal(r.reason,'invalid_sensor_code');
    assert.equal(sql(`select count(*) from public.llt_sensor_contexts where user_id=${q(uid)};`),'0');
  });
}
check('legacy named and positional callers start/edit/replace/undo and preserve codes',()=>{
  const a=start('2345');
  const edit=command(a.uid,1,a.c.p.p_new_cycle_id,'edit_start',undefined,at(299));assert.equal(call(edit,true).status,'accepted');
  const replacement=command(a.uid,2,a.c.p.p_new_cycle_id,'start',undefined,at(1));assert.equal(call(replacement).status,'accepted');
  let s=snapshot(a.uid); assert.equal(s.cycles.find(c=>c.id===a.c.p.p_new_cycle_id).sensor_code,'2345');assert.equal(s.cycles.find(c=>c.id===replacement.p.p_new_cycle_id).sensor_code,undefined);
  assert.equal(call(command(a.uid,3,replacement.p.p_new_cycle_id,'undo_current')).status,'accepted');
  s=snapshot(a.uid);assert.equal(s.currentCycleId,a.c.p.p_new_cycle_id);assert.equal(s.cycles.find(c=>c.id===s.currentCycleId).sensor_code,'2345');
});
check('coded replacement and edit boundary/undo keep each physical cycle code',()=>{
  const a=start('1234'),b=command(a.uid,1,a.c.p.p_new_cycle_id,'start','0042',at(2));assert.equal(call(b).status,'accepted');
  const e=command(a.uid,2,b.p.p_new_cycle_id,'edit_start',undefined,at(3));assert.equal(call(e).status,'accepted');
  let s=snapshot(a.uid);assert.equal(s.cycles.find(c=>c.id===b.p.p_new_cycle_id).sensor_code,'0042');assert.equal(s.cycles.find(c=>c.id===a.c.p.p_new_cycle_id).sensor_code,'1234');
  assert.equal(call(command(a.uid,3,b.p.p_new_cycle_id,'undo_current')).status,'accepted');
  s=snapshot(a.uid);assert.equal(s.currentCycleId,a.c.p.p_new_cycle_id);assert.equal(s.cycles.find(c=>c.id===b.p.p_new_cycle_id).sensor_code,'0042');
  assert.equal(s.cycles.find(c=>c.id===s.currentCycleId).sensor_code,'1234');
  const audit=JSON.parse(sql(`select after_cycles from public.llt_sensor_operations where operation_id=${q(b.p.p_operation_id)};`));assert.deepEqual(audit.map(c=>c.sensor_code).sort(),['0042','1234']);
});
check('idempotency compares supplied code and preserves omitted/null request equivalence',()=>{
  const a=start('0042');assert.equal(call(a.c).replayed,true);const changed=structuredClone(a.c);changed.p.p_sensor_code='2345';assert.equal(call(changed).reason,'operation_id_reused');
  const old=start();const explicit=structuredClone(old.c);explicit.p.p_sensor_code=null;assert.equal(call(explicit).replayed,true);
});
check('non-start supplied code rejects and stale code-bearing writes conflict',()=>{
  const a=start('0042');
  for(const action of ['edit_start','undo_current']) assert.equal(call(command(a.uid,1,a.c.p.p_new_cycle_id,action,'2345',at(299))).reason,'invalid_action_shape');
  const stale=command(a.uid,0,a.c.p.p_new_cycle_id,'start','2345');assert.equal(call(stale).status,'conflict');assert.equal(call(stale).replayed,true);
  assert.equal(snapshot(a.uid).cycles.length,1);assert.equal(snapshot(a.uid).cycles[0].sensor_code,'0042');
});
check('security owner ACL RLS search_path and absence of overloads unchanged',()=>{
  assert.equal(security(),beforeSecurity);
  assert.equal(sql("select count(*) from pg_proc where proname='llt_mutate_sensor_cycle';"),'1');
  assert.equal(sql("select pronargs||'|'||pronargdefaults from pg_proc where proname='llt_mutate_sensor_cycle';"),'10|1');
  assert.equal(sql("select has_function_privilege('anon','public.llt_mutate_sensor_cycle(uuid,text,bigint,uuid,uuid,timestamptz,boolean,text,jsonb,text)','execute');"),'f');
  assert.equal(sql("select has_function_privilege('service_role','public.llt_mutate_sensor_cycle(uuid,text,bigint,uuid,uuid,timestamptz,boolean,text,jsonb,text)','execute');"),'f');
});
check('unauthenticated, foreign-owner direct writes and owner mismatch cannot steal code',()=>{
  const a=start('0042'),other=user();
  assert.throws(()=>sql(`set role authenticated;select public.llt_mutate_sensor_cycle(${q(randomUUID())},'start',0,null,${q(randomUUID())},now(),false,'Emily','{}','2345');`),/Authentication required/);
  assert.throws(()=>sql(`set role authenticated;update public.llt_sensor_cycles set sensor_code='2345';`),/permission denied/);
  assert.throws(()=>sql(`set role authenticated;delete from public.llt_sensor_cycles;`),/permission denied/);
  assert.throws(()=>sql(`set role authenticated;insert into public.llt_sensor_contexts(user_id) values(${q(other)});`),/permission denied/);
  assert.deepEqual(snapshot(other).cycles,[]);
  assert.notEqual(call(command(other,1,a.c.p.p_new_cycle_id,'edit_start',undefined,at(299))).status,'accepted');
  assert.equal(snapshot(a.uid).cycles[0].sensor_code,'0042');
});
check('migration repeat aborts without changes; nullable no-default column and no backfill',()=>{
  assert.throws(()=>sql(migration));assert.equal(security(),beforeSecurity);
  assert.equal(sql("select is_nullable||'|'||data_type||'|'||coalesce(column_default,'<none>') from information_schema.columns where table_name='llt_sensor_cycles' and column_name='sensor_code';"),'YES|text|<none>');
  assert.equal(snapshot(legacy.uid).revision,beforeSnapshot.revision);
  assert.equal(sql("select relfilenode from pg_class where oid='public.llt_sensor_cycles'::regclass;"),beforeFileNode);
});
check('shipped domain validator hydrates coded and legacy snapshots unchanged',()=>{
  const source=spawnSync('git',['show','HEAD:js/lee-lee-dexcom-sensor.js'],{encoding:'utf8'}).stdout;
  const ctx=vm.createContext({crypto:webcrypto});vm.runInContext(source,ctx);
  const a=start('0042');assert.equal(ctx.LeeLeeDexcomSensor.validate(snapshot(a.uid),a.uid).cycles[0].sensor_code,'0042');
  assert.equal(ctx.LeeLeeDexcomSensor.validate(snapshot(legacy.uid),legacy.uid).cycles[0].sensor_code,undefined);
});
function token(uid) {const b=value=>Buffer.from(JSON.stringify(value)).toString('base64url');const s=`${b({alg:'HS256',typ:'JWT'})}.${b({role:'authenticated',sub:uid,exp:Math.floor(Date.now()/1000)+600})}`;return `${s}.${createHmac('sha256',secret).update(s).digest('base64url')}`;}
async function api(name,uid,body={}) {const r=await fetch(`${baseURL}/rpc/${name}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token(uid)}`},body:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;}
check('actual disposable PostgREST resolves old/new named shapes and returns code',async()=>{
  const uid=user(),old=command(uid,0,null,'start',undefined,at(300));assert.equal((await api('llt_mutate_sensor_cycle',uid,old.p)).status,'accepted');
  const coded=command(uid,1,old.p.p_new_cycle_id,'start','0042',at(1));assert.equal((await api('llt_mutate_sensor_cycle',uid,coded.p)).status,'accepted');
  const response=await api('llt_get_sensor_snapshot',uid);assert.equal(response.snapshot.cycles.find(c=>c.id===coded.p.p_new_cycle_id).sensor_code,'0042');
  assert.equal(response.snapshot.cycles.find(c=>c.id===old.p.p_new_cycle_id).sensor_code,undefined);
});

check('concurrent coded replacement serializes and conflict cannot reassign codes', async()=>{
  const a=start('1234');
  const b=command(a.uid,1,a.c.p.p_new_cycle_id,'start','0042');
  const c=command(a.uid,1,a.c.p.p_new_cycle_id,'start','2345');
  const responses=await Promise.all([api('llt_mutate_sensor_cycle',a.uid,b.p),api('llt_mutate_sensor_cycle',a.uid,c.p)]);
  assert.deepEqual(responses.map(r=>r.status).sort(),['accepted','conflict']);
  const accepted=responses.findIndex(r=>r.status==='accepted'), requests=[b,c],winner=requests[accepted];
  const s=snapshot(a.uid);assert.equal(s.cycles.length,2);assert.equal(s.currentCycleId,winner.p.p_new_cycle_id);
  assert.equal(s.cycles.find(c=>c.id===s.currentCycleId).sensor_code,winner.p.p_sensor_code);
  assert.equal(s.cycles.find(c=>c.id===a.c.p.p_new_cycle_id).sensor_code,'1234');
});
check('actual shipped sync consumes same-revision legacy cache and builds old nine-key call',async()=>{
  const context=vm.createContext({crypto:webcrypto,navigator:{onLine:true},localStorage:{},setTimeout,clearTimeout});
  for(const file of ['js/lee-lee-dexcom-sensor.js','js/lee-lee-sensor-sync.js'])
    vm.runInContext(spawnSync('git',['show',`HEAD:${file}`],{encoding:'utf8'}).stdout,context);
  const cache=new Map([[`lando-world:llt-sensor:cache:v1:${legacy.uid}`,JSON.stringify({snapshot:beforeSnapshot,lastFetchedAt:new Date().toISOString()})]]);
  const storage={getItem:key=>cache.get(key)??null,setItem:(key,value)=>cache.set(key,value),removeItem:key=>cache.delete(key)};
  const channel={on(){return this;},subscribe(){return this;},unsubscribe(){}};
  let outgoing;
  const transport={channel:()=>channel,removeChannel(){},rpc(name,p){
    if(name==='llt_get_sensor_snapshot') return Promise.resolve({data:{status:'ok',snapshot:snapshot(legacy.uid)}});
    outgoing=p;return Promise.resolve({data:call({uid:legacy.uid,p})});
  }};
  const client=context.LeeLeeSensorSync.create({storage,locks:{request:(_key,fn)=>fn()}});
  client.connect({uid:legacy.uid,client:transport});await client.refresh();
  assert.equal(client.get().error,'');assert.equal(client.get().verified,true);
  const request=client.request('start',{start:at(1),confirmed:true,actor:'Emily',metadata:{}});
  assert.deepEqual(Object.keys(request).sort(),Object.keys(legacy.c.p).sort());
  assert.equal((await client.submit(request)).status,'accepted');assert.ok(outgoing);
  assert.equal(client.get().snapshot.cycles.find(c=>c.id===request.p_new_cycle_id).sensor_code,undefined);
});
check('all existing sensor PostgreSQL regressions pass on upgraded disposable database',()=>{
  const env={...process.env,LLT_LOCAL_SENSOR_DB_TEST:'1',LLT_LOCAL_SENSOR_DB_NAME:db};
  delete env.NODE_TEST_CONTEXT; // Child must run its own test runner, not inherit ours.
  const r=spawnSync(process.execPath,['--test','tests/llt-sensor-database.test.js'],{encoding:'utf8',env,maxBuffer:2e6});
  assert.equal(r.status,0,r.stdout+r.stderr);
  assert.match(r.stdout, /(?:# tests|ℹ tests) [1-9][0-9]*/);
  assert.match(r.stdout, /(?:# skipped|ℹ skipped) 0/);
  console.log('Existing sensor regression summary:',r.stdout.slice(-240));
});
check('current client code round-trips actual isolated PostgREST, DB, hydration, cache and second-device refetch',async()=>{
  const uid=user(),ctx=vm.createContext({crypto:webcrypto,navigator:{onLine:true},setTimeout,clearTimeout});
  for(const file of ['js/lee-lee-dexcom-sensor.js','js/lee-lee-sensor-sync.js']) vm.runInContext(readFileSync(file,'utf8'),ctx);
  const D=ctx.LeeLeeDexcomSensor;
  function device(){
    const cache=new Map();let invalidate;
    const storage={getItem:k=>cache.get(k)??null,setItem:(k,v)=>cache.set(k,v),removeItem:k=>cache.delete(k)};
    const transport={channel:()=>({on(_e,_f,fn){invalidate=fn;return this;},subscribe(){return this;}}),removeChannel(){},rpc:async(name,p)=>({data:await api(name,uid,p)})};
    const client=ctx.LeeLeeSensorSync.create({storage,locks:{request:(_key,fn)=>fn()}});
    client.connect({uid,client:transport});return {client,cache,invalidate:()=>invalidate()};
  }
  const a=device(),b=device();await Promise.all([a.client.refresh(),b.client.refresh()]);
  const first=a.client.request('start',{start:at(300),sensorCode:'2345',actor:'Emily'});
  assert.equal((await a.client.submit(first)).status,'accepted');
  const replacement=a.client.request('start',{start:at(24),confirmed:true,sensorCode:'0042',actor:'Emily'});
  assert.equal(replacement.p_sensor_code,'0042');
  assert.equal((await a.client.submit(replacement)).status,'accepted');
  assert.equal(sql(`select sensor_code from public.llt_sensor_cycles where user_id=${q(uid)} and id=${q(replacement.p_new_cycle_id)};`),'0042');
  await b.client.refresh();assert.equal(D.formatSensorLabel(D.current(b.client.get().snapshot)),'Dexcom G7 · 0042');
  assert.equal(JSON.parse(a.cache.get(`lando-world:llt-sensor:cache:v1:${uid}`)).snapshot.cycles[0].sensor_code,'0042');
  const edit=a.client.request('edit_start',{start:at(23),actor:'Emily'});
  assert.equal('p_sensor_code' in edit,false);assert.equal((await a.client.submit(edit)).status,'accepted');
  assert.equal(D.current(a.client.get().snapshot).sensor_code,'0042');
  const undo=a.client.request('undo_current',{actor:'Emily'});
  assert.equal('p_sensor_code' in undo,false);assert.equal((await a.client.submit(undo)).status,'accepted');
  await b.client.refresh();assert.equal(D.formatSensorLabel(D.current(b.client.get().snapshot)),'Dexcom G7 · 2345');
  assert.equal(b.client.get().snapshot.cycles.find(c=>c.id===replacement.p_new_cycle_id).sensor_code,'0042');
});
