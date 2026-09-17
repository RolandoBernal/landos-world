-- Append-only audit history for shared LLT settings changes.
-- This migration is additive. Existing settings, records, queues, and history are untouched.

create table if not exists public.lee_lee_settings_audit (
  event_id uuid primary key,
  settings_record_id text not null default 'shared-settings',
  version_before integer,
  version_after integer,
  authorized_user_id uuid not null references auth.users(id) on delete restrict,
  display_name text not null default 'Unknown',
  device_profile text not null default 'Unknown device',
  device_installation_id text not null,
  device_label text not null default 'Unknown device',
  device_platform text not null default 'Browser',
  app_environment text not null default 'Unknown',
  app_version text not null default 'Unknown',
  client_created_at timestamptz not null,
  accepted_at timestamptz,
  status text not null check (status in ('Requested', 'Accepted', 'Conflict', 'Rejected', 'Failed')),
  changed_fields jsonb not null default '[]'::jsonb,
  previous_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  change_note text,
  created_at timestamptz not null default pg_catalog.now()
);

create index if not exists lee_lee_settings_audit_user_accepted_idx
  on public.lee_lee_settings_audit (authorized_user_id, accepted_at desc);

create index if not exists lee_lee_settings_audit_record_accepted_idx
  on public.lee_lee_settings_audit (settings_record_id, accepted_at desc);

alter table public.lee_lee_settings_audit enable row level security;
revoke all on public.lee_lee_settings_audit from anon, public, authenticated;
grant select on public.lee_lee_settings_audit to authenticated;

drop policy if exists "Lee-Lee settings audit select own events" on public.lee_lee_settings_audit;
create policy "Lee-Lee settings audit select own events"
on public.lee_lee_settings_audit
for select
to authenticated
using (authorized_user_id = auth.uid());

create or replace function public.insert_lee_lee_shared_settings_with_audit(
  p_settings jsonb,
  p_audit_event jsonb
)
returns public.lee_lee_shared_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  inserted_settings public.lee_lee_shared_settings;
begin
  if current_user_id is null then
    raise exception 'Lee-Lee shared settings updates require an authenticated user.' using errcode = '28000';
  end if;

  insert into public.lee_lee_shared_settings (
    user_id, patient_name, patient_date_of_birth, clinic_name, clinic_phone,
    last_edited_by, payload, app_schema_version
  )
  values (
    current_user_id,
    nullif(p_settings->>'patient_name', ''),
    nullif(p_settings->>'patient_date_of_birth', '')::date,
    nullif(p_settings->>'clinic_name', ''),
    nullif(p_settings->>'clinic_phone', ''),
    nullif(p_settings->>'last_edited_by', ''),
    coalesce(p_settings->'payload', '{}'::jsonb),
    coalesce((p_settings->>'app_schema_version')::integer, 1)
  )
  returning * into inserted_settings;

  if p_audit_event is not null and p_audit_event->>'event_id' is not null then
  insert into public.lee_lee_settings_audit (
    event_id, settings_record_id, version_before, version_after, authorized_user_id,
    display_name, device_profile, device_installation_id, device_label, device_platform, app_environment,
    app_version, client_created_at, accepted_at, status, changed_fields,
    previous_values, new_values, change_note
  )
  values (
    (p_audit_event->>'event_id')::uuid, 'shared-settings', null, inserted_settings.version, current_user_id,
    coalesce(p_audit_event->>'display_name', 'Unknown'), coalesce(p_audit_event->>'device_profile', 'Unknown device'), p_audit_event->>'device_installation_id',
    coalesce(p_audit_event->>'device_label', 'Unknown device'), coalesce(p_audit_event->>'device_platform', 'Browser'),
    coalesce(p_audit_event->>'app_environment', 'Unknown'), coalesce(p_audit_event->>'app_version', 'Unknown'),
    (p_audit_event->>'client_created_at')::timestamptz, pg_catalog.now(), 'Accepted',
    coalesce(p_audit_event->'changed_fields', '[]'::jsonb), coalesce(p_audit_event->'previous_values', '{}'::jsonb),
    coalesce(p_audit_event->'new_values', '{}'::jsonb), nullif(p_audit_event->>'change_note', '')
  ) on conflict (event_id) do nothing;
  end if;

  return inserted_settings;
end;
$$;

create or replace function public.update_lee_lee_shared_settings_with_audit(
  p_expected_version integer,
  p_patient_name text,
  p_patient_date_of_birth date,
  p_clinic_name text,
  p_clinic_phone text,
  p_last_edited_by text,
  p_payload jsonb,
  p_app_schema_version integer,
  p_audit_event jsonb
)
returns public.lee_lee_shared_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  updated_settings public.lee_lee_shared_settings;
begin
  if current_user_id is null then
    raise exception 'Lee-Lee shared settings updates require an authenticated user.' using errcode = '28000';
  end if;

  update public.lee_lee_shared_settings
  set patient_name = p_patient_name,
      patient_date_of_birth = p_patient_date_of_birth,
      clinic_name = p_clinic_name,
      clinic_phone = p_clinic_phone,
      last_edited_by = p_last_edited_by,
      payload = coalesce(p_payload, '{}'::jsonb),
      app_schema_version = p_app_schema_version,
      version = public.lee_lee_shared_settings.version + 1
  where user_id = current_user_id and version = p_expected_version
  returning * into updated_settings;

  if updated_settings.user_id is not null and p_audit_event is not null and p_audit_event->>'event_id' is not null then
    insert into public.lee_lee_settings_audit (
      event_id, settings_record_id, version_before, version_after, authorized_user_id,
      display_name, device_profile, device_installation_id, device_label, device_platform, app_environment,
      app_version, client_created_at, accepted_at, status, changed_fields,
      previous_values, new_values, change_note
    )
    values (
      (p_audit_event->>'event_id')::uuid, 'shared-settings', p_expected_version, updated_settings.version, current_user_id,
      coalesce(p_audit_event->>'display_name', 'Unknown'), coalesce(p_audit_event->>'device_profile', 'Unknown device'), p_audit_event->>'device_installation_id',
      coalesce(p_audit_event->>'device_label', 'Unknown device'), coalesce(p_audit_event->>'device_platform', 'Browser'),
      coalesce(p_audit_event->>'app_environment', 'Unknown'), coalesce(p_audit_event->>'app_version', 'Unknown'),
      (p_audit_event->>'client_created_at')::timestamptz, pg_catalog.now(), 'Accepted',
      coalesce(p_audit_event->'changed_fields', '[]'::jsonb), coalesce(p_audit_event->'previous_values', '{}'::jsonb),
      coalesce(p_audit_event->'new_values', '{}'::jsonb), nullif(p_audit_event->>'change_note', '')
    ) on conflict (event_id) do nothing;
  end if;

  return updated_settings;
end;
$$;

create or replace function public.append_lee_lee_settings_audit_event(p_audit_event jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare current_user_id uuid := auth.uid();
declare event_status text := p_audit_event->>'status';
begin
  if current_user_id is null then
    raise exception 'Lee-Lee audit events require an authenticated user.' using errcode = '28000';
  end if;
  if event_status not in ('Conflict', 'Rejected', 'Failed') then
    raise exception 'Only non-accepted audit events may be appended directly.' using errcode = '42501';
  end if;
  insert into public.lee_lee_settings_audit (
    event_id, settings_record_id, version_before, version_after, authorized_user_id,
    display_name, device_profile, device_installation_id, device_label, device_platform, app_environment,
    app_version, client_created_at, status, changed_fields, previous_values, new_values, change_note
  ) values (
    (p_audit_event->>'event_id')::uuid, 'shared-settings', nullif(p_audit_event->>'version_before', '')::integer,
    nullif(p_audit_event->>'version_after', '')::integer, current_user_id,
    coalesce(p_audit_event->>'display_name', 'Unknown'), coalesce(p_audit_event->>'device_profile', 'Unknown device'), p_audit_event->>'device_installation_id',
    coalesce(p_audit_event->>'device_label', 'Unknown device'), coalesce(p_audit_event->>'device_platform', 'Browser'),
    coalesce(p_audit_event->>'app_environment', 'Unknown'), coalesce(p_audit_event->>'app_version', 'Unknown'),
    (p_audit_event->>'client_created_at')::timestamptz, event_status,
    coalesce(p_audit_event->'changed_fields', '[]'::jsonb), coalesce(p_audit_event->'previous_values', '{}'::jsonb),
    coalesce(p_audit_event->'new_values', '{}'::jsonb), nullif(p_audit_event->>'change_note', '')
  ) on conflict (event_id) do nothing;
end;
$$;

revoke all on function public.insert_lee_lee_shared_settings_with_audit(jsonb, jsonb) from public, anon;
grant execute on function public.insert_lee_lee_shared_settings_with_audit(jsonb, jsonb) to authenticated;
revoke all on function public.update_lee_lee_shared_settings_with_audit(integer, text, date, text, text, text, jsonb, integer, jsonb) from public, anon;
grant execute on function public.update_lee_lee_shared_settings_with_audit(integer, text, date, text, text, text, jsonb, integer, jsonb) to authenticated;
revoke all on function public.append_lee_lee_settings_audit_event(jsonb) from public, anon;
grant execute on function public.append_lee_lee_settings_audit_event(jsonb) to authenticated;
