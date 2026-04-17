-- Rider ↔ driver chat per order (client inserts; RLS restricts to participants).

create table if not exists public.trip_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'text'
    check (kind in ('text', 'image')),
  message_text text,
  image_url text,
  created_at timestamptz not null default now()
);

create index if not exists trip_messages_order_created_idx
  on public.trip_messages (order_id, created_at desc);

alter table public.trip_messages enable row level security;

drop policy if exists "trip_messages_select_participants" on public.trip_messages;
drop policy if exists "trip_messages_insert_participants" on public.trip_messages;

create policy "trip_messages_select_participants"
  on public.trip_messages for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.id = trip_messages.order_id
        and (o.user_id = auth.uid() or o.driver_id = auth.uid())
    )
  );

create policy "trip_messages_insert_participants"
  on public.trip_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.orders o
      where o.id = trip_messages.order_id
        and (o.user_id = auth.uid() or o.driver_id = auth.uid())
    )
  );

-- Realtime: new messages for open chat UIs
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'trip_messages'
  ) then
    alter publication supabase_realtime add table public.trip_messages;
  end if;
end $$;
