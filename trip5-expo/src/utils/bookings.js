import i18n from '../i18n';

/**
 * Order status (string stored on orders.status):
 * pending, confirmed, driver_en_route, in_route — non-terminal.
 * completed, cancelled — terminal (excluded from active card).
 * Active slot: non-terminal and (scheduled_at >= now OR driver_en_route/in_route so ongoing trips stay visible after pickup time).
 */
export const TERMINAL_STATUSES = new Set(['completed', 'cancelled']);

const LIVE_ACTIVE_STATUSES = new Set(['driver_en_route', 'in_route']);

export function isLiveActiveStatus(status) {
  return LIVE_ACTIVE_STATUSES.has(String(status || '').toLowerCase());
}

export function getRouteLabel(route) {
  if (!route) return '';
  const r = route;
  if (i18n.locale === 'ar') {
    if (r === 'irbid_to_amman') return i18n.t('from_irbid_to_amman');
    if (r === 'amman_to_irbid') return i18n.t('from_amman_to_irbid');
    if (r === 'airport_to_amman') return i18n.t('route_airport_to_amman');
    if (r === 'airport_to_irbid') return i18n.t('route_airport_to_irbid');
    if (r === 'amman_to_airport') return i18n.t('route_amman_to_airport');
    if (r === 'irbid_to_airport') return i18n.t('route_irbid_to_airport');
  } else {
    if (r === 'irbid_to_amman') return i18n.t('route_irbid_to_amman');
    if (r === 'amman_to_irbid') return i18n.t('route_amman_to_irbid');
    if (r === 'airport_to_amman') return i18n.t('route_airport_to_amman');
    if (r === 'airport_to_irbid') return i18n.t('route_airport_to_irbid');
    if (r === 'amman_to_airport') return i18n.t('route_amman_to_airport');
    if (r === 'irbid_to_airport') return i18n.t('route_irbid_to_airport');
  }
  return r;
}

export function statusLabel(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'completed') return i18n.t('order_status_completed');
  if (s === 'cancelled') return i18n.t('order_status_cancelled');
  if (s === 'confirmed') return i18n.t('order_status_confirmed');
  if (s === 'driver_en_route') return i18n.t('order_status_driver_en_route');
  if (s === 'in_route') return i18n.t('order_status_in_route');
  return i18n.t('order_status_pending');
}

export function isTerminalStatus(status) {
  return TERMINAL_STATUSES.has(String(status || '').toLowerCase());
}

/**
 * @param {Array<object>} rows - orders from Supabase
 * @param {Date} [now]
 * @returns {{ active: object | null, history: object[] }}
 */
export function partitionBookings(rows, now = new Date()) {
  const list = Array.isArray(rows) ? [...rows] : [];
  const t = now.getTime();

  const nonTerminalFuture = list.filter((r) => {
    if (isTerminalStatus(r.status)) return false;
    if (isLiveActiveStatus(r.status)) return true;
    const scheduled = new Date(r.scheduled_at).getTime();
    return scheduled >= t;
  });
  nonTerminalFuture.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  const active = nonTerminalFuture[0] || null;
  const activeId = active?.id;

  const history = list
    .filter((r) => r.id !== activeId)
    .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at));

  return { active, history };
}

export function formatBookingDate(isoString, locale) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  const loc = locale === 'ar' ? 'ar-JO' : 'en-JO';
  return d.toLocaleString(loc, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function pickupSummary(pickup) {
  if (!pickup || typeof pickup !== 'object') return '';
  const a = pickup.address;
  return typeof a === 'string' && a.trim() ? a.trim() : '';
}

export function destinationSummary(destination) {
  if (!destination || typeof destination !== 'object') return '';
  if (destination.pending) return '—';
  const a = destination.address;
  return typeof a === 'string' && a.trim() ? a.trim() : '';
}
