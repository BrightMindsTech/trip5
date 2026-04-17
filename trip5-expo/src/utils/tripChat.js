/** Order statuses where rider ↔ driver trip chat is allowed (before trip ends / chat closed). */
export function canUseTripChat(status) {
  const s = String(status || '').toLowerCase();
  return s === 'confirmed' || s === 'driver_en_route' || s === 'in_route';
}
