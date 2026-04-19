/**
 * GET/POST driver-orders — Edge Function (same behavior as legacy Node API).
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { assignNextDriver, OFFER_SECONDS, processExpiredOffers } from "../_shared/driverDispatch.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TERMINAL = new Set(["completed", "cancelled"]);

const NEXT_STATUS: Record<string, string> = {
  confirmed: "driver_en_route",
  driver_en_route: "in_route",
  in_route: "completed",
};

function getBearer(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

/** PostgREST sometimes returns an HTML Cloudflare 502 page; supabase-js puts that string on `message`. */
function isTransientGatewayError(err: { message?: string } | null | undefined): boolean {
  const m = String(err?.message ?? "");
  if (m.includes("<!DOCTYPE")) return true;
  if (/502|503|504|522|523|524/.test(m)) return true;
  if (/bad gateway|cloudflare|timed?\s*out|fetch failed/i.test(m)) return true;
  return false;
}

function formatSupabaseLogError(err: unknown): string {
  if (err && typeof err === "object" && err !== null && "message" in err) {
    const m = String((err as { message: string }).message);
    if (m.includes("<!DOCTYPE") || m.length > 400) {
      return "[Upstream returned HTML or non-JSON — transient gateway/502]";
    }
    return m.slice(0, 500);
  }
  return String(err);
}

async function delay(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

serve(async (req) => {
  try {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const token = getBearer(req);
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

  let user: { id: string } | null = null;
  let userErr: { message?: string } | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const {
      data: { user: u },
      error: ue,
    } = await supabase.auth.getUser(token);
    user = u;
    userErr = ue;
    if (!userErr && u) break;
    if (userErr && isTransientGatewayError(userErr) && attempt < 3) {
      await delay(200 * attempt);
      continue;
    }
    break;
  }

  if (userErr || !user) {
    if (userErr && isTransientGatewayError(userErr)) {
      console.error("auth.getUser gateway:", formatSupabaseLogError(userErr));
      return new Response(
        JSON.stringify({
          error: "Service temporarily unavailable",
          detail: "Supabase API returned a gateway error. Retry in a few seconds.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let profile: {
    is_driver: boolean | null;
    driver_subscription_valid_until: string | null;
  } | null = null;
  let profErr: { message?: string } | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await supabase
      .from("profiles")
      .select("is_driver, driver_subscription_valid_until")
      .eq("id", user.id)
      .maybeSingle();
    profile = r.data;
    profErr = r.error;
    if (!profErr) break;
    if (profErr && isTransientGatewayError(profErr) && attempt < 3) {
      await delay(200 * attempt);
      continue;
    }
    break;
  }

  if (profErr) {
    if (isTransientGatewayError(profErr)) {
      console.error("Driver profile gateway:", formatSupabaseLogError(profErr));
      return new Response(
        JSON.stringify({
          error: "Service temporarily unavailable",
          detail: "Could not reach the database (gateway error). Retry in a few seconds.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    console.error("Driver profile:", formatSupabaseLogError(profErr));
    return new Response(JSON.stringify({ error: "Could not load profile" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!profile?.is_driver) {
    return new Response(JSON.stringify({ error: "Driver access is not enabled for this account." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const subscriptionActive =
    profile.driver_subscription_valid_until != null &&
    new Date(profile.driver_subscription_valid_until as string).getTime() > Date.now();

  await processExpiredOffers(supabase);

  if (req.method === "GET") {
    const now = new Date().toISOString();

    const { data: offerRows, error: offErr } = await supabase
      .from("order_driver_offers")
      .select("id, order_id, expires_at, created_at")
      .eq("driver_id", user.id)
      .is("response", null)
      .gt("expires_at", now)
      .order("created_at", { ascending: true })
      .limit(1);

    if (offErr) {
      console.error("Driver incoming offer:", offErr);
      return new Response(JSON.stringify({ error: "Could not load offer" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let incomingOffer: Record<string, unknown> | null = null;
    const row = offerRows?.[0];
    if (row) {
      const { data: orderRow, error: ordErr } = await supabase.from("orders").select("*").eq("id", row.order_id).maybeSingle();
      if (!ordErr && orderRow && String(orderRow.status) === "pending" && orderRow.driver_id == null) {
        incomingOffer = {
          offerId: row.id,
          expiresAt: row.expires_at,
          createdAt: row.created_at,
          offerSeconds: OFFER_SECONDS,
          /** Client disables Accept when false; POST still enforces subscription. */
          canAccept: subscriptionActive,
          order: orderRow,
        };
      }
    }

    const { data: mine, error: mineErr } = await supabase
      .from("orders")
      .select("*")
      .eq("driver_id", user.id)
      .order("scheduled_at", { ascending: false });

    if (mineErr) {
      console.error("Driver list mine:", mineErr);
      return new Response(JSON.stringify({ error: "Could not load orders" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mineFiltered = (mine || []).filter((r: { status: string }) => !TERMINAL.has(String(r.status || "").toLowerCase()));

    return new Response(
      JSON.stringify({
        incomingOffer,
        mine: mineFiltered,
        available: [],
        subscriptionActive,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderId = body.orderId as string | undefined;
    const action = body.action as string | undefined;
    const nextRaw = body.status as string | undefined;
    const offerId = body.offerId as string | undefined;
    const accept = body.accept as boolean | undefined;

    if (action === "respond_offer") {
      if (!offerId || typeof offerId !== "string") {
        return new Response(JSON.stringify({ error: "Missing offerId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (typeof accept !== "boolean") {
        return new Response(JSON.stringify({ error: "Missing accept (boolean)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: offer, error: foErr } = await supabase
        .from("order_driver_offers")
        .select("id, order_id, driver_id, expires_at, response")
        .eq("id", offerId)
        .maybeSingle();

      if (foErr || !offer) {
        return new Response(JSON.stringify({ error: "Offer not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (offer.driver_id !== user.id) {
        return new Response(JSON.stringify({ error: "Not your offer" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (offer.response != null) {
        return new Response(JSON.stringify({ error: "Offer already handled" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const nowMs = Date.now();
      if (new Date(offer.expires_at as string).getTime() <= nowMs) {
        await supabase.from("order_driver_offers").update({ response: "expired" }).eq("id", offerId);
        await assignNextDriver(supabase, offer.order_id as string);
        return new Response(JSON.stringify({ error: "Offer expired" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (accept) {
        if (!subscriptionActive) {
          return new Response(
            JSON.stringify({
              error:
                "Active Trip5 subscription required to accept rides. Renew weekly (1 JOD) via Trip5 support.",
            }),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        const { data: updated, error: upErr } = await supabase
          .from("orders")
          .update({ driver_id: user.id, status: "confirmed" })
          .eq("id", offer.order_id)
          .eq("status", "pending")
          .is("driver_id", null)
          .select("id")
          .maybeSingle();

        if (upErr) {
          console.error("Accept offer order:", upErr);
          return new Response(JSON.stringify({ error: "Could not accept order" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (!updated) {
          await supabase.from("order_driver_offers").update({ response: "expired" }).eq("id", offerId);
          return new Response(JSON.stringify({ error: "Order no longer available" }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabase.from("order_driver_offers").update({ response: "accepted" }).eq("id", offerId);

        const { data: otherPending } = await supabase
          .from("order_driver_offers")
          .select("id")
          .eq("order_id", offer.order_id)
          .is("response", null)
          .neq("id", offerId);

        for (const o of otherPending || []) {
          await supabase.from("order_driver_offers").update({ response: "declined" }).eq("id", (o as { id: string }).id);
        }

        return new Response(JSON.stringify({ success: true, id: updated.id }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("order_driver_offers").update({ response: "declined" }).eq("id", offerId);
      await assignNextDriver(supabase, offer.order_id as string);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "set_status") {
      if (!orderId || typeof orderId !== "string") {
        return new Response(JSON.stringify({ error: "Missing orderId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: row, error: fetchErr } = await supabase
        .from("orders")
        .select("id, status, driver_id")
        .eq("id", orderId)
        .maybeSingle();

      if (fetchErr || !row) {
        return new Response(JSON.stringify({ error: "Order not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (row.driver_id !== user.id) {
        return new Response(JSON.stringify({ error: "Not your order" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cur = String(row.status || "").toLowerCase();
      const requested = String(nextRaw || "").toLowerCase();
      const expectedNext = NEXT_STATUS[cur];
      if (!expectedNext || requested !== expectedNext) {
        return new Response(
          JSON.stringify({
            error: `Invalid status transition (current: ${cur}, expected next: ${expectedNext || "none"})`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { error: upErr } = await supabase.from("orders").update({ status: requested }).eq("id", orderId);

      if (upErr) {
        console.error("Set status:", upErr);
        return new Response(JSON.stringify({ error: "Could not update order" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action (use respond_offer or set_status)" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("driver-orders uncaught:", e);
    return new Response(JSON.stringify({ error: "Internal error", detail }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
