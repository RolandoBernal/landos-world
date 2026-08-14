-- Allow every supported family device label to edit Lee-Lee's Tracker shared settings.
-- This is additive/backward-compatible and does not alter existing shared settings rows.

alter table public.lee_lee_shared_settings
  drop constraint if exists lee_lee_shared_settings_last_edited_by_check;

alter table public.lee_lee_shared_settings
  add constraint lee_lee_shared_settings_last_edited_by_check
  check (last_edited_by in ('Rolando', 'Emily', 'Levi', 'Violet', 'Unknown'));
