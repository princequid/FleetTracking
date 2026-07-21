import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleMap, InfoWindowF, MarkerF, PolylineF, useJsApiLoader } from "@react-google-maps/api";
import { getActivePositions } from "../services/gpsService";
import { getTrips } from "../services/tripService";
import { getDrivers } from "../services/driverService";
import { getVehicles } from "../services/vehicleService";
import { useFleetWebSocket } from "../hooks/useFleetWebSocket";
import { createDriverCarIcon, createRoutePinIcon, driverColor } from "../components/map/driverCarIcon";
import { LIGHT_MAP_STYLE } from "../components/map/googleMapStyle";
import { GOOGLE_MAPS_API_KEY } from "../constants/config";
import { parseRouteLatLngs } from "../utils/routeGeometry";

const ACCRA_CENTER = { lat: 5.6037, lng: -0.187 };
const STALE_THRESHOLD_MS = 5 * 60 * 1000;
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

const toLatLngObjs = (pairs) => pairs.map(([lat, lng]) => ({ lat, lng }));

function isStalePosition(position) {
  if (!position.recordedAt) return true;
  return Date.now() - new Date(position.recordedAt).getTime() > STALE_THRESHOLD_MS;
}

export default function LiveMapPage() {
  const navigate = useNavigate();
  const { subscribe, unsubscribe, isConnected } = useFleetWebSocket();
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const [positions, setPositions] = useState([]);
  const [tripMetaById, setTripMetaById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [openInfoTripId, setOpenInfoTripId] = useState(null);

  const mapRef = useRef(null);
  const handleMapLoad = useCallback((map) => {
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

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([getActivePositions(), refreshMeta()])
      .then(([positionData]) => setPositions(positionData))
      .catch(() => setError("Unable to load active vehicle positions."))
      .finally(() => setLoading(false));
    // Re-poll trips (route geometry + stops) so the admin sees reroutes live, without
    // needing a manual refresh. Positions themselves update over the websocket.
    const metaInterval = setInterval(() => {
      refreshMeta().catch(() => {});
    }, 20000);
    return () => clearInterval(metaInterval);
  }, [refreshMeta]);

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
    const bounds = new window.google.maps.LatLngBounds();
    positions.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    map.fitBounds(bounds, 40);
  }

  function handleSelectVehicle(position) {
    setSelectedTripId(position.tripId);
    setOpenInfoTripId(position.tripId);
    const map = mapRef.current;
    if (map) {
      map.panTo({ lat: position.lat, lng: position.lng });
      map.setZoom(Math.max(map.getZoom(), 13));
    }
  }

  return (
    <div className="fleet-map-layout">
      <div className="fleet-map-panel">
        {isLoaded && (
          <GoogleMap
            mapContainerStyle={MAP_CONTAINER_STYLE}
            center={ACCRA_CENTER}
            zoom={12}
            onLoad={handleMapLoad}
            options={{
              styles: LIGHT_MAP_STYLE,
              disableDefaultUI: true,
              zoomControl: false,
              clickableIcons: false,
            }}
          >
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
                    <PolylineF
                      path={toLatLngObjs(routeLatLngs)}
                      options={{ strokeColor: color.base, strokeWeight: 4, strokeOpacity: 0.85 }}
                    />
                  )}
                  {stops.map((s, i) =>
                    s?.lat != null && s?.lng != null ? (
                      <MarkerF
                        key={`stop-${position.tripId}-${i}`}
                        position={{ lat: Number(s.lat), lng: Number(s.lng) }}
                        icon={createRoutePinIcon(color.base, i + 1)}
                      />
                    ) : null
                  )}
                  {trip?.destLat != null && trip?.destLng != null && (
                    <MarkerF
                      position={{ lat: Number(trip.destLat), lng: Number(trip.destLng) }}
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
              const markerPos = { lat: position.lat, lng: position.lng };
              return (
                <MarkerF
                  key={position.tripId}
                  position={markerPos}
                  icon={createDriverCarIcon(colorKey, stale)}
                  onClick={() => setOpenInfoTripId(position.tripId)}
                >
                  {openInfoTripId === position.tripId && (
                    <InfoWindowF position={markerPos} onCloseClick={() => setOpenInfoTripId(null)}>
                      <div className="fleet-popup">
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
                      </div>
                    </InfoWindowF>
                  )}
                </MarkerF>
              );
            })}
          </GoogleMap>
        )}

        <div className="fleet-map-controls">
          <button
            type="button"
            onClick={() => mapRef.current?.setZoom((mapRef.current.getZoom() || 12) + 1)}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => mapRef.current?.setZoom((mapRef.current.getZoom() || 12) - 1)}
            aria-label="Zoom out"
          >
            −
          </button>
          <button type="button" className="fleet-center-btn" onClick={handleCenterFleet}>
            Center on fleet
          </button>
        </div>
      </div>

      <div className="fleet-sidebar">
        <div className="fleet-sidebar-header">
          <h2>Active Vehicles</h2>
          <span className="fleet-sidebar-count">{positions.length}</span>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="fleet-vehicle-list">
          {loading ? (
            <p className="loading-text">Loading active vehicles…</p>
          ) : positions.length === 0 ? (
            <p className="dispatch-empty-text">No vehicles currently active.</p>
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
