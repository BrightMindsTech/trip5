-- Driver app: flag on profile (set manually in SQL or admin); orders can be assigned to a driver.

alter table public.profiles
  add column if not exists is_driver boolean not null default false;

alter table public.orders
  add column if not exists driver_id uuid references auth.users (id) on delete set null;

create index if not exists orders_driver_id_idx on public.orders (driver_id);

comment on column public.profiles.is_driver is 'When true, the app shows the Driver tab. Set in SQL for trusted accounts.';
comment on column public.orders.driver_id is 'Assigned driver user id; null until a driver accepts the job.';
