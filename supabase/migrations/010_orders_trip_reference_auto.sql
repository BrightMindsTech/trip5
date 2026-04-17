-- Unique human-readable reference per order for support (e.g. T5-00000001).

create sequence if not exists public.orders_trip_reference_seq;

create or replace function public.orders_set_trip_reference()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.trip_reference is null or trim(new.trip_reference) = '' then
    new.trip_reference := 'T5-' || lpad(nextval('public.orders_trip_reference_seq')::text, 8, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists orders_set_trip_reference_trigger on public.orders;
create trigger orders_set_trip_reference_trigger
  before insert on public.orders
  for each row
  execute procedure public.orders_set_trip_reference();

-- One reference per row (nullable only transiently before backfill)
create unique index if not exists orders_trip_reference_unique
  on public.orders (trip_reference)
  where trip_reference is not null and trim(trip_reference) <> '';

-- Existing rows: assign sequential refs
do $$
declare
  r record;
begin
  for r in
    select id
    from public.orders
    where trip_reference is null or trim(trip_reference) = ''
    order by created_at asc nulls last, id asc
  loop
    update public.orders
    set trip_reference = 'T5-' || lpad(nextval('public.orders_trip_reference_seq')::text, 8, '0')
    where id = r.id;
  end loop;
end $$;

comment on function public.orders_set_trip_reference() is 'Sets orders.trip_reference to T5-######## if missing on insert.';
