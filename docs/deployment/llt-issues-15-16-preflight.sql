-- READ ONLY. Production catalog and aggregate integrity evidence. No patient rows.
-- Confirm project ujbfqcggtuhagsgwcocr. Save output privately.
begin transaction read only;
select jsonb_build_object(
'identity',(select coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb) from (select current_database() database_name, current_user actor, version() postgres_version) q),
'migration_history',(select coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb) from (select to_regclass('supabase_migrations.schema_migrations') migration_history_table) q),
'columns',(select coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb) from (select table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns where table_schema='public'
and table_name in ('llt_sensor_contexts','llt_sensor_cycles','llt_sensor_operations')
order by table_name,ordinal_position) q),
'tables',(select coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb) from (select c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) owner
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('llt_sensor_contexts','llt_sensor_cycles','llt_sensor_operations')) q),
'policies',(select coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb) from (select tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename in ('llt_sensor_contexts','llt_sensor_cycles','llt_sensor_operations')) q),
'table_grants',(select coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb) from (select table_name,grantee,privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name in ('llt_sensor_contexts','llt_sensor_cycles','llt_sensor_operations') order by table_name,grantee,privilege_type) q),
'functions',(select coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb) from (select p.oid::regprocedure::text signature,pg_get_userbyid(p.proowner) owner,
p.prosecdef,p.proconfig,p.proacl,pg_get_functiondef(p.oid) definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('llt_sensor_snapshot_for_user','llt_get_sensor_snapshot','llt_mutate_sensor_cycle') order by p.proname,p.oid) q),
'constraints',(select coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb) from (select c.relname,con.conname,pg_get_constraintdef(con.oid) definition
from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('llt_sensor_contexts','llt_sensor_cycles','llt_sensor_operations') order by c.relname,con.conname) q),
'dependencies',(select coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb) from (select pg_describe_object(d.classid,d.objid,d.objsubid) dependent_object,d.deptype
from pg_depend d where d.refobjid in (select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='llt_mutate_sensor_cycle')) q),
'triggers',(select coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb) from (select c.relname,pg_get_triggerdef(t.oid) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname='public'
and c.relname in ('llt_sensor_contexts','llt_sensor_cycles','llt_sensor_operations')) q),
'fingerprints',(select coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb) from (select 'contexts' entity,count(*) records,md5(coalesce(string_agg(to_jsonb(c)::text,'|' order by user_id),'')) fingerprint from public.llt_sensor_contexts c
union all select 'cycles',count(*),md5(coalesce(string_agg((to_jsonb(c)-array['replacement_reason_id','replacement_notes','replacement_requested'])::text,'|' order by user_id,id),'')) from public.llt_sensor_cycles c
union all select 'operations',count(*),md5(coalesce(string_agg(to_jsonb(c)::text,'|' order by user_id,operation_id),'')) from public.llt_sensor_operations c) q)) evidence;
commit;
