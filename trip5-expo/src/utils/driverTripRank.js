/**
 * Driver trip tier for dashboard (completed trips → rank badge).
 * Higher `min` = higher tier; first matching row from top wins.
 */
export const DRIVER_TRIP_RANK_ORDER = [
  {
    key: 'platinum',
    min: 300,
    icon: 'ribbon',
    /** Icon + ring color (metallic) */
    accent: '#E5E4E2',
    iconColor: '#9CA3AF',
    softBg: 'rgba(229, 228, 226, 0.22)',
  },
  {
    key: 'diamond',
    min: 150,
    icon: 'diamond-outline',
    accent: '#7DD3FC',
    iconColor: '#0EA5E9',
    softBg: 'rgba(125, 211, 252, 0.18)',
  },
  {
    key: 'gold',
    min: 75,
    icon: 'trophy',
    accent: '#FBBF24',
    iconColor: '#B45309',
    softBg: 'rgba(251, 191, 36, 0.2)',
  },
  {
    key: 'silver',
    min: 25,
    icon: 'medal-outline',
    accent: '#CBD5E1',
    iconColor: '#64748B',
    softBg: 'rgba(203, 213, 225, 0.22)',
  },
  {
    key: 'bronze',
    min: 0,
    icon: 'shield-checkmark-outline',
    accent: '#CD7F32',
    iconColor: '#5C3D1E',
    softBg: 'rgba(205, 127, 50, 0.2)',
  },
];

/**
 * @param {number} completedTrips
 * @returns {typeof DRIVER_TRIP_RANK_ORDER[number]}
 */
export function getDriverTripRank(completedTrips) {
  const n = Math.max(0, Math.floor(Number(completedTrips) || 0));
  for (const tier of DRIVER_TRIP_RANK_ORDER) {
    if (n >= tier.min) return tier;
  }
  return DRIVER_TRIP_RANK_ORDER[DRIVER_TRIP_RANK_ORDER.length - 1];
}
