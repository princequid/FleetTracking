import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { createPin3DIcon } from "./pin3D";
import { OSRM_BASE_URL } from "../../constants/config";
import { parseRouteLatLngs, fetchRoadRoute } from "../../utils/routeGeometry";

// FleetTrack marker-family colors — same fixed roles as the mobile driver map.
const PIN_START_COLOR = "#22C55E";
const PIN_STOP_COLOR  = "#F59E0B";
const PIN_DEST_COLOR  = "#EF4444";

// Forward-geocode a free-text location into coordinates (same Nominatim endpoint
// LocationAutocomplete uses). Only called for legacy trips that lack stored lat/lng.
async function geocode(query) {
  if (!query) return null;
  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
  } catch {
    return null;
  }
}

// Glossy 3D pins matching the driver app's map (green start, numbered amber stops,
// red destination) — same shared shape as components/map/pin3D.js, so the product
// reads as one visual system across mobile and admin.
function pinIcon(kind, number) {
  if (kind === "start") return createPin3DIcon(PIN_START_COLOR, { size: 34 });
  if (kind === "stop")  return createPin3DIcon(PIN_STOP_COLOR,  { size: 34, hole: false, number });
  return createPin3DIcon(PIN_DEST_COLOR, { size: 34 });
}

// Fits the map view to every resolved point once they're known.
function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 14);
    else map.fitBounds(points, { padding: [32, 32] });
  }, [points, map]);
  return null;
}

export default function TripRouteMap({ trip }) {
  const [points, setPoints] = useState(null); // null = resolving; object once resolved
  const [roadRoute, setRoadRoute] = useState(null); // road-following [[lat,lng],...], or null

  useEffect(() => {
    let cancelled = false;
    const stops = trip.stops || [];

    Promise.all([
      trip.originLat != null && trip.originLng != null
        ? Promise.resolve({ lat: Number(trip.originLat), lng: Number(trip.originLng) })
        : geocode(trip.origin),
      trip.destLat != null && trip.destLng != null
        ? Promise.resolve({ lat: Number(trip.destLat), lng: Number(trip.destLng) })
        : geocode(trip.destination),
      Promise.all(
        stops.map((s) =>
          s.lat != null && s.lng != null
            ? Promise.resolve({ lat: Number(s.lat), lng: Number(s.lng) })
            : geocode(s.name)
        )
      ),
    ]).then(([origin, destination, stopPoints]) => {
      if (!cancelled) setPoints({ origin, destination, stops: stopPoints });
    });

    return () => { cancelled = true; };
  }, [trip.id]);

  const routeLine = useMemo(() => {
    if (!points) return [];
    return [points.origin, ...points.stops, points.destination]
      .filter(Boolean)
      .map((p) => [p.lat, p.lng]);
  }, [points]);

  // Prefer the trip's stored road-route geometry — computed via OSRM by the driver
  // app once the trip is under way, so this is the exact route actually driven.
  // Otherwise, fetch one directly from OSRM so the admin sees a real road route even
  // before a driver has opened the trip. Falls back to the straight-line `routeLine`
  // (rendered below) if OSRM is unreachable — same graceful degradation the mobile
  // app uses for its own routing.
  useEffect(() => {
    setRoadRoute(null);
    const stored = parseRouteLatLngs(trip.routeGeometry);
    if (stored.length > 1) {
      setRoadRoute(stored);
      return;
    }
    if (routeLine.length < 2) return;
    let cancelled = false;
    fetchRoadRoute(OSRM_BASE_URL, routeLine).then((road) => {
      if (!cancelled && road) setRoadRoute(road);
    });
    return () => { cancelled = true; };
  }, [trip.routeGeometry, routeLine]);

  const displayedRoute = roadRoute && roadRoute.length > 1 ? roadRoute : routeLine;

  if (points === null) {
    return (
      <div className="trip-route-map trip-route-map--loading">
        <span className="loc-spinner" />
        <span>Loading map…</span>
      </div>
    );
  }

  if (routeLine.length === 0) {
    return (
      <div className="trip-route-map trip-route-map--empty">
        Location data unavailable for this trip.
      </div>
    );
  }

  return (
    <div className="trip-route-map">
      <MapContainer
        center={routeLine[0]}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />
        <FitBounds points={displayedRoute} />
        {displayedRoute.length > 1 && (
          <Polyline positions={displayedRoute} pathOptions={{ color: "#2563EB", weight: 4 }} />
        )}
        {points.origin && (
          <Marker position={[points.origin.lat, points.origin.lng]} icon={pinIcon("start")} />
        )}
        {points.stops.map((s, i) =>
          s ? <Marker key={i} position={[s.lat, s.lng]} icon={pinIcon("stop", i + 1)} /> : null
        )}
        {points.destination && (
          <Marker
            position={[points.destination.lat, points.destination.lng]}
            icon={pinIcon("dest")}
          />
        )}
      </MapContainer>
    </div>
  );
}
