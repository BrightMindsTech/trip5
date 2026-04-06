-- Sequential driver offers: each driver gets a time window to accept before the offer expires and moves to the next driver.

create table if not exists public.order_driver_offers (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  driver_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  response text null
    check (response is null or response in ('accepted', 'declined', 'expired')),
  created_at timestamptz not null default now()
);

create index if not exists order_driver_offers_order_idx on public.order_driver_offers (order_id);
create index if not exists order_driver_offers_driver_pending_idx
  on public.order_driver_offers (driver_id, expires_at)
  where response is null;

alter table public.order_driver_offers enable row level security;

-- No direct client access; backend uses service role only.
drop policy if exists "order_driver_offers_deny_all" on public.order_driver_offers;
create policy "order_driver_offers_deny_all"
  on public.order_driver_offers for all
  to authenticated
  using (false)
  with check (false);
