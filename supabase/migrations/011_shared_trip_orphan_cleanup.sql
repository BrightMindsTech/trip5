-- Inserts into public.orders failed with: relation "public.shared_trip_groups" does not exist
-- after shared_trip_* tables were dropped (see manual/drop_shared_trip_objects.sql) but a
-- trigger or function still referenced them. This migration removes those orphans.

-- 1) Drop triggers on orders whose name suggests shared-trip (safe: keeps trip_reference trigger).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'orders'
      AND NOT t.tgisinternal
      AND t.tgname NOT IN ('orders_set_trip_reference_trigger')
      AND (
        t.tgname ILIKE '%shared%'
        OR t.tgname ILIKE '%trip_group%'
      )
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.orders CASCADE', r.tgname);
    RAISE NOTICE 'Dropped trigger % on public.orders', r.tgname;
  END LOOP;
END $$;

-- 2) Drop public functions whose definition still mentions shared_trip_groups (CASCADE removes triggers).
DO $$
DECLARE
  r RECORD;
  def text;
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prokind IN ('f', 'p')
  LOOP
    BEGIN
      def := pg_get_functiondef(r.oid);
      IF def IS NOT NULL AND def ILIKE '%shared_trip_groups%' THEN
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.oid::regprocedure::text || ' CASCADE';
        RAISE NOTICE 'Dropped function %', r.oid::regprocedure::text;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END LOOP;
END $$;
