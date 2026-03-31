# Trip5 Backend

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

Rows are stored in `public.orders` with `status` default `pending`. Driver-facing APIs can be added later.
