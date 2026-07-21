import { useCallback, useEffect, useMemo, useState } from "react";
import { GoogleMap, MarkerF, PolylineF, useJsApiLoader } from "@react-google-maps/api";
import { createPin3DIcon } from "./pin3D";
import { LIGHT_MAP_STYLE } from "./googleMapStyle";
import { GOOGLE_MAPS_API_KEY, OSRM_BASE_URL } from "../../constants/config";
import { parseRouteLatLngs, fetchRoadRoute } from "../../utils/routeGeometry";

const MAP_CONTAINER_STYLE = { height: "100%", width: "100%" };

// FleetTrack marker-family colors — same fixed roles as the mobile driver map.
const PIN_START_COLOR = "#22C55E";
const PIN_STOP_COLOR  = "#F59E0B";
const PIN_DEST_COLOR  = "#EF4444";

// Convert the [lat,lng] pairs routeGeometry.js hands back into the {lat,lng}
// objects the Google Maps API expects for a Polyline path / Marker position.
const toLatLngObjs = (pairs) => pairs.map(([lat, lng]) => ({ lat, lng }));

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

export default function TripRouteMap({ trip }) {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

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
  const displayedRoutePath = useMemo(() => toLatLngObjs(displayedRoute), [displayedRoute]);

  const handleMapLoad = useCallback((map) => {
    if (displayedRoute.length === 0) return;
    if (displayedRoute.length === 1) {
      map.setCenter(displayedRoutePath[0]);
      map.setZoom(14);
      return;
    }
    const bounds = new window.google.maps.LatLngBounds();
    displayedRoutePath.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 32);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (!isLoaded) {
    return (
      <div className="trip-route-map trip-route-map--loading">
        <span className="loc-spinner" />
        <span>Loading map…</span>
      </div>
    );
  }

  return (
    <div className="trip-route-map">
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={{ lat: routeLine[0][0], lng: routeLine[0][1] }}
        zoom={13}
        onLoad={handleMapLoad}
        options={{
          styles: LIGHT_MAP_STYLE,
          disableDefaultUI: true,
          zoomControl: true,
          scrollwheel: false,
          clickableIcons: false,
        }}
      >
        {displayedRoutePath.length > 1 && (
          <PolylineF path={displayedRoutePath} options={{ strokeColor: "#2563EB", strokeWeight: 4 }} />
        )}
        {points.origin && (
          <MarkerF position={{ lat: points.origin.lat, lng: points.origin.lng }} icon={pinIcon("start")} />
        )}
        {points.stops.map((s, i) =>
          s ? (
            <MarkerF key={i} position={{ lat: s.lat, lng: s.lng }} icon={pinIcon("stop", i + 1)} />
          ) : null
        )}
        {points.destination && (
          <MarkerF
            position={{ lat: points.destination.lat, lng: points.destination.lng }}
            icon={pinIcon("dest")}
          />
        )}
      </GoogleMap>
    </div>
  );
}
