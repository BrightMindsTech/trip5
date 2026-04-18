/**
 * Sequential 10s offers to drivers (service-role / backend only).
 */

export const OFFER_SECONDS = 45;

/**
 * @typedef {Object} AssignDriverResult
 * @property {boolean} offerCreated
 * @property {'ok'|'order_not_found'|'order_not_dispatchable'|'past_offers_query_failed'|'drivers_query_failed'|'no_eligible_drivers'|'all_drivers_already_offered'|'offer_insert_failed'} reason
 * @property {number} [eligibleDriverCount] drivers matching is_driver + active subscription (before "already offered" filter)
 * @property {string} [insertError]
 */

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
 * @returns {Promise<AssignDriverResult>}
 */
export async function assignNextDriver(supabase, orderId) {
  /** @type {AssignDriverResult} */
  const result = {
    offerCreated: false,
    reason: 'order_not_found',
    eligibleDriverCount: 0,
  };

  const { data: order, error: oErr } = await supabase
    .from('orders')
    .select('id, status, driver_id')
    .eq('id', orderId)
    .maybeSingle();

  if (oErr || !order) {
    result.reason = 'order_not_found';
    return result;
  }
  if (String(order.status) !== 'pending' || order.driver_id != null) {
    result.reason = 'order_not_dispatchable';
    return result;
  }

  const { data: pastOffers, error: pErr } = await supabase
    .from('order_driver_offers')
    .select('driver_id')
    .eq('order_id', orderId);

  if (pErr) {
    console.error('assignNextDriver pastOffers:', pErr);
    result.reason = 'past_offers_query_failed';
    return result;
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
    result.reason = 'drivers_query_failed';
    return result;
  }

  const pool = drivers || [];
  result.eligibleDriverCount = pool.length;

  const ids = pool.map((d) => d.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = ids[i];
    ids[i] = ids[j];
    ids[j] = t;
  }
  const nextId = ids.find((id) => !offered.has(id));
  if (!nextId) {
    result.reason = pool.length === 0 ? 'no_eligible_drivers' : 'all_drivers_already_offered';
    return result;
  }

  const expiresAt = new Date(Date.now() + OFFER_SECONDS * 1000).toISOString();

  const { error: insErr } = await supabase.from('order_driver_offers').insert({
    order_id: orderId,
    driver_id: nextId,
    expires_at: expiresAt,
  });

  if (insErr) {
    console.error('assignNextDriver insert:', insErr);
    result.reason = 'offer_insert_failed';
    result.insertError = insErr.message || String(insErr);
    return result;
  }

  result.offerCreated = true;
  result.reason = 'ok';
  return result;
}
