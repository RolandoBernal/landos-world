-- LLT sensor code: database contract only; isolated validation required.
-- NO PRODUCTION EXECUTION AUTHORIZED. No client UI, data backfill or ACL hardening.
-- Apply only this exact reviewed file after metadata/dependency preflight.
begin;

-- Signature replacement must preserve the established owner/security boundary.
do $$
begin
  if current_user <> 'postgres' or not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = 'public.llt_mutate_sensor_cycle(uuid,text,bigint,uuid,uuid,timestamptz,boolean,text,jsonb)'::regprocedure
      and pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
      and p.prosecdef and p.proconfig = array['search_path=""']::text[]
  ) then
    raise exception 'Sensor RPC owner/security differs from reviewed contract.';
  end if;
end;
$$;

alter table public.llt_sensor_cycles add column sensor_code text;
alter table public.llt_sensor_cycles add constraint llt_sensor_code_four_ascii_digits check (
  sensor_code is null or (
    pg_catalog.char_length(sensor_code) = 4
    and (sensor_code collate "C") ~ '^[0-9]{4}$'
  )
);
comment on column public.llt_sensor_cycles.sensor_code is
  'Optional four ASCII digit physical sensor pairing code; NULL for unrecorded legacy cycles. Preserve leading zeros.';

-- Null omission keeps same-revision legacy snapshots byte-equivalent.
create or replace function public.llt_sensor_snapshot_for_user(p_uid uuid)
returns jsonb language sql stable set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'revision', coalesce(h.revision, 0),
    'currentCycleId', h.current_cycle_id,
    'cycles', coalesce((
      select pg_catalog.jsonb_agg(case when c.sensor_code is null then pg_catalog.to_jsonb(c) - 'sensor_code'
        else pg_catalog.to_jsonb(c) end order by c.started_at desc, c.id desc)
      from public.llt_sensor_cycles c where c.user_id = p_uid
    ), '[]'::jsonb)
  )
  from (select p_uid as user_id) u
  left join public.llt_sensor_contexts h on h.user_id = u.user_id;
$$;

-- RESTRICT stops unexpected dependencies; never retain an ambiguous overload.
drop function public.llt_mutate_sensor_cycle(uuid,text,bigint,uuid,uuid,timestamptz,boolean,text,jsonb) restrict;

create function public.llt_mutate_sensor_cycle(
  p_operation_id uuid,
  p_action text,
  p_expected_revision bigint,
  p_expected_current_cycle_id uuid,
  p_new_cycle_id uuid,
  p_started_at timestamptz,
  p_confirm_replace boolean,
  p_actor_label text,
  p_device_metadata jsonb,
  p_sensor_code text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_head public.llt_sensor_contexts%rowtype;
  v_current public.llt_sensor_cycles%rowtype;
  v_previous public.llt_sensor_cycles%rowtype;
  v_receipt public.llt_sensor_operations%rowtype;
  v_request jsonb;
  v_before jsonb := '[]'::jsonb;
  v_after jsonb := '[]'::jsonb;
  v_status text := 'accepted';
  v_reason text := 'applied';
  v_now timestamptz;
  v_next_revision bigint;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;
  -- Typed/shape errors do not produce an operation receipt. No data is modified.
  if p_operation_id is null or p_action is null
     or p_action not in ('start','edit_start','undo_current')
     or p_expected_revision is null or p_expected_revision < 0
     or p_actor_label is null or p_actor_label not in ('Rolando','Emily','Levi','Violet','Unknown')
     or p_confirm_replace is null
     or p_device_metadata is null or pg_catalog.jsonb_typeof(p_device_metadata) <> 'object'
     or pg_catalog.octet_length(p_device_metadata::text) > 2048 then
    return pg_catalog.jsonb_build_object('status','invalid_request','reason','invalid_parameters');
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_each(p_device_metadata) m
    where m.key not in ('device_installation_id','device_profile','device_platform','app_environment','app_version')
      or pg_catalog.jsonb_typeof(m.value) <> 'string'
      or pg_catalog.length(m.value #>> '{}') > 160
  ) then
    return pg_catalog.jsonb_build_object('status','invalid_request','reason','invalid_metadata');
  end if;
  if (p_action = 'start' and (p_new_cycle_id is null or p_started_at is null))
    or (p_action = 'edit_start' and (p_expected_current_cycle_id is null or p_started_at is null
      or p_new_cycle_id is not null or p_confirm_replace))
    or (p_action = 'undo_current' and (p_expected_current_cycle_id is null or p_started_at is not null
      or p_new_cycle_id is not null or p_confirm_replace)) then
    return pg_catalog.jsonb_build_object('status','invalid_request','reason','invalid_action_shape');
  end if;

  if p_sensor_code is not null and (
    pg_catalog.char_length(p_sensor_code) <> 4
    or not ((p_sensor_code collate "C") ~ '^[0-9]{4}$')
  ) then
    return pg_catalog.jsonb_build_object('status','invalid_request','reason','invalid_sensor_code');
  end if;
  if p_action <> 'start' and p_sensor_code is not null then
    return pg_catalog.jsonb_build_object('status','invalid_request','reason','invalid_action_shape');
  end if;

  -- Epoch makes equal absolute timestamps canonical regardless of session timezone.
  v_request := pg_catalog.jsonb_build_object(
    'action',p_action,'expectedRevision',p_expected_revision,
    'expectedCurrentCycleId',p_expected_current_cycle_id,'newCycleId',p_new_cycle_id,
    'startedAtEpoch',extract(epoch from p_started_at),
    'confirmReplace',p_confirm_replace,'actorLabel',p_actor_label,'deviceMetadata',p_device_metadata
  );
  -- Preserve exact legacy canonical requests and existing receipt retries.
  if p_sensor_code is not null then
    v_request := v_request || pg_catalog.jsonb_build_object('sensorCode',p_sensor_code);
  end if;
  -- Creates only an empty lock/head row on the first well-shaped request.
  -- Concurrent first requests serialize on PK insertion, then row locking.
  insert into public.llt_sensor_contexts(user_id) values(v_uid) on conflict (user_id) do nothing;
  select * into strict v_head from public.llt_sensor_contexts where user_id = v_uid for update;
  v_now := pg_catalog.clock_timestamp();

  -- Receipt lookup must precede expected-version checks: lost-response retries succeed.
  select * into v_receipt from public.llt_sensor_operations
    where user_id = v_uid and operation_id = p_operation_id;
  if found then
    if v_receipt.request <> v_request then
      return pg_catalog.jsonb_build_object('status','invalid_request','reason','operation_id_reused',
        'operationId',p_operation_id,'snapshot',public.llt_sensor_snapshot_for_user(v_uid));
    end if;
    return pg_catalog.jsonb_build_object(
      'status',v_receipt.status,'reason',v_receipt.reason,'operationId',p_operation_id,'replayed',true,
      'operationRevision',v_receipt.revision_after,'acceptedAt',v_receipt.accepted_at,
      'snapshot',public.llt_sensor_snapshot_for_user(v_uid),'serverTime',v_now
    );
  end if;

  if v_head.current_cycle_id is not null then
    select * into strict v_current from public.llt_sensor_cycles
      where user_id = v_uid and id = v_head.current_cycle_id;
    if v_current.state <> 'current' then
      raise exception 'Sensor context invariant violated.' using errcode = '23514';
    end if;
    v_before := pg_catalog.jsonb_build_array(pg_catalog.to_jsonb(v_current));
    if v_current.previous_cycle_id is not null then
      select * into strict v_previous from public.llt_sensor_cycles
        where user_id = v_uid and id = v_current.previous_cycle_id;
    end if;
  end if;

  if v_head.revision <> p_expected_revision
     or v_head.current_cycle_id is distinct from p_expected_current_cycle_id then
    v_status := 'conflict'; v_reason := 'stale_context';
  elsif p_started_at is not null and (not pg_catalog.isfinite(p_started_at) or p_started_at > v_now) then
    v_status := 'invalid_state'; v_reason := 'invalid_start_time';
  elsif p_action = 'start' then
    if exists (select 1 from public.llt_sensor_cycles where user_id = v_uid and id = p_new_cycle_id) then
      v_status := 'invalid_state'; v_reason := 'cycle_id_exists';
    elsif v_head.current_cycle_id is not null and not p_confirm_replace then
      v_status := 'invalid_state'; v_reason := 'replacement_confirmation_required';
    elsif v_head.current_cycle_id is not null and p_started_at <= v_current.started_at then
      v_status := 'invalid_state'; v_reason := 'replacement_not_after_current_start';
    end if;
  elsif v_head.current_cycle_id is null then
    v_status := 'invalid_state'; v_reason := 'no_current_cycle';
  elsif p_action = 'edit_start' then
    if p_started_at = v_current.started_at then
      v_status := 'invalid_state'; v_reason := 'unchanged_start';
    elsif v_current.previous_cycle_id is not null and
      (v_previous.state <> 'closed' or v_previous.ended_at is distinct from v_current.started_at
       or p_started_at <= v_previous.started_at) then
      v_status := 'invalid_state'; v_reason := 'invalid_previous_boundary';
    end if;
  elsif p_action = 'undo_current' and v_current.previous_cycle_id is not null and
      (v_previous.state <> 'closed' or v_previous.ended_at is distinct from v_current.started_at) then
    v_status := 'invalid_state'; v_reason := 'previous_cycle_not_restorable';
  end if;

  v_next_revision := v_head.revision;
  if v_status = 'accepted' then
    v_next_revision := v_head.revision + 1;
    if p_action = 'start' then
      if v_head.current_cycle_id is not null then
        update public.llt_sensor_cycles set state = 'closed', ended_at = p_started_at,
          revision = v_next_revision, updated_at = v_now, updated_actor = p_actor_label
          where user_id = v_uid and id = v_head.current_cycle_id;
      end if;
      insert into public.llt_sensor_cycles(user_id,id,started_at,state,previous_cycle_id,
        created_at,updated_at,created_actor,updated_actor,revision,sensor_code)
      values(v_uid,p_new_cycle_id,p_started_at,'current',v_head.current_cycle_id,
        v_now,v_now,p_actor_label,p_actor_label,v_next_revision,p_sensor_code);
      update public.llt_sensor_contexts set current_cycle_id = p_new_cycle_id,
        revision = v_next_revision, updated_at = v_now where user_id = v_uid;
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c) order by c.id),'[]'::jsonb)
        into v_after from public.llt_sensor_cycles c
        where c.user_id = v_uid and (c.id = p_new_cycle_id or c.id = v_head.current_cycle_id);
    else
      if v_current.previous_cycle_id is not null then
        v_before := v_before || pg_catalog.jsonb_build_array(pg_catalog.to_jsonb(v_previous));
      end if;
      if p_action = 'edit_start' then
        -- Replacement time is the new cycle's start. Correct both sides together.
        update public.llt_sensor_cycles set started_at = p_started_at, revision = v_next_revision,
          updated_at = v_now, updated_actor = p_actor_label where user_id = v_uid and id = v_current.id;
        if v_current.previous_cycle_id is not null then
          update public.llt_sensor_cycles set ended_at = p_started_at, revision = v_next_revision,
            updated_at = v_now, updated_actor = p_actor_label
            where user_id = v_uid and id = v_current.previous_cycle_id;
        end if;
      else
        -- Undo is ONLY the currently tracked cycle, never an arbitrary history delete.
        -- Retain cancelled row; release unique slot BEFORE restoring the predecessor.
        update public.llt_sensor_cycles set state = 'cancelled', cancelled_at = v_now,
          revision = v_next_revision, updated_at = v_now, updated_actor = p_actor_label
          where user_id = v_uid and id = v_current.id;
        if v_current.previous_cycle_id is not null then
          update public.llt_sensor_cycles set state = 'current', ended_at = null,
            revision = v_next_revision, updated_at = v_now, updated_actor = p_actor_label
            where user_id = v_uid and id = v_current.previous_cycle_id;
        end if;
      end if;
      update public.llt_sensor_contexts set
        current_cycle_id = case when p_action = 'undo_current' then v_current.previous_cycle_id else v_current.id end,
        revision = v_next_revision, updated_at = v_now where user_id = v_uid;
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c) order by c.id),'[]'::jsonb)
        into v_after from public.llt_sensor_cycles c
        where c.user_id = v_uid and (c.id = v_current.id or c.id = v_current.previous_cycle_id);
    end if;
  else
    v_after := v_before;
  end if;

  insert into public.llt_sensor_operations(user_id,operation_id,action,request,status,reason,
    expected_revision,revision_before,revision_after,before_cycles,after_cycles,
    actor_label,device_metadata,received_at,accepted_at)
  values(v_uid,p_operation_id,p_action,v_request,v_status,v_reason,p_expected_revision,
    v_head.revision,v_next_revision,v_before,v_after,p_actor_label,p_device_metadata,
    v_now,case when v_status = 'accepted' then v_now else null end);
  v_result := pg_catalog.jsonb_build_object(
    'status',v_status,'reason',v_reason,'operationId',p_operation_id,'replayed',false,
    'operationRevision',v_next_revision,'acceptedAt',case when v_status = 'accepted' then v_now else null end,
    'snapshot',public.llt_sensor_snapshot_for_user(v_uid),'serverTime',v_now
  );
  return v_result;
  -- Unexpected errors roll back ALL writes including receipt; retry same ID.
  -- Do not catch infrastructure failures and misreport them as accepted.
end;
$$;


alter function public.llt_mutate_sensor_cycle(uuid,text,bigint,uuid,uuid,timestamptz,boolean,text,jsonb,text)
  owner to postgres;
revoke all on function public.llt_mutate_sensor_cycle(uuid,text,bigint,uuid,uuid,timestamptz,boolean,text,jsonb,text)
  from public, anon, authenticated, service_role;
grant execute on function public.llt_mutate_sensor_cycle(uuid,text,bigint,uuid,uuid,timestamptz,boolean,text,jsonb,text)
  to authenticated;

-- Delivered only if the transaction commits; no API routing change.
notify pgrst, 'reload schema';
commit;
