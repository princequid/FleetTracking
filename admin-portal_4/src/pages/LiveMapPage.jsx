import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getActivePositions } from "../services/gpsService";
import { getTrips } from "../services/tripService";
import { getDrivers } from "../services/driverService";
import { getVehicles } from "../services/vehicleService";
import { useFleetWebSocket } from "../hooks/useFleetWebSocket";
import { createDriverCarIcon, createRoutePinIcon, driverColor } from "../components/map/driverCarIcon";
import { parseRouteLatLngs } from "../utils/routeGeometry";
import LoadingState from "../components/common/LoadingState";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import { useTheme } from "../context/ThemeContext";
import {
  PlusIcon,
  MinusIcon,
  CrosshairIcon,
  EmptyVehiclesIllustration,
} from "../components/common/Icons";

const ACCRA_CENTER = [5.6037, -0.187];
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

function MapController({ onReady }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}

function isStalePosition(position) {
  if (!position.recordedAt) return true;
  return Date.now() - new Date(position.recordedAt).getTime() > STALE_THRESHOLD_MS;
}

export default function LiveMapPage() {
  const navigate = useNavigate();
  const { subscribe, unsubscribe, isConnected } = useFleetWebSocket();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [positions, setPositions] = useState([]);
  const [tripMetaById, setTripMetaById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTripId, setSelectedTripId] = useState(null);

  const mapRef = useRef(null);
  const markerRefs = useRef({});
  const handleMapReady = useCallback((map) => {
    mapRef.current = map;
  }, []);

  // Resolve driver/vehicle/trip for each trip. The trip record carries the route
  // geometry + stops we draw. GPS pings carry the auth user id as `driverId` (a
  // different id space from the driver PROFILE id on the trip), so display info is
  // always resolved via the trip, not the raw ping.
  const refreshMeta = useCallback(async () => {
    const [trips, drivers, vehicles] = await Promise.all([getTrips(), getDrivers(), getVehicles()]);
    const driversById = Object.fromEntries(drivers.map((d) => [d.id, d]));
    const vehiclesById = Object.fromEntries(vehicles.map((v) => [v.id, v]));
    const meta = {};
    trips.forEach((trip) => {
      meta[trip.id] = {
        driver: driversById[trip.driverId] || null,
        vehicle: vehiclesById[trip.vehicleId] || null,
        trip,
      };
    });
    setTripMetaById(meta);
  }, []);

  // Hoisted so the panel's retry button and the mount effect share one path.
  const loadPositions = useCallback(() => {
    setLoading(true);
    setError("");
    return Promise.all([getActivePositions(), refreshMeta()])
      .then(([positionData]) => setPositions(positionData))
      .catch(() => setError("Unable to load active vehicle positions."))
      .finally(() => setLoading(false));
  }, [refreshMeta]);

  useEffect(() => {
    loadPositions();
    // Re-poll trips (route geometry + stops) so the admin sees reroutes live, without
    // needing a manual refresh. Positions themselves update over the websocket.
    const metaInterval = setInterval(() => {
      refreshMeta().catch(() => {});
    }, 20000);
    return () => clearInterval(metaInterval);
  }, [loadPositions, refreshMeta]);

  const tripIdsKey = useMemo(
    () =>
      positions
        .map((p) => p.tripId)
        .sort()
        .join(","),
    [positions]
  );

  useEffect(() => {
    positions.forEach((position) => {
      subscribe(position.tripId, (update) => {
        setPositions((prev) =>
          prev.map((p) => {
            if (p.tripId !== position.tripId) return p;
            // Ignore an update that's older than what's already shown — the backend
            // already guards this for a normal ping, but this is a second line of
            // defense against any out-of-order delivery ever snapping the marker
            // backward to a stale point.
            if (p.recordedAt && update.recordedAt && new Date(update.recordedAt) <= new Date(p.recordedAt)) {
              return p;
            }
            return {
              ...p,
              lat: update.lat,
              lng: update.lng,
              speedKmh: update.speedKmh,
              recordedAt: update.recordedAt,
            };
          })
        );
      });
    });
    return () => {
      positions.forEach((position) => unsubscribe(position.tripId));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripIdsKey]);

  function handleCenterFleet() {
    const map = mapRef.current;
    if (!map || positions.length === 0) return;
    const bounds = L.latLngBounds(positions.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }

  function handleSelectVehicle(position) {
    setSelectedTripId(position.tripId);
    const map = mapRef.current;
    const marker = markerRefs.current[position.tripId];
    if (map) {
      map.flyTo([position.lat, position.lng], Math.max(map.getZoom(), 13));
    }
    if (marker) {
      marker.openPopup();
      const el = marker.getElement();
      if (el) {
        el.classList.add("marker-selected");
        setTimeout(() => el.classList.remove("marker-selected"), 600);
      }
    }
  }

  return (
    <div className="fleet-map-layout">
      <div className="fleet-map-panel">
        <MapContainer
          center={ACCRA_CENTER}
          zoom={12}
          zoomControl={false}
          className="fleet-map-container"
        >
          {/* Keyed on the theme so React remounts the layer rather than
              trying to diff a changed tile URL, which Leaflet does not pick up. */}
          <TileLayer
            key={isDark ? "dark" : "light"}
            url={`https://{s}.basemaps.cartocdn.com/${isDark ? "dark_all" : "light_all"}/{z}/{x}/{y}{r}.png`}
            attribution="&copy; CartoDB"
          />
          <MapController onReady={handleMapReady} />

          {/* Per-driver route + stops — the driver's actual road route (updates live as
              they reroute), tinted with that driver's colour. Drawn under the markers. */}
          {positions.map((position) => {
            const meta = tripMetaById[position.tripId];
            const trip = meta?.trip;
            const color = driverColor(meta?.driver?.id ?? position.tripId);
            const routeLatLngs = parseRouteLatLngs(trip?.routeGeometry);
            const stops = trip?.stops || [];
            return (
              <React.Fragment key={`route-${position.tripId}`}>
                {routeLatLngs.length > 1 && (
                  <Polyline
                    positions={routeLatLngs}
                    pathOptions={{ color: color.base, weight: 4, opacity: 0.85 }}
                  />
                )}
                {stops.map((s, i) =>
                  s?.lat != null && s?.lng != null ? (
                    <Marker
                      key={`stop-${position.tripId}-${i}`}
                      position={[Number(s.lat), Number(s.lng)]}
                      icon={createRoutePinIcon(color.base, i + 1)}
                    />
                  ) : null
                )}
                {trip?.destLat != null && trip?.destLng != null && (
                  <Marker
                    position={[Number(trip.destLat), Number(trip.destLng)]}
                    icon={createRoutePinIcon(color.base, "", true)}
                  />
                )}
              </React.Fragment>
            );
          })}

          {positions.map((position) => {
            const meta = tripMetaById[position.tripId];
            const stale = isStalePosition(position);
            // Colour keyed to the driver's account id so each driver's car is a distinct,
            // consistent colour the admin can recognise at a glance.
            const colorKey = meta?.driver?.id ?? position.tripId;
            const color = driverColor(colorKey);
            return (
              <Marker
                key={position.tripId}
                position={[position.lat, position.lng]}
                icon={createDriverCarIcon(colorKey, stale)}
                ref={(marker) => {
                  if (marker) markerRefs.current[position.tripId] = marker;
                }}
              >
                <Popup className="fleet-popup">
                  <div className="fleet-popup-driver">
                    <span className="fleet-driver-dot" style={{ backgroundColor: color.base }} />
                    {meta?.driver?.fullName || `Trip #${position.tripId}`}
                  </div>
                  <div className="fleet-popup-row">Trip #{position.tripId}</div>
                  <div className="fleet-popup-row">
                    Speed: {position.speedKmh != null ? `${position.speedKmh} km/h` : "—"}
                  </div>
                  <div className="fleet-popup-row">Vehicle: {meta?.vehicle?.plateNumber || "—"}</div>
                  <button
                    className="fleet-popup-link"
                    type="button"
                    onClick={() => navigate(`/trips/${position.tripId}`)}
                  >
                    View Trip
                  </button>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        <div className="fleet-map-controls">
          <div className="fleet-zoom-group">
            <button
              type="button"
              className="fleet-map-btn"
              onClick={() => mapRef.current?.zoomIn()}
              aria-label="Zoom in"
            >
              <PlusIcon size={17} />
            </button>
            <button
              type="button"
              className="fleet-map-btn"
              onClick={() => mapRef.current?.zoomOut()}
              aria-label="Zoom out"
            >
              <MinusIcon size={17} />
            </button>
          </div>
          <button
            type="button"
            className="fleet-map-btn fleet-center-btn"
            onClick={handleCenterFleet}
            disabled={positions.length === 0}
            title={
              positions.length === 0
                ? "No active vehicles to centre on"
                : "Fit all active vehicles in view"
            }
          >
            <CrosshairIcon size={16} />
            <span>Centre on fleet</span>
          </button>
        </div>
      </div>

      <div className="fleet-sidebar">
        <div className="fleet-sidebar-header">
          <h2>Active Vehicles</h2>
          <span className="fleet-sidebar-count">{positions.length}</span>
        </div>

        <div className="fleet-vehicle-list">
          {loading ? (
            <LoadingState message="Loading active vehicles…" />
          ) : error ? (
            <ErrorState
              title="Can't load vehicle positions"
              message="The live feed is unavailable — an empty map here does not mean the fleet is idle."
              onRetry={loadPositions}
            />
          ) : positions.length === 0 ? (
            <EmptyState
              compact
              illustration={EmptyVehiclesIllustration}
              title="No vehicles on the road"
              subtitle="Vehicles appear here once a driver starts a trip."
            />
          ) : (
            positions.map((position) => {
              const meta = tripMetaById[position.tripId];
              const stale = isStalePosition(position);
              const color = driverColor(meta?.driver?.id ?? position.tripId);
              return (
                <div
                  key={position.tripId}
                  className={`fleet-vehicle-item ${
                    selectedTripId === position.tripId ? "fleet-vehicle-item-active" : ""
                  }`}
                  onClick={() => handleSelectVehicle(position)}
                >
                  <span
                    className="fleet-driver-dot fleet-driver-dot-lg"
                    style={{ backgroundColor: color.base }}
                    title="Driver colour"
                  />
                  <div className="fleet-vehicle-info">
                    <div className="fleet-vehicle-driver">
                      {meta?.driver?.fullName || `Trip #${position.tripId}`}
                    </div>
                    <div className="fleet-vehicle-plate">
                      {meta?.vehicle?.plateNumber || `Trip #${position.tripId}`}
                    </div>
                  </div>
                  <div className="fleet-vehicle-meta">
                    <span className={`fleet-speed-badge ${stale ? "fleet-speed-badge-stale" : ""}`}>
                      {position.speedKmh != null ? `${Math.round(position.speedKmh)} km/h` : "—"}
                    </span>
                    <span className="fleet-vehicle-time">
                      {position.recordedAt
                        ? new Date(position.recordedAt).toLocaleTimeString()
                        : "—"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="fleet-connection-status">
          <span
            className={`fleet-status-dot ${
              isConnected ? "fleet-status-dot-live" : "fleet-status-dot-reconnecting"
            }`}
          />
          <span>{isConnected ? "Live" : "Reconnecting..."}</span>
        </div>
      </div>
    </div>
  );
}
