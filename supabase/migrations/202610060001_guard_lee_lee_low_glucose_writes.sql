-- Targeted compatibility protection; no clinical interpretation or data rewrite.
begin;

create or replace function public.guard_lee_lee_low_glucose_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  old_protected boolean := false;
  new_protected boolean;
  episode jsonb;
  previous_episode jsonb;
  field_name text;
  incompatible boolean;
begin
  if TG_OP = 'UPDATE' then
    old_protected := OLD.record_type = 'Low Glucose'
      or coalesce(OLD.payload->>'type' = 'Low Glucose', false)
      or coalesce(OLD.payload ? 'lowGlucoseEpisode', false);
  end if;
  new_protected := NEW.record_type = 'Low Glucose'
    or coalesce(NEW.payload->>'type' = 'Low Glucose', false)
    or coalesce(NEW.payload ? 'lowGlucoseEpisode', false);
  if not old_protected and not new_protected then
    return NEW;
  end if;

  episode := NEW.payload->'lowGlucoseEpisode';
  incompatible :=
    pg_catalog.jsonb_typeof(NEW.payload) is distinct from 'object'
    or NEW.record_type is distinct from 'Low Glucose'
    or NEW.payload->>'type' is distinct from 'Low Glucose'
    or NEW.payload->>'eventType' is distinct from 'check-insulin'
    or pg_catalog.jsonb_typeof(episode) is distinct from 'object'
    or NEW.insulin_units is not null
    or NEW.administered_insulin_units is not null
    or NEW.suggested_base_units is not null
    or NEW.suggested_correction_units is not null
    or NEW.suggested_total_units is not null
    or NEW.insulin_plan_id is not null
    or NEW.insulin_plan_snapshot is not null
    or NEW.dose_calculation_status is distinct from 'not-applicable'
    or NEW.payload->>'doseCalculationStatus' is distinct from 'not-applicable';

  if TG_OP = 'UPDATE' and old_protected then
    incompatible := incompatible or NEW.id is distinct from OLD.id
      or NEW.user_id is distinct from OLD.user_id;
  end if;

  -- Column-mirrored values are authoritative on hydration. Also reject their
  -- known payload representations and payload-only numerical dose breakdowns.
  -- These fields are consumed by normalization/cards/reports, not debug metadata.
  foreach field_name in array array[
    'insulinUnits', 'administeredInsulinUnits', 'suggestedBaseUnits',
    'suggestedCorrectionUnits', 'suggestedTotalUnits',
    'insulinPlanId', 'insulinPlanSnapshot',
    'suggestedCarbDoseUnits', 'carbDoseUnits', 'roundedCarbDose',
    'rawCarbDose', 'rawAggregateDose', 'roundedBaseDose',
    'temporaryEatingAdjustmentUnits'
  ] loop
    if NEW.payload ? field_name
      and NEW.payload->field_name is distinct from 'null'::jsonb then
      incompatible := true;
    end if;
  end loop;
  if NEW.payload ? 'temporaryEatingAdjustmentApplied'
    and NEW.payload->'temporaryEatingAdjustmentApplied' is distinct from 'null'::jsonb
    and NEW.payload->'temporaryEatingAdjustmentApplied' is distinct from 'false'::jsonb then
    incompatible := true;
  end if;

  -- Only top-level envelope types are protected. Recheck contents, closure
  -- references, thresholds, timestamps and treatment semantics belong to clients.
  if pg_catalog.jsonb_typeof(episode) = 'object' then
    if not (episode ?& array[
      'version', 'thresholdSnapshot', 'rechecks', 'closure', 'pendingRecheck'
    ]) then
      incompatible := true;
    end if;
    if pg_catalog.jsonb_typeof(episode->'version') is distinct from 'number' then
      incompatible := true;
    elsif (episode->>'version')::numeric <= 0
      or pg_catalog.trunc((episode->>'version')::numeric) <> (episode->>'version')::numeric then
      incompatible := true;
    elsif TG_OP = 'UPDATE' and old_protected then
      previous_episode := OLD.payload->'lowGlucoseEpisode';
      if pg_catalog.jsonb_typeof(previous_episode->'version') = 'number' then
        if (previous_episode->>'version')::numeric > 0
          and pg_catalog.trunc((previous_episode->>'version')::numeric) = (previous_episode->>'version')::numeric
          and (episode->>'version')::numeric < (previous_episode->>'version')::numeric then
          incompatible := true;
        end if;
      end if;
    end if;
    if pg_catalog.jsonb_typeof(episode->'rechecks') is distinct from 'array' then
      incompatible := true;
    end if;
    foreach field_name in array array['thresholdSnapshot', 'closure', 'pendingRecheck'] loop
      if coalesce(pg_catalog.jsonb_typeof(episode->field_name), '') not in ('object', 'null') then
        incompatible := true;
      end if;
    end loop;
  end if;

  if incompatible then
    raise exception using
      errcode = '23514',
      message = 'LLT_LOW_GLUCOSE_WRITE_INCOMPATIBLE',
      detail = 'Protected Low Glucose record invariants were not preserved.',
      hint = 'Use an updated compatible LLT client and retain the attempted edit.',
      constraint = 'lee_lee_records_low_glucose_write_guard',
      schema = 'public', table = 'lee_lee_records';
  end if;
  return NEW;
end;
$$;

revoke all on function public.guard_lee_lee_low_glucose_write()
  from public, anon, authenticated;
drop trigger if exists lee_lee_records_low_glucose_write_guard on public.lee_lee_records;
create trigger lee_lee_records_low_glucose_write_guard
before insert or update on public.lee_lee_records
for each row execute function public.guard_lee_lee_low_glucose_write();

commit;
