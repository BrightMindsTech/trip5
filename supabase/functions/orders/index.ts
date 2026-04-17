/**
 * POST /orders — create passenger order + first driver offer (Edge Function).
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { assignNextDriver } from "../_shared/driverDispatch.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function validateBody(body: Record<string, unknown> | null) {
  if (!body) return "Invalid request body";
  const { route, date, service, pickup, destination, skip_destination } = body;
  if (!route || !service || !pickup) return "Missing required fields";
  const p = pickup as Record<string, unknown>;
  if (p.latitude == null || p.longitude == null) return "Pickup must include coordinates";
  const destPending = skip_destination === true || (destination as Record<string, unknown> | undefined)?.pending === true;
  if (!destPending) {
    const d = destination as Record<string, unknown> | undefined;
    if (!d || d.latitude == null || d.longitude == null) {
      return "Destination must include coordinates, or use skip destination";
    }
  }
  if (!date) return "Missing date";
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    return await handlePostOrders(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("orders function uncaught:", e);
    return new Response(JSON.stringify({ error: "Internal error", detail: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handlePostOrders(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing or invalid Authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser(token);
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const errMsg = validateBody(body);
  if (errMsg) {
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { route, date, service, pickup, destination, skip_destination } = body;
  const destPending = skip_destination === true || (destination as Record<string, unknown> | undefined)?.pending === true;

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr) {
    console.error("Profile fetch:", profileErr);
    return new Response(JSON.stringify({ error: "Could not load profile" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const passengerName = (String(profile?.full_name || "").trim() || "Passenger");
  const passengerPhone = String(profile?.phone || "").trim();
  if (!passengerPhone) {
    return new Response(
      JSON.stringify({ error: "Add your phone number in your profile before booking." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const scheduledAt = new Date(date as string);
  if (Number.isNaN(scheduledAt.getTime())) {
    return new Response(JSON.stringify({ error: "Invalid date" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const pu = pickup as Record<string, unknown>;
  const dest = destination as Record<string, unknown> | undefined;

  const row = {
    user_id: user.id,
    route,
    scheduled_at: scheduledAt.toISOString(),
    service,
    pickup: {
      latitude: pu.latitude,
      longitude: pu.longitude,
      address: String(pu.address || ""),
    },
    destination: destPending
      ? { pending: true, latitude: null, longitude: null, address: "Pending" }
      : {
          latitude: dest!.latitude,
          longitude: dest!.longitude,
          address: String(dest!.address || ""),
        },
    passenger_name: passengerName,
    passenger_phone: passengerPhone,
    status: "pending",
  };

  const { data: inserted, error: insertErr } = await supabase.from("orders").insert(row).select("id, trip_reference").single();

  if (insertErr) {
    console.error("Insert order:", insertErr);
    return new Response(
      JSON.stringify({ error: "Failed to save order", detail: insertErr.message || String(insertErr) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const orderId = inserted?.id as string | undefined;
  if (!orderId) {
    return new Response(JSON.stringify({ error: "Failed to save order", detail: "No id returned from insert" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let dispatch = { offerCreated: false as boolean, reason: "unknown" as string, eligibleDriverCount: 0 };
  try {
    dispatch = await assignNextDriver(supabase, orderId);
  } catch (e) {
    console.error("assignNextDriver after order:", e);
    dispatch = { offerCreated: false, reason: "assign_exception", eligibleDriverCount: 0 };
  }

  const tripRef = (inserted as { trip_reference?: string } | null)?.trip_reference ?? null;

  return new Response(
    JSON.stringify({
      success: true,
      id: orderId,
      trip_reference: tripRef,
      dispatch: {
        offerCreated: dispatch.offerCreated,
        reason: dispatch.reason,
        eligibleDriverCount: dispatch.eligibleDriverCount ?? 0,
        ...(dispatch.insertError ? { insertError: dispatch.insertError } : {}),
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
