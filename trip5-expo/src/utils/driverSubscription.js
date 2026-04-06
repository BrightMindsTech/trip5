/** Weekly Trip5 subscription gate (profiles.driver_subscription_valid_until). */
export function isDriverSubscriptionActive(validUntil) {
  if (validUntil == null || validUntil === '') return false;
  const t = new Date(validUntil).getTime();
  return Number.isFinite(t) && t > Date.now();
}
