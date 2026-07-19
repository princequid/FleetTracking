// Shared road-route helpers — used by both the fleet-wide live map and the
// single-trip route map so a trip's route parses/falls back identically everywhere.

// Parse a trip's stored route geometry ({"coordinates":[[lng,lat],...]}, GeoJSON
// LineString order) into the [[lat,lng],...] Leaflet wants. Returns [] if absent/unparseable.
export function parseRouteLatLngs(routeGeometry) {
  if (!routeGeometry) return [];
  try {
    const g = typeof routeGeometry === "string" ? JSON.parse(routeGeometry) : routeGeometry;
    const coords = g?.coordinates;
    if (!Array.isArray(coords)) return [];
    return coords
      .map((c) => [Number(c[1]), Number(c[0])])
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  } catch {
    return [];
  }
}

/**
 * Fetch a real road-following route from OSRM through an ordered list of
 * [lat, lng] waypoints (origin, stops…, destination), returning [[lat,lng],...]
 * suitable for a Leaflet <Polyline>. Returns null on any failure (unreachable
 * server, bad response, timeout) so the caller can fall back to a straight line —
 * same graceful-degradation behavior as the mobile driver app's routing.
 */
export async function fetchRoadRoute(osrmBaseUrl, waypoints, { timeoutMs = 7000 } = {}) {
  if (!Array.isArray(waypoints) || waypoints.length < 2) return null;
  const coordStr = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = `${osrmBaseUrl}/route/v1/driving/${coordStr}?geometries=geojson&overview=full`;
  try {
    const res = await Promise.race([
      fetch(url),
      new Promise((_, reject) => setTimeout(() => reject(new Error("osrm-timeout")), timeoutMs)),
    ]);
    if (!res.ok) return null;
    const data = await res.json();
    const coords = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    return coords.map(([lng, lat]) => [lat, lng]);
  } catch {
    return null;
  }
}
