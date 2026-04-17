# Supabase (Trip5)

SQL migrations are split into two folders; apply **both** in order when provisioning a database:

1. **`trip5-expo/supabase/migrations/`** — `001` … `005` (base profiles, orders, saved places, realtime, drivers, offers, subscription).
2. **`supabase/migrations/`** (this directory) — `006` … `009` (trip reference, driver vehicle + rider-read policy, `trip_messages`, `cancel_my_trip` RPC).

See **`APP_DB_CONTRACT.md`** in this folder for the full app ↔ DB inventory and reconciliation checklist.

## Edge Functions (option B — replaces Node `/api/*` for the app)

Functions:

| Name            | Role                                      |
|-----------------|-------------------------------------------|
| `orders`        | `POST` — create order + first driver offer |
| `driver-orders` | `GET` / `POST` — driver polling + actions |

### Prerequisites

1. [Supabase CLI](https://supabase.com/docs/guides/cli) installed.
2. Project linked: `supabase link --project-ref <your-project-ref>`
3. Database migrations applied (including `003`, `004` for drivers / offers).

### Secrets

Edge Functions receive **`SUPABASE_URL`** and **`SUPABASE_SERVICE_ROLE_KEY`** automatically when deployed to Supabase. For local serve, use `supabase secrets` or a local `.env` per Supabase docs.

### Deploy

```bash
cd /path/to/trip5
supabase functions deploy orders
supabase functions deploy driver-orders
```

### Expo app

Set **`EXPO_PUBLIC_SUPABASE_URL`** and **`EXPO_PUBLIC_SUPABASE_ANON_KEY`** in `trip5-expo/.env` (same as the Supabase client). The app will call:

- `https://<project>.supabase.co/functions/v1/orders`
- `https://<project>.supabase.co/functions/v1/driver-orders`

with headers `Authorization: Bearer <user access token>` and **`apikey: <anon key>`**.

If `EXPO_PUBLIC_SUPABASE_URL` is missing, the app falls back to **`EXPO_PUBLIC_API_BASE_URL`** (legacy Node/Vercel/Render API).
