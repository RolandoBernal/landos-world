-- READ ONLY. Run only after separately approved migration on confirmed production.
-- Repeat preflight.sql and compare fingerprints across a quiet window as well.
begin transaction read only;
select column_name,data_type,is_nullable,column_default from information_schema.columns
where table_schema='public' and table_name='llt_sensor_cycles'
and column_name in ('replacement_reason_id','replacement_notes','replacement_requested') order by column_name;
select p.oid::regprocedure::text signature,pg_get_userbyid(p.proowner) owner,p.prosecdef,p.proconfig,p.proacl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('llt_get_sensor_snapshot','llt_mutate_sensor_cycle','llt_sensor_snapshot_for_user');
select conname,pg_get_constraintdef(oid) from pg_constraint where conrelid in
('public.llt_sensor_cycles'::regclass,'public.llt_sensor_operations'::regclass) order by conname;
select count(*) invalid_metadata from public.llt_sensor_cycles where
(replacement_reason_id is not null and replacement_reason_id not in
('normal_expiration','did_not_pair','brief_sensor_issue','inaccurate_readings','signal_loss','bleeding_bruising','applying_sensor','sensor_failed','fell_off','skin_irritation','accidentally_removed','other'))
or char_length(replacement_notes)>2000;
select count(*) total,count(*) filter(where replacement_reason_id is null and replacement_notes is null and replacement_requested is null) all_unknown,
count(*) filter(where replacement_requested=false) explicit_no from public.llt_sensor_cycles;
select count(*) broken_current_pointers from public.llt_sensor_contexts h left join public.llt_sensor_cycles c
on c.user_id=h.user_id and c.id=h.current_cycle_id where h.current_cycle_id is not null and (c.id is null or c.state<>'current');
-- Type roundtrip without patient writes. Actual RPC FALSE persistence is isolated-test evidence.
select (jsonb_build_object('replacement_requested',false)->>'replacement_requested')::boolean is false as explicit_false_roundtrip,
jsonb_build_object('replacement_requested',null)->'replacement_requested'='null'::jsonb as unknown_roundtrip;
commit;
