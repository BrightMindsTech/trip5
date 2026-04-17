-- Passenger cancels their own active trip (matches ActivityCurrentTripCard + rider rules).

create or replace function public.cancel_my_trip(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders
  set status = 'cancelled'
  where id = p_order_id
    and user_id = auth.uid()
    and lower(status) in ('pending', 'confirmed', 'driver_en_route', 'in_route');
end;
$$;

grant execute on function public.cancel_my_trip(uuid) to authenticated;

comment on function public.cancel_my_trip(uuid) is 'Rider-only: sets order to cancelled when still active.';
