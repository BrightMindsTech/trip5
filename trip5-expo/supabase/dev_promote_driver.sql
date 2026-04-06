-- Dev/test: turn an existing user into a driver (run in Supabase SQL Editor).
-- 1) Sign up in the app with a test Jordan phone + password (or create a user in Dashboard → Authentication).
-- 2) Find the user id (pick one):

-- By email (synthetic email from phone digits + EXPO_PUBLIC_AUTH_EMAIL_DOMAIN, default phone.trip5.app):
-- select id, email from auth.users where email like '%@phone.trip5.app' order by created_at desc limit 10;

-- 3) Promote (uncomment, paste UUID from step 2):
-- update public.profiles set is_driver = true where id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid;

-- 4) Optional — test subscription (weekly): extend access by 7 days from now (migration 005).
-- update public.profiles
-- set driver_subscription_valid_until = (now() at time zone 'utc') + interval '7 days'
-- where id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid;
