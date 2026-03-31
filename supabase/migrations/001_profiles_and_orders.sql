-- Run in Supabase SQL Editor after creating a project (Project Settings → Database).
-- Enables passenger profiles linked to auth.users and orders stored for drivers (delivery TBD).

create extension if not exists "uuid-ossp";

-- Profile row per auth user (name/phone for orders; optional avatar later)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Orders: created by passenger app; drivers will read via separate policies later
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  route text not null,
  scheduled_at timestamptz not null,
  service jsonb not null,
  pickup jsonb not null,
  destination jsonb not null,
  passenger_name text,
  passenger_phone text,
  status text not null default 'pending',
  created_at timestamptz default now()
);

create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_status_created_idx on public.orders (status, created_at desc);

alter table public.orders enable row level security;

create policy "orders_insert_own"
  on public.orders for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "orders_select_own"
  on public.orders for select
  to authenticated
  using (auth.uid() = user_id);

-- New user: optional empty profile (app can also upsert on first login)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
