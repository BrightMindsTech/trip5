/**
 * POST /api/orders — requires Authorization: Bearer <Supabase access token>
 * Persists order in Supabase Postgres (no WhatsApp). Name/phone from profiles.
 */

import { getSupabaseAdmin } from '../lib/supabase.js';

function validateBody(body) {
  const { route, date, service, pickup, destination, skip_destination } = body;
  if (!route || !service || !pickup) {
    return 'Missing required fields';
  }
  if (pickup.latitude == null || pickup.longitude == null) {
    return 'Pickup must include coordinates';
  }
  const destPending = skip_destination === true || destination?.pending === true;
  if (!destPending) {
    if (!destination || destination.latitude == null || destination.longitude == null) {
      return 'Destination must include coordinates, or use skip destination';
    }
  }
  if (!date) {
    return 'Missing date';
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }
  if (!body) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
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

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser(token);

  if (userErr || !user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  const errMsg = validateBody(body);
  if (errMsg) {
    return res.status(400).json({ error: errMsg });
  }

  const { route, date, service, pickup, destination, skip_destination } = body;

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('full_name, phone')
    .eq('id', user.id)
    .maybeSingle();

  if (profileErr) {
    console.error('Profile fetch:', profileErr);
    return res.status(500).json({ error: 'Could not load profile' });
  }

  const passengerName = (profile?.full_name || '').trim() || 'Passenger';
  const passengerPhone = (profile?.phone || '').trim();
  if (!passengerPhone) {
    return res.status(400).json({
      error: 'Add your phone number in your profile before booking.',
    });
  }

  const scheduledAt = new Date(date);
  if (Number.isNaN(scheduledAt.getTime())) {
    return res.status(400).json({ error: 'Invalid date' });
  }

  const destPending = skip_destination === true || destination?.pending === true;
  const row = {
    user_id: user.id,
    route,
    scheduled_at: scheduledAt.toISOString(),
    service,
    pickup: {
      latitude: pickup.latitude,
      longitude: pickup.longitude,
      address: pickup.address || '',
    },
    destination: destPending
      ? {
          pending: true,
          latitude: null,
          longitude: null,
          address: 'Pending',
        }
      : {
          latitude: destination.latitude,
          longitude: destination.longitude,
          address: destination.address || '',
        },
    passenger_name: passengerName,
    passenger_phone: passengerPhone,
    status: 'pending',
  };

  const { data: inserted, error: insertErr } = await supabase.from('orders').insert(row).select('id').single();

  if (insertErr) {
    console.error('Insert order:', insertErr);
    return res.status(500).json({ error: 'Failed to save order' });
  }

  return res.status(200).json({
    success: true,
    id: inserted.id,
  });
}
