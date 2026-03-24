/**
 * Haversine formula — calculate the great-circle distance between two points
 * on the Earth's surface. Returns distance in kilometres.
 *
 * Pure math, zero dependencies, sub-microsecond execution.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  if (!Number.isFinite(lat1) || !Number.isFinite(lng1) || !Number.isFinite(lat2) || !Number.isFinite(lng2)) {
    return Infinity;
  }
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Default maximum delivery radius in kilometres (overridable via MAX_DELIVERY_RADIUS_KM env var) */
export const DEFAULT_MAX_DELIVERY_RADIUS_KM = 10;
