-- Run in Supabase SQL Editor after 001_profiles_and_orders.sql.
-- Per-user saved addresses for quick pickup in the booking flow.

create table if not exists public.saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  address text not null,
  latitude double precision not null,
  longitude double precision not null,
  kind text not null default 'other'
    check (kind in ('home', 'work', 'gym', 'other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_places_user_created_idx
  on public.saved_places (user_id, created_at desc);

alter table public.saved_places enable row level security;

create policy "saved_places_select_own"
  on public.saved_places for select
  to authenticated
  using (auth.uid() = user_id);

create policy "saved_places_insert_own"
  on public.saved_places for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "saved_places_update_own"
  on public.saved_places for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "saved_places_delete_own"
  on public.saved_places for delete
  to authenticated
  using (auth.uid() = user_id);
