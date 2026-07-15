// Geofence radius (metres) for start/arrive/photo-capture proximity checks.
// Mirrors the backend's GEOFENCE_RADIUS_METERS in TripService — keep in sync.
export const GEOFENCE_RADIUS_M = 50;

// Great-circle distance in metres between two lat/lng points.
export function haversineMetres(lat1, lng1, lat2, lng2) {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default { GEOFENCE_RADIUS_M, haversineMetres };
