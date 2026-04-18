/**
 * GET /api/driver-orders — incoming timed offer + my jobs (requires driver)
 * POST — respond_offer | set_status | (legacy accept removed for offer flow)
 */

import { getSupabaseAdmin } from '../lib/supabase.js';
import { processExpiredOffers, assignNextDriver, OFFER_SECONDS } from '../lib/driverDispatch.js';

const TERMINAL = new Set(['completed', 'cancelled']);

function getBearer(req) {
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

async function getAuthedUser(supabase, token) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

function subscriptionActive(validUntil) {
  if (validUntil == null || validUntil === '') return false;
  return new Date(validUntil).getTime() > Date.now();
}

async function requireDriver(supabase, userId) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('is_driver, driver_subscription_valid_until')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('Driver profile:', error);
    return { ok: false, status: 500, message: 'Could not load profile' };
  }
  if (!profile?.is_driver) {
    return { ok: false, status: 403, message: 'Driver access is not enabled for this account.' };
  }
  return { ok: true, profile };
}

const NEXT_STATUS = {
  confirmed: 'driver_en_route',
  driver_en_route: 'in_route',
  in_route: 'completed',
};

export default async function handler(req, res) {
  const token = getBearer(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const user = await getAuthedUser(supabase, token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  const driverCheck = await requireDriver(supabase, user.id);
  if (!driverCheck.ok) {
    return res.status(driverCheck.status).json({ error: driverCheck.message });
  }
  const subActive = subscriptionActive(driverCheck.profile?.driver_subscription_valid_until);

  await processExpiredOffers(supabase);

  if (req.method === 'GET') {
    const now = new Date().toISOString();

    const { data: offerRows, error: offErr } = await supabase
      .from('order_driver_offers')
      .select('id, order_id, expires_at, created_at')
      .eq('driver_id', user.id)
      .is('response', null)
      .gt('expires_at', now)
      .order('created_at', { ascending: true })
      .limit(1);

    if (offErr) {
      console.error('Driver incoming offer:', offErr);
      return res.status(500).json({ error: 'Could not load offer' });
    }

    let incomingOffer = null;
    const row = offerRows?.[0];
    if (row) {
      const { data: orderRow, error: ordErr } = await supabase.from('orders').select('*').eq('id', row.order_id).maybeSingle();
      if (!ordErr && orderRow && String(orderRow.status) === 'pending' && orderRow.driver_id == null) {
        incomingOffer = {
          offerId: row.id,
          expiresAt: row.expires_at,
          createdAt: row.created_at,
          offerSeconds: OFFER_SECONDS,
          canAccept: subActive,
          order: orderRow,
        };
      }
    }

    const { data: mine, error: mineErr } = await supabase
      .from('orders')
      .select('*')
      .eq('driver_id', user.id)
      .order('scheduled_at', { ascending: false });

    if (mineErr) {
      console.error('Driver list mine:', mineErr);
      return res.status(500).json({ error: 'Could not load orders' });
    }

    const mineFiltered = (mine || []).filter((r) => !TERMINAL.has(String(r.status || '').toLowerCase()));

    return res.status(200).json({
      incomingOffer,
      mine: mineFiltered,
      available: [],
      subscriptionActive: subActive,
    });
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: 'Invalid JSON' });
      }
    }
    const { orderId, action, status: nextRaw, offerId, accept } = body || {};

    if (action === 'respond_offer') {
      if (!offerId || typeof offerId !== 'string') {
        return res.status(400).json({ error: 'Missing offerId' });
      }
      if (typeof accept !== 'boolean') {
        return res.status(400).json({ error: 'Missing accept (boolean)' });
      }

      const { data: offer, error: foErr } = await supabase
        .from('order_driver_offers')
        .select('id, order_id, driver_id, expires_at, response')
        .eq('id', offerId)
        .maybeSingle();

      if (foErr || !offer) {
        return res.status(404).json({ error: 'Offer not found' });
      }
      if (offer.driver_id !== user.id) {
        return res.status(403).json({ error: 'Not your offer' });
      }
      if (offer.response != null) {
        return res.status(409).json({ error: 'Offer already handled' });
      }
      const now = Date.now();
      if (new Date(offer.expires_at).getTime() <= now) {
        await supabase.from('order_driver_offers').update({ response: 'expired' }).eq('id', offerId);
        await assignNextDriver(supabase, offer.order_id);
        return res.status(409).json({ error: 'Offer expired' });
      }

      if (accept) {
        if (!subActive) {
          return res.status(403).json({
            error:
              'Active Trip5 subscription required to accept rides. Renew weekly (1 JOD) via Trip5 support.',
          });
        }
        const { data: updated, error: upErr } = await supabase
          .from('orders')
          .update({ driver_id: user.id, status: 'confirmed' })
          .eq('id', offer.order_id)
          .eq('status', 'pending')
          .is('driver_id', null)
          .select('id')
          .maybeSingle();

        if (upErr) {
          console.error('Accept offer order:', upErr);
          return res.status(500).json({ error: 'Could not accept order' });
        }
        if (!updated) {
          await supabase.from('order_driver_offers').update({ response: 'expired' }).eq('id', offerId);
          return res.status(409).json({ error: 'Order no longer available' });
        }

        await supabase.from('order_driver_offers').update({ response: 'accepted' }).eq('id', offerId);

        const { data: otherPending } = await supabase
          .from('order_driver_offers')
          .select('id')
          .eq('order_id', offer.order_id)
          .is('response', null)
          .neq('id', offerId);

        for (const o of otherPending || []) {
          await supabase.from('order_driver_offers').update({ response: 'declined' }).eq('id', o.id);
        }

        return res.status(200).json({ success: true, id: updated.id });
      }

      await supabase.from('order_driver_offers').update({ response: 'declined' }).eq('id', offerId);
      await assignNextDriver(supabase, offer.order_id);
      return res.status(200).json({ success: true });
    }

    if (action === 'set_status') {
      if (!orderId || typeof orderId !== 'string') {
        return res.status(400).json({ error: 'Missing orderId' });
      }
      const { data: row, error: fetchErr } = await supabase
        .from('orders')
        .select('id, status, driver_id')
        .eq('id', orderId)
        .maybeSingle();

      if (fetchErr || !row) {
        return res.status(404).json({ error: 'Order not found' });
      }
      if (row.driver_id !== user.id) {
        return res.status(403).json({ error: 'Not your order' });
      }

      const cur = String(row.status || '').toLowerCase();
      const requested = String(nextRaw || '').toLowerCase();
      const expectedNext = NEXT_STATUS[cur];
      if (!expectedNext || requested !== expectedNext) {
        return res.status(400).json({
          error: `Invalid status transition (current: ${cur}, expected next: ${expectedNext || 'none'})`,
        });
      }

      const { error: upErr } = await supabase.from('orders').update({ status: requested }).eq('id', orderId);

      if (upErr) {
        console.error('Set status:', upErr);
        return res.status(500).json({ error: 'Could not update order' });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action (use respond_offer or set_status)' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
