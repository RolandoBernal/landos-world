-- Lee-Lee's Tracker shared Food Library and Saved Meals.
-- Apply this after the existing LLT record/shared-settings migrations.

create table if not exists public.lee_lee_foods (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  carb_grams numeric(8,2) not null check (carb_grams >= 0),
  is_favorite boolean not null default false,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  entered_by text not null default 'Unknown' check (entered_by in ('Rolando', 'Emily', 'Levi', 'Violet', 'Unknown')),
  last_edited_by text check (last_edited_by in ('Rolando', 'Emily', 'Levi', 'Violet', 'Unknown')),
  deleted_at timestamptz,
  deleted_by text check (deleted_by in ('Rolando', 'Emily', 'Levi', 'Violet', 'Unknown')),
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.lee_lee_saved_meals (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  total_carbs numeric(8,2) not null default 0 check (total_carbs >= 0),
  is_favorite boolean not null default false,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  entered_by text not null default 'Unknown' check (entered_by in ('Rolando', 'Emily', 'Levi', 'Violet', 'Unknown')),
  last_edited_by text check (last_edited_by in ('Rolando', 'Emily', 'Levi', 'Violet', 'Unknown')),
  deleted_at timestamptz,
  deleted_by text check (deleted_by in ('Rolando', 'Emily', 'Levi', 'Violet', 'Unknown')),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists lee_lee_foods_user_updated_idx
  on public.lee_lee_foods (user_id, updated_at desc);

create index if not exists lee_lee_foods_user_deleted_idx
  on public.lee_lee_foods (user_id, deleted_at)
  where deleted_at is not null;

create index if not exists lee_lee_saved_meals_user_updated_idx
  on public.lee_lee_saved_meals (user_id, updated_at desc);

create index if not exists lee_lee_saved_meals_user_deleted_idx
  on public.lee_lee_saved_meals (user_id, deleted_at)
  where deleted_at is not null;

create or replace function public.set_lee_lee_library_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  new.version = old.version + 1;
  return new;
end;
$$;

drop trigger if exists set_lee_lee_food_updated_at on public.lee_lee_foods;
create trigger set_lee_lee_food_updated_at
before update on public.lee_lee_foods
for each row
execute function public.set_lee_lee_library_updated_at();

drop trigger if exists set_lee_lee_saved_meal_updated_at on public.lee_lee_saved_meals;
create trigger set_lee_lee_saved_meal_updated_at
before update on public.lee_lee_saved_meals
for each row
execute function public.set_lee_lee_library_updated_at();

alter table public.lee_lee_foods enable row level security;
alter table public.lee_lee_saved_meals enable row level security;

revoke all on public.lee_lee_foods from anon, public;
revoke all on public.lee_lee_saved_meals from anon, public;
grant select, insert, update on public.lee_lee_foods to authenticated;
grant select, insert, update on public.lee_lee_saved_meals to authenticated;

drop policy if exists "Lee-Lee foods select owned rows" on public.lee_lee_foods;
create policy "Lee-Lee foods select owned rows"
on public.lee_lee_foods
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Lee-Lee foods insert owned rows" on public.lee_lee_foods;
create policy "Lee-Lee foods insert owned rows"
on public.lee_lee_foods
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Lee-Lee foods update owned rows" on public.lee_lee_foods;
create policy "Lee-Lee foods update owned rows"
on public.lee_lee_foods
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Lee-Lee saved meals select owned rows" on public.lee_lee_saved_meals;
create policy "Lee-Lee saved meals select owned rows"
on public.lee_lee_saved_meals
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Lee-Lee saved meals insert owned rows" on public.lee_lee_saved_meals;
create policy "Lee-Lee saved meals insert owned rows"
on public.lee_lee_saved_meals
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Lee-Lee saved meals update owned rows" on public.lee_lee_saved_meals;
create policy "Lee-Lee saved meals update owned rows"
on public.lee_lee_saved_meals
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
