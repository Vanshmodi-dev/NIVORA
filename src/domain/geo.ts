/**
 * Straight-line geometry helpers. Distances are APPROXIMATE straight-line estimates,
 * never travel times (TP-9, TP-11).
 */
export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371.0088;
const rad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** `≈ 3.2 km straight-line`; below 1 km: `≈ 650 m straight-line` (rounded to 50 m). */
export function formatApproxDistance(km: number): string {
  if (km < 1) {
    const m = Math.max(50, Math.round((km * 1000) / 50) * 50);
    return m >= 1000 ? "≈ 1.0 km straight-line" : `≈ ${m} m straight-line`;
  }
  return `≈ ${km.toFixed(1)} km straight-line`;
}

/** FNV-1a 32-bit hash — small deterministic hash for coordinate offsets. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const MAX_COORDINATE_OFFSET_M = 600;

/**
 * Approximate demo coordinates: locality centroid plus a deterministic offset (≤ 600 m) derived
 * from the property id. Never a pinpoint location (§6.2).
 */
export function approximateCoordinates(centroid: LatLng, propertyId: string): LatLng {
  const h = hashString(propertyId);
  const angle = ((h & 0xffff) / 0xffff) * 2 * Math.PI;
  const radius = (((h >>> 16) & 0xffff) / 0xffff) * MAX_COORDINATE_OFFSET_M;
  const dLat = (radius * Math.cos(angle)) / 111_320;
  const dLng = (radius * Math.sin(angle)) / (111_320 * Math.cos(rad(centroid.lat)));
  return {
    lat: Math.round((centroid.lat + dLat) * 1e5) / 1e5,
    lng: Math.round((centroid.lng + dLng) * 1e5) / 1e5,
  };
}
