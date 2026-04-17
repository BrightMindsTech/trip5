-- Human-readable trip id for support / rider UI (optional).
-- Safe to run if column already exists on a DB that was migrated manually.

alter table public.orders
  add column if not exists trip_reference text;

comment on column public.orders.trip_reference is 'Display reference for riders/drivers (e.g. from sequence or ops); optional.';
