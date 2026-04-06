-- Driver dashboard: rating-style score, weekly Trip5 subscription gate for receiving offers.

alter table public.profiles
  add column if not exists driver_score numeric(3, 2) not null default 5.00
    check (driver_score >= 0 and driver_score <= 5);

alter table public.profiles
  add column if not exists driver_subscription_valid_until timestamptz null;

comment on column public.profiles.driver_score is 'Display rating 0–5; updated by ops or future reviews.';
comment on column public.profiles.driver_subscription_valid_until is 'Weekly Trip5 subscription; must be > now() to receive ride offers.';

-- Drivers can read orders assigned to them (past rides, active jobs).
drop policy if exists "orders_select_as_driver" on public.orders;
create policy "orders_select_as_driver"
  on public.orders for select
  to authenticated
  using (auth.uid() = driver_id);
