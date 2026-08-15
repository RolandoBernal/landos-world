-- Repair version-aware LLT RPCs that incorrectly schema-qualified COALESCE.
-- COALESCE is SQL syntax, not a callable pg_catalog function, so the qualified form
-- fails with SQLSTATE 42883 before queued updates can complete.

create or replace function public.update_lee_lee_record_with_version(
  p_id uuid,
  p_expected_version integer,
  p_record_type text,
  p_blood_sugar integer,
  p_insulin_units numeric,
  p_administered_insulin_units numeric,
  p_suggested_base_units numeric,
  p_suggested_correction_units numeric,
  p_suggested_total_units numeric,
  p_insulin_plan_id text,
  p_insulin_plan_snapshot jsonb,
  p_dose_calculation_status text,
  p_notes text,
  p_recorded_at timestamptz,
  p_entered_by text,
  p_last_edited_by text,
  p_deleted_at timestamptz,
  p_deleted_by text,
  p_source text,
  p_client_created_at timestamptz,
  p_migration_fingerprint text,
  p_import_fingerprint text,
  p_app_schema_version integer,
  p_payload jsonb
)
returns public.lee_lee_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
  updated_record public.lee_lee_records;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    raise exception 'Lee-Lee record updates require an authenticated user.'
      using errcode = '28000';
  end if;

  update public.lee_lee_records
  set
    record_type = p_record_type,
    blood_sugar = p_blood_sugar,
    insulin_units = p_insulin_units,
    administered_insulin_units = p_administered_insulin_units,
    suggested_base_units = p_suggested_base_units,
    suggested_correction_units = p_suggested_correction_units,
    suggested_total_units = p_suggested_total_units,
    insulin_plan_id = p_insulin_plan_id,
    insulin_plan_snapshot = p_insulin_plan_snapshot,
    dose_calculation_status = p_dose_calculation_status,
    notes = coalesce(p_notes, ''),
    recorded_at = p_recorded_at,
    entered_by = p_entered_by,
    last_edited_by = p_last_edited_by,
    deleted_at = p_deleted_at,
    deleted_by = p_deleted_by,
    source = p_source,
    client_created_at = p_client_created_at,
    migration_fingerprint = p_migration_fingerprint,
    import_fingerprint = p_import_fingerprint,
    app_schema_version = p_app_schema_version,
    payload = coalesce(p_payload, '{}'::jsonb),
    version = public.lee_lee_records.version + 1
  where
    id = p_id
    and user_id = current_user_id
    and version = p_expected_version
  returning * into updated_record;

  return updated_record;
end;
$$;

revoke all on function public.update_lee_lee_record_with_version(
  uuid, integer, text, integer, numeric, numeric, numeric, numeric, numeric,
  text, jsonb, text, text, timestamptz, text, text, timestamptz, text,
  text, timestamptz, text, text, integer, jsonb
) from public, anon;

grant execute on function public.update_lee_lee_record_with_version(
  uuid, integer, text, integer, numeric, numeric, numeric, numeric, numeric,
  text, jsonb, text, text, timestamptz, text, text, timestamptz, text,
  text, timestamptz, text, text, integer, jsonb
) to authenticated;

create or replace function public.update_lee_lee_shared_settings_with_version(
  p_expected_version integer,
  p_patient_name text,
  p_patient_date_of_birth date,
  p_clinic_name text,
  p_clinic_phone text,
  p_last_edited_by text,
  p_payload jsonb,
  p_app_schema_version integer
)
returns public.lee_lee_shared_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
  updated_settings public.lee_lee_shared_settings;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    raise exception 'Lee-Lee shared settings updates require an authenticated user.'
      using errcode = '28000';
  end if;

  update public.lee_lee_shared_settings
  set
    patient_name = p_patient_name,
    patient_date_of_birth = p_patient_date_of_birth,
    clinic_name = p_clinic_name,
    clinic_phone = p_clinic_phone,
    last_edited_by = p_last_edited_by,
    payload = coalesce(p_payload, '{}'::jsonb),
    app_schema_version = p_app_schema_version,
    version = public.lee_lee_shared_settings.version + 1
  where
    user_id = current_user_id
    and version = p_expected_version
  returning * into updated_settings;

  return updated_settings;
end;
$$;

revoke all on function public.update_lee_lee_shared_settings_with_version(
  integer, text, date, text, text, text, jsonb, integer
) from public, anon;

grant execute on function public.update_lee_lee_shared_settings_with_version(
  integer, text, date, text, text, text, jsonb, integer
) to authenticated;
