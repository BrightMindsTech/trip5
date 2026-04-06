# Trip5 Backend (optional legacy)

The app **prefers [Supabase Edge Functions](../supabase/README.md)** when `EXPO_PUBLIC_SUPABASE_URL` + anon key are set in the Expo app. This folder is a **Node/Express** mirror you can still run on **Render** or **Vercel** for the same routes (`/api/orders`, `/api/driver-orders`).

API that receives **authenticated** orders from the Trip5 app and **stores them in Supabase Postgres** (WhatsApp removed). Runs as a **Render Web Service** (`server.js`).

## Setup

1. **Supabase**
   - Create a project at [supabase.com](https://supabase.com).
   - Run the SQL in `../supabase/migrations/001_profiles_and_orders.sql` in the SQL Editor (creates `profiles`, `orders`, RLS, and signup trigger).
   - In **Project Settings → API**, copy **Project URL** and **service_role** key (server only).

2. **Environment variables** (Render or local `.env`):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (never expose to the client app)

3. **Install and run locally**
   ```bash
   cd backend
   npm install
   npm start
   ```
   API: `POST http://localhost:3000/api/orders` with header `Authorization: Bearer <Supabase access token>` and JSON body (route, date, service, pickup, destination).

4. **Deploy on Render**
   - New *Web Service* from your repo.
   - **Root Directory**: `backend`
   - **Build**: `npm install`
   - **Start**: `npm start`
   - Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the Render dashboard.
   - Set `EXPO_PUBLIC_API_BASE_URL` in the Expo app to your Render URL (no trailing slash).

## Orders

Rows are stored in `public.orders` with `status` default `pending`.

## Drivers

Run migration `003_driver_section.sql` (adds `profiles.is_driver`, `orders.driver_id`). Enable a user as a driver in SQL:

`update public.profiles set is_driver = true where id = '<user uuid>';`

- `GET /api/driver-orders` — Bearer token; lists **available** (`pending`, no driver) and **mine** (assigned to this driver, non-terminal).
- `POST /api/driver-orders` — JSON `{ "orderId", "action": "set_status", "status": "driver_en_route" }` (trip progression), or `{ "action": "respond_offer", "offerId", "accept": true|false }` for timed incoming offers.
- Run migration `004_order_driver_offers.sql`. New passenger orders enqueue a **10s offer** to the first available driver (by `profiles.id`); if it expires or is declined, the next driver is offered. The driver app polls `GET /api/driver-orders` and shows the offer in-app.
