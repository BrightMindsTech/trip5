-- One-off: remove shared-trip tables and optional FK column from orders.
-- Run in Supabase → SQL Editor after backing up if needed.
--
-- 1) Drop FK column(s) on orders linking to shared-trip groups (your project may use either name).
ALTER TABLE public.orders
  DROP COLUMN IF EXISTS shared_trip_group_id,
  DROP COLUMN IF EXISTS shared_group_id;

-- 2) Drop every public table whose name starts with shared_trip (CASCADE removes dependent FKs/views).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename LIKE 'shared_trip%'
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
    RAISE NOTICE 'Dropped table %', r.tablename;
  END LOOP;
END $$;

-- 3) Optional: remove RPCs/triggers you added only for shared trips (uncomment and adjust names after checking).
-- DROP FUNCTION IF EXISTS public.some_shared_trip_function() CASCADE;
