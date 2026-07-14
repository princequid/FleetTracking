import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

// Colored circular pins matching the driver app's map (green start, numbered navy
// stops, red destination) so the product reads consistently across mobile and admin.
function pinIcon(kind, number) {
  const label = kind === "stop" ? `<span>${number}</span>` : "";
  return L.divIcon({
    className: "",
    html: `<div class="trip-map-pin trip-map-pin--${kind}">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
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
        <FitBounds points={routeLine} />
        {routeLine.length > 1 && (
          <Polyline positions={routeLine} pathOptions={{ color: "#2563EB", weight: 4 }} />
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
