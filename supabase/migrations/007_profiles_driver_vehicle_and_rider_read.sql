-- Vehicle fields for driver profile + rating count (rider UI).
-- RLS: allow passengers to read the assigned driver's profile row (not only own row).

alter table public.profiles
  add column if not exists driver_car_type text;

alter table public.profiles
  add column if not exists driver_car_color text;

alter table public.profiles
  add column if not exists driver_rating_count integer not null default 0;

comment on column public.profiles.driver_car_type is 'Vehicle model/type label for rider display.';
comment on column public.profiles.driver_car_color is 'Vehicle color label for rider display.';
comment on column public.profiles.driver_rating_count is 'Number of ratings backing driver_score; optional display.';

drop policy if exists "profiles_select_driver_assigned_to_my_order" on public.profiles;

create policy "profiles_select_driver_assigned_to_my_order"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.driver_id = profiles.id
        and o.user_id = auth.uid()
    )
  );
