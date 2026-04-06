/**
 * Sequential 10s offers to drivers (service-role / backend only).
 */

export const OFFER_SECONDS = 10;

/**
 * Find pending offers past expiry, mark expired, try next driver for each order.
 */
export async function processExpiredOffers(supabase) {
  const now = new Date().toISOString();
  const { data: stale, error } = await supabase
    .from('order_driver_offers')
    .select('id, order_id')
    .is('response', null)
    .lt('expires_at', now);

  if (error) {
    console.error('processExpiredOffers select:', error);
    return;
  }

  for (const row of stale || []) {
    const { error: upErr } = await supabase
      .from('order_driver_offers')
      .update({ response: 'expired' })
      .eq('id', row.id)
      .is('response', null);
    if (upErr) {
      console.error('processExpiredOffers update:', upErr);
      continue;
    }
    await assignNextDriver(supabase, row.order_id);
  }
}

/**
 * Assign the next driver who has not yet been offered this order.
 */
export async function assignNextDriver(supabase, orderId) {
  const { data: order, error: oErr } = await supabase
    .from('orders')
    .select('id, status, driver_id')
    .eq('id', orderId)
    .maybeSingle();

  if (oErr || !order) return;
  if (String(order.status) !== 'pending' || order.driver_id != null) return;

  const { data: pastOffers, error: pErr } = await supabase
    .from('order_driver_offers')
    .select('driver_id')
    .eq('order_id', orderId);

  if (pErr) {
    console.error('assignNextDriver pastOffers:', pErr);
    return;
  }

  const offered = new Set((pastOffers || []).map((r) => r.driver_id));

  const nowIso = new Date().toISOString();
  const { data: drivers, error: dErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_driver', true)
    .gt('driver_subscription_valid_until', nowIso)
    .order('id', { ascending: true });

  if (dErr) {
    console.error('assignNextDriver drivers:', dErr);
    return;
  }

  const nextId = (drivers || []).map((d) => d.id).find((id) => !offered.has(id));
  if (!nextId) return;

  const expiresAt = new Date(Date.now() + OFFER_SECONDS * 1000).toISOString();

  const { error: insErr } = await supabase.from('order_driver_offers').insert({
    order_id: orderId,
    driver_id: nextId,
    expires_at: expiresAt,
  });

  if (insErr) {
    console.error('assignNextDriver insert:', insErr);
  }
}
