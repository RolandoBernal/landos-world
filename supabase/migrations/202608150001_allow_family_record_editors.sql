-- Allow Lee-Lee's Tracker record rows to use every in-app family identity.
-- Existing queues may contain records entered by Levi or Violet; without this,
-- Supabase rejects them with check constraint code 23514.

alter table public.lee_lee_records
  drop constraint if exists lee_lee_records_entered_by_check,
  drop constraint if exists lee_lee_records_last_edited_by_check,
  drop constraint if exists lee_lee_records_deleted_by_check;

alter table public.lee_lee_records
  add constraint lee_lee_records_entered_by_check
    check (entered_by in ('Rolando', 'Emily', 'Levi', 'Violet', 'Unknown')),
  add constraint lee_lee_records_last_edited_by_check
    check (last_edited_by is null or last_edited_by in ('Rolando', 'Emily', 'Levi', 'Violet', 'Unknown')),
  add constraint lee_lee_records_deleted_by_check
    check (deleted_by is null or deleted_by in ('Rolando', 'Emily', 'Levi', 'Violet', 'Unknown'));
