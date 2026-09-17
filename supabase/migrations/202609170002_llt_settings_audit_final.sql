-- FINAL REVIEWED LLT SETTINGS AUDIT MIGRATION
-- Apply this file instead of 202609170001_create_lee_lee_settings_audit.sql.
-- It is additive and keeps one shared settings row per auth.uid().

create table if not exists public.lee_lee_settings_audit (
  event_id uuid primary key,
  settings_record_id text not null default 'shared-settings',
  version_before integer,
  version_after integer,
  authorized_user_id uuid not null references auth.users(id) on delete restrict,
  actor_name text not null default 'Unknown',
  device_profile text not null default 'Unknown device',
  device_installation_id text not null default 'unknown-installation',
  device_platform text not null default 'Browser',
  app_environment text not null default 'Unknown',
  app_version text not null default 'Unknown',
  client_created_at timestamptz,
  accepted_at timestamptz,
  status text not null check (status in ('Accepted', 'Conflict', 'Rejected', 'Failed')),
  changed_fields jsonb not null default '[]'::jsonb,
  previous_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  change_note text,
  created_at timestamptz not null default pg_catalog.now()
);

create index if not exists lee_lee_settings_audit_user_accepted_idx on public.lee_lee_settings_audit (authorized_user_id, accepted_at desc);
create index if not exists lee_lee_settings_audit_record_accepted_idx on public.lee_lee_settings_audit (settings_record_id, accepted_at desc);
alter table public.lee_lee_settings_audit enable row level security;
revoke all on public.lee_lee_settings_audit from anon, public, authenticated;
grant select on public.lee_lee_settings_audit to authenticated;
drop policy if exists "Lee-Lee settings audit select own events" on public.lee_lee_settings_audit;
create policy "Lee-Lee settings audit select own events" on public.lee_lee_settings_audit for select to authenticated using (authorized_user_id = auth.uid());

create or replace function public.llt_safe_timestamptz(value text) returns timestamptz language plpgsql immutable set search_path = '' as $$
begin
  if value is null or btrim(value) = '' then return null; end if;
  return value::timestamptz;
exception when others then return null;
end; $$;

create or replace function public.llt_settings_snapshot(p_patient_name text, p_birth date, p_clinic_name text, p_clinic_phone text, p_payload jsonb)
returns jsonb language sql immutable set search_path = '' as $$
select jsonb_build_object(
  'patient_name',p_patient_name,'patient_date_of_birth',p_birth,'clinic_name',p_clinic_name,'clinic_phone',p_clinic_phone,
  'plan_name',p_payload #>> '{insulinConfiguration,activeInsulinPlan,name}',
  'effective_from',p_payload #>> '{insulinConfiguration,activeInsulinPlan,effectiveFrom}',
  'breakfast_dose',p_payload #>> '{insulinConfiguration,activeInsulinPlan,mealBaseUnitsByType,Breakfast}',
  'lunch_dose',p_payload #>> '{insulinConfiguration,activeInsulinPlan,mealBaseUnitsByType,Lunch}',
  'dinner_dose',p_payload #>> '{insulinConfiguration,activeInsulinPlan,mealBaseUnitsByType,Dinner}',
  'bedtime_long_acting_dose',p_payload #>> '{insulinConfiguration,activeInsulinPlan,bedtimeBaseUnits}',
  'insulin_to_carb_ratio',p_payload #>> '{insulinConfiguration,activeInsulinPlan,insulinCarbRatioGrams}',
  'rounding_mode',p_payload #>> '{insulinConfiguration,activeInsulinPlan,doseRoundingMode}',
  'dose_increment',p_payload #>> '{insulinConfiguration,activeInsulinPlan,doseIncrementUnits}',
  'minimum_allowable_dose',p_payload #>> '{insulinConfiguration,activeInsulinPlan,minimumAllowableDoseUnits}',
  'target_glucose_min',p_payload #>> '{insulinConfiguration,activeInsulinPlan,targetGlucoseMin}',
  'target_glucose_max',p_payload #>> '{insulinConfiguration,activeInsulinPlan,targetGlucoseMax}',
  'temporary_eating_adjustment',coalesce(p_payload #> '{insulinConfiguration,activeInsulinPlan,temporaryEatingAdjustment}','{}'::jsonb),
  'correction_ranges',coalesce(p_payload #> '{insulinConfiguration,activeInsulinPlan,correctionRanges}','[]'::jsonb)
);
$$;

create or replace function public.llt_settings_changes(p_before jsonb, p_after jsonb) returns jsonb language sql immutable set search_path = '' as $$
select coalesce(jsonb_agg(jsonb_build_object('key',k.key,'previousValue',p_before->k.key,'newValue',p_after->k.key) order by k.key),'[]'::jsonb)
from jsonb_object_keys(coalesce(p_before,'{}'::jsonb)||coalesce(p_after,'{}'::jsonb)) k(key)
where (p_before->k.key) is distinct from (p_after->k.key);
$$;

create or replace function public.update_lee_lee_shared_settings_with_audit(p_expected_version integer,p_patient_name text,p_patient_date_of_birth date,p_clinic_name text,p_clinic_phone text,p_last_edited_by text,p_payload jsonb,p_app_schema_version integer,p_audit_event jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); before_row public.lee_lee_shared_settings; after_row public.lee_lee_shared_settings; before_json jsonb; after_json jsonb; event_uuid uuid;
begin
  if uid is null then raise exception 'LLT settings updates require authentication.' using errcode='28000'; end if;
  if p_expected_version is null or p_expected_version < 1 then raise exception 'Invalid expected settings version.' using errcode='22023'; end if;
  event_uuid := (p_audit_event->>'event_id')::uuid;
  select * into before_row from public.lee_lee_shared_settings where user_id=uid;
  if before_row.user_id is null then raise exception 'LLT shared settings profile was not found.' using errcode='P0002'; end if;
  if before_row.version <> p_expected_version then
    insert into public.lee_lee_settings_audit(event_id,version_before,version_after,authorized_user_id,actor_name,device_profile,device_installation_id,device_platform,app_environment,app_version,client_created_at,status)
    values(event_uuid,p_expected_version,before_row.version,uid,coalesce(nullif(p_audit_event->>'display_name',''),'Unknown'),coalesce(nullif(p_audit_event->>'device_profile',''),'Unknown device'),coalesce(nullif(p_audit_event->>'device_installation_id',''),'unknown-installation'),coalesce(nullif(p_audit_event->>'device_platform',''),'Browser'),coalesce(nullif(p_audit_event->>'app_environment',''),'Unknown'),coalesce(nullif(p_audit_event->>'app_version',''),'Unknown'),public.llt_safe_timestamptz(p_audit_event->>'client_created_at'),'Conflict') on conflict(event_id) do nothing;
    return jsonb_build_object('status','conflict','versionBefore',p_expected_version,'versionAfter',before_row.version,'settings',to_jsonb(before_row),'eventId',event_uuid);
  end if;
  before_json:=public.llt_settings_snapshot(before_row.patient_name,before_row.patient_date_of_birth,before_row.clinic_name,before_row.clinic_phone,before_row.payload);
  update public.lee_lee_shared_settings set patient_name=p_patient_name,patient_date_of_birth=p_patient_date_of_birth,clinic_name=p_clinic_name,clinic_phone=p_clinic_phone,last_edited_by=p_last_edited_by,payload=coalesce(p_payload,'{}'::jsonb),app_schema_version=coalesce(p_app_schema_version,1),version=version+1 where user_id=uid and version=p_expected_version returning * into after_row;
  after_json:=public.llt_settings_snapshot(after_row.patient_name,after_row.patient_date_of_birth,after_row.clinic_name,after_row.clinic_phone,after_row.payload);
  insert into public.lee_lee_settings_audit(event_id,version_before,version_after,authorized_user_id,actor_name,device_profile,device_installation_id,device_platform,app_environment,app_version,client_created_at,accepted_at,status,changed_fields,previous_values,new_values,change_note)
  values(event_uuid,before_row.version,after_row.version,uid,coalesce(nullif(p_audit_event->>'display_name',''),'Unknown'),coalesce(nullif(p_audit_event->>'device_profile',''),'Unknown device'),coalesce(nullif(p_audit_event->>'device_installation_id',''),'unknown-installation'),coalesce(nullif(p_audit_event->>'device_platform',''),'Browser'),coalesce(nullif(p_audit_event->>'app_environment',''),'Unknown'),coalesce(nullif(p_audit_event->>'app_version',''),'Unknown'),public.llt_safe_timestamptz(p_audit_event->>'client_created_at'),pg_catalog.now(),'Accepted',public.llt_settings_changes(before_json,after_json),before_json,after_json,nullif(p_audit_event->>'change_note','')) on conflict(event_id) do nothing;
  return jsonb_build_object('status','accepted','versionBefore',before_row.version,'versionAfter',after_row.version,'settings',to_jsonb(after_row),'eventId',event_uuid,'acceptedAt',pg_catalog.now(),'changedFields',public.llt_settings_changes(before_json,after_json));
end; $$;

create or replace function public.insert_lee_lee_shared_settings_with_audit(p_settings jsonb,p_audit_event jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); row_data public.lee_lee_shared_settings; existing public.lee_lee_shared_settings; event_uuid uuid; after_json jsonb;
begin
  if uid is null then raise exception 'LLT settings creation requires authentication.' using errcode='28000'; end if;
  event_uuid:=(p_audit_event->>'event_id')::uuid;
  insert into public.lee_lee_shared_settings(user_id,patient_name,patient_date_of_birth,clinic_name,clinic_phone,last_edited_by,payload,app_schema_version) values(uid,nullif(p_settings->>'patient_name',''),nullif(p_settings->>'patient_date_of_birth','')::date,nullif(p_settings->>'clinic_name',''),nullif(p_settings->>'clinic_phone',''),nullif(p_settings->>'last_edited_by',''),coalesce(p_settings->'payload','{}'::jsonb),coalesce((p_settings->>'app_schema_version')::integer,1)) on conflict(user_id) do nothing returning * into row_data;
  if row_data.user_id is null then select * into existing from public.lee_lee_shared_settings where user_id=uid; return jsonb_build_object('status','conflict','versionAfter',existing.version,'eventId',event_uuid); end if;
  after_json:=public.llt_settings_snapshot(row_data.patient_name,row_data.patient_date_of_birth,row_data.clinic_name,row_data.clinic_phone,row_data.payload);
  insert into public.lee_lee_settings_audit(event_id,version_after,authorized_user_id,actor_name,device_profile,device_installation_id,device_platform,app_environment,app_version,client_created_at,accepted_at,status,changed_fields,new_values) values(event_uuid,row_data.version,uid,coalesce(nullif(p_audit_event->>'display_name',''),'Unknown'),coalesce(nullif(p_audit_event->>'device_profile',''),'Unknown device'),coalesce(nullif(p_audit_event->>'device_installation_id',''),'unknown-installation'),coalesce(nullif(p_audit_event->>'device_platform',''),'Browser'),coalesce(nullif(p_audit_event->>'app_environment',''),'Unknown'),coalesce(nullif(p_audit_event->>'app_version',''),'Unknown'),public.llt_safe_timestamptz(p_audit_event->>'client_created_at'),pg_catalog.now(),'Accepted',public.llt_settings_changes('{}'::jsonb,after_json),after_json) on conflict(event_id) do nothing;
  return jsonb_build_object('status','accepted','versionAfter',row_data.version,'settings',to_jsonb(row_data),'eventId',event_uuid,'acceptedAt',pg_catalog.now(),'changedFields',public.llt_settings_changes('{}'::jsonb,after_json));
end; $$;

create or replace function public.append_lee_lee_settings_audit_event(p_audit_event jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); s text:=p_audit_event->>'status';
begin
  if uid is null then raise exception 'LLT audit events require authentication.' using errcode='28000'; end if;
  if s not in ('Rejected','Failed') then raise exception 'Only Rejected or Failed events may be appended.' using errcode='42501'; end if;
  insert into public.lee_lee_settings_audit(event_id,authorized_user_id,actor_name,device_profile,device_installation_id,device_platform,app_environment,app_version,client_created_at,status,changed_fields,previous_values,new_values,change_note) values((p_audit_event->>'event_id')::uuid,uid,coalesce(nullif(p_audit_event->>'display_name',''),'Unknown'),coalesce(nullif(p_audit_event->>'device_profile',''),'Unknown device'),coalesce(nullif(p_audit_event->>'device_installation_id',''),'unknown-installation'),coalesce(nullif(p_audit_event->>'device_platform',''),'Browser'),coalesce(nullif(p_audit_event->>'app_environment',''),'Unknown'),coalesce(nullif(p_audit_event->>'app_version',''),'Unknown'),public.llt_safe_timestamptz(p_audit_event->>'client_created_at'),s,coalesce(p_audit_event->'changed_fields','[]'::jsonb),coalesce(p_audit_event->'previous_values','{}'::jsonb),coalesce(p_audit_event->'new_values','{}'::jsonb),nullif(p_audit_event->>'change_note','')) on conflict(event_id) do nothing;
end; $$;

revoke all on function public.llt_safe_timestamptz(text) from public,anon,authenticated;
revoke all on function public.llt_settings_snapshot(text,date,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.llt_settings_changes(jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.update_lee_lee_shared_settings_with_audit(integer,text,date,text,text,text,jsonb,integer,jsonb) from public,anon;
grant execute on function public.update_lee_lee_shared_settings_with_audit(integer,text,date,text,text,text,jsonb,integer,jsonb) to authenticated;
revoke all on function public.insert_lee_lee_shared_settings_with_audit(jsonb,jsonb) from public,anon;
grant execute on function public.insert_lee_lee_shared_settings_with_audit(jsonb,jsonb) to authenticated;
revoke all on function public.append_lee_lee_settings_audit_event(jsonb) from public,anon;
grant execute on function public.append_lee_lee_settings_audit_event(jsonb) to authenticated;
