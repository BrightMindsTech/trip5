/** Human-readable trip id from `orders.trip_reference` (when migration applied). */
export function getTripReference(order) {
  const t = order?.trip_reference;
  if (t == null || String(t).trim() === '') return null;
  return String(t).trim();
}

/** Localized single line for UI (Activity, tracking, success). */
export function formatTripRefLine(i18n, code) {
  if (!code) return '';
  return i18n.t('booking_reference_label', { code: String(code).trim() });
}
