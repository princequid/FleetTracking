import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { getActivePositions } from "../services/gpsService";
import { getTrips } from "../services/tripService";
import { getDrivers } from "../services/driverService";
import { getVehicles } from "../services/vehicleService";
import { useFleetWebSocket } from "../hooks/useFleetWebSocket";
import { TruckIcon } from "../components/common/Icons";

const ACCRA_CENTER = [5.6037, -0.187];
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

function createTruckDivIcon(isStale) {
  const borderColor = isStale ? "var(--color-warning)" : "var(--color-teal)";
  const iconOpacity = isStale ? 0.6 : 1;
  return L.divIcon({
    html: `
      <div class="fleet-marker-box" style="border-color: ${borderColor};">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#0F2347" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: ${iconOpacity};">
          <rect x="1" y="6" width="13" height="11" rx="1"></rect>
          <path d="M14 10h4l4 4v3h-8z"></path>
          <circle cx="6" cy="19" r="1.6"></circle>
          <circle cx="17" cy="19" r="1.6"></circle>
        </svg>
      </div>
    `,
    className: "fleet-marker",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

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

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([getActivePositions(), getTrips(), getDrivers(), getVehicles()])
      .then(([positionData, trips, drivers, vehicles]) => {
        setPositions(positionData);
        // GPS pings carry the auth user id as `driverId`, which is a different
        // id space from the driver PROFILE id stored on the trip — resolve
        // driver/vehicle display info via the trip record, not the raw ping.
        const driversById = Object.fromEntries(drivers.map((d) => [d.id, d]));
        const vehiclesById = Object.fromEntries(vehicles.map((v) => [v.id, v]));
        const meta = {};
        trips.forEach((trip) => {
          meta[trip.id] = {
            driver: driversById[trip.driverId] || null,
            vehicle: vehiclesById[trip.vehicleId] || null,
          };
        });
        setTripMetaById(meta);
      })
      .catch(() => setError("Unable to load active vehicle positions."))
      .finally(() => setLoading(false));
  }, []);

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
          prev.map((p) =>
            p.tripId === position.tripId
              ? {
                  ...p,
                  lat: update.lat,
                  lng: update.lng,
                  speedKmh: update.speedKmh,
                  recordedAt: update.recordedAt,
                }
              : p
          )
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
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution="&copy; CartoDB"
          />
          <MapController onReady={handleMapReady} />
          {positions.map((position) => {
            const meta = tripMetaById[position.tripId];
            const stale = isStalePosition(position);
            return (
              <Marker
                key={position.tripId}
                position={[position.lat, position.lng]}
                icon={createTruckDivIcon(stale)}
                ref={(marker) => {
                  if (marker) markerRefs.current[position.tripId] = marker;
                }}
              >
                <Popup className="fleet-popup">
                  <div className="fleet-popup-driver">
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
          <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in">
            +
          </button>
          <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out">
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
              return (
                <div
                  key={position.tripId}
                  className={`fleet-vehicle-item ${
                    selectedTripId === position.tripId ? "fleet-vehicle-item-active" : ""
                  }`}
                  onClick={() => handleSelectVehicle(position)}
                >
                  <TruckIcon size={18} className="fleet-vehicle-icon" />
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
