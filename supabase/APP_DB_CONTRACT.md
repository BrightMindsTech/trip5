# Trip5: app ↔ database contract

This document ties **trip5-expo** Supabase usage to **schema + RLS + RPCs**. Use it when the remote database was changed manually and the repo feels “behind” or “messy.”

## Apply order (new environments)

1. Run migrations in **`trip5-expo/supabase/migrations/`** in numeric order (`001` … `005`).  
   See `supabase/README.md` for Edge Functions context.
2. Run migrations in **`supabase/migrations/`** in numeric order (`006` … `009`) to match current app features (trip reference, driver vehicle fields + rider read policy, chat, cancel RPC).

If your **production** database already has some of this, compare objects below before running `006–009` (duplicate `CREATE` may no-op; `CREATE OR REPLACE` for the RPC is safe).

## Direct Supabase client (`trip5-expo/src/lib/supabase.js`)

| Object | Used in | Notes |
|--------|---------|--------|
| `auth.*` | `AuthContext`, `useTripChatUnread` | Session and user id. |
| `profiles` | `AuthContext`, `RiderDriverVehicleSection` | Upsert own profile; **read other user** only via policy `profiles_select_driver_assigned_to_my_order` (`007`). Expect `is_driver`, `driver_score`, `driver_subscription_valid_until`, `driver_car_*`, `driver_rating_count` when columns exist. |
| `orders` | `useUserOrders`, `TripTrackingScreen`, `DriverDashboardScreen` | Select + Realtime on `orders` for `user_id` (`useUserOrders`). Drivers select past rides by `driver_id`. |
| `saved_places` | `useSavedPlaces` | CRUD own rows. |
| `trip_messages` | `TripChatPanel`, `useTripChatUnread` | Select/insert; Realtime for new rows (`008`). Columns: `order_id`, `sender_id`, `kind`, `message_text`, `image_url`, `created_at`. |
| RPC `cancel_my_trip(p_order_id)` | `ActivityCurrentTripCard` | `009`. |

## HTTP API (Edge Functions or Node)

| Path | Module | Role |
|------|--------|------|
| `POST …/orders` | `api.js` → `submitOrder` | Create order + dispatch (service role server-side). Response includes `dispatch: { offerCreated, reason, eligibleDriverCount }` so you can see whether a row was inserted into `order_driver_offers` (driver must have `is_driver` and active `driver_subscription_valid_until`). |

**Redeploy** the `orders` Edge Function after changing `supabase/functions/orders` or `_shared/driverDispatch.ts` (`supabase functions deploy orders`).
| `GET/POST …/driver-orders` | `api.js` → `getDriverOrders`, `postDriverOrderAction` | Driver job list and actions. |

Configure `EXPO_PUBLIC_SUPABASE_URL` + anon key so `edgeFunctionsBaseURL` points at `…/functions/v1`.

## Gaps / stubs in the app

| Area | Status |
|------|--------|
| `trip_reference` | Optional display; backfill can be done with triggers or jobs (not in repo). |

## Reconciliation checklist (remote DB “ahead” of repo)

- [ ] Tables/columns used by the app exist (`orders`, `profiles`, `saved_places`, `trip_messages`, `order_driver_offers` for backend).
- [ ] RLS allows: own `profiles` read/update; **rider read of assigned driver** (`007`); `trip_messages` for order participants (`008`).
- [ ] Realtime publication includes `orders` and `trip_messages` where chat is used.
- [ ] `cancel_my_trip` exists and is granted to `authenticated` (`009`).
- [ ] Edge Functions `orders` and `driver-orders` deployed and secrets present.

After this, **version control** wins: new changes go through `supabase/migrations/` and function code under `supabase/functions/` so the database and application stay aligned.
