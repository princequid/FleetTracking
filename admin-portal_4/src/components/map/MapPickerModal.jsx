import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix broken default marker icons in Vite/Webpack builds
import markerIconPng    from "leaflet/dist/images/marker-icon.png";
import markerIconRetina from "leaflet/dist/images/marker-icon-2x.png";
import markerShadowPng  from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:       markerIconPng,
  iconRetinaUrl: markerIconRetina,
  shadowUrl:     markerShadowPng,
});

const PIN_ICON = new L.Icon({
  iconUrl:       markerIconPng,
  iconRetinaUrl: markerIconRetina,
  shadowUrl:     markerShadowPng,
  iconSize:      [25, 41],
  iconAnchor:    [12, 41],
  popupAnchor:   [1, -34],
  shadowSize:    [41, 41],
});

// Forces Leaflet to recalculate its size after the modal animates in
function MapAutoResize() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 300);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

// Registers click events on the map canvas
function ClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

// Nominatim reverse-geocode a {lat, lng} into a human-readable address string
async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
  const res  = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("reverse failed");
  const data = await res.json();
  return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export default function MapPickerModal({ isOpen, onClose, onConfirm, initialCenter, title }) {
  const [pin,            setPin]            = useState(null);
  const [address,        setAddress]        = useState("");
  const [loadingAddress, setLoadingAddress] = useState(false);

  // Reset state each time the modal opens
  useEffect(() => {
    if (isOpen) {
      setPin(null);
      setAddress("");
    }
  }, [isOpen]);

  // Accra, Ghana as global fallback
  const center = initialCenter ?? [5.6037, -0.1870];

  async function handleMapClick(latlng) {
    setPin(latlng);
    setAddress("");
    setLoadingAddress(true);
    try {
      const name = await reverseGeocode(latlng.lat, latlng.lng);
      setAddress(name);
    } catch {
      setAddress(`${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`);
    } finally {
      setLoadingAddress(false);
    }
  }

  function handleConfirm() {
    if (!pin) return;
    onConfirm({
      name: address || `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`,
      lat:  pin.lat,
      lng:  pin.lng,
    });
  }

  if (!isOpen) return null;

  return (
    <div
      className="map-modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="map-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="map-modal-header">
          <h3 className="map-modal-title">{title}</h3>
          <button
            className="map-modal-close"
            onClick={onClose}
            aria-label="Close map picker"
          >
            ✕
          </button>
        </div>

        {/* Hint */}
        <p className="map-modal-hint">
          Click anywhere on the map to drop a pin, then confirm your selection.
        </p>

        {/* Map */}
        <div className="map-modal-map">
          <MapContainer
            key={`${center[0]}-${center[1]}`}
            center={center}
            zoom={14}
            style={{ height: "100%", width: "100%" }}
            zoomControl={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              maxZoom={19}
            />
            <MapAutoResize />
            <ClickHandler onMapClick={handleMapClick} />
            {pin && <Marker position={pin} icon={PIN_ICON} />}
          </MapContainer>
        </div>

        {/* Footer */}
        <div className="map-modal-footer">
          {pin ? (
            <>
              <div className="map-modal-address">
                {loadingAddress ? (
                  <span className="map-modal-address-loading">
                    <span className="loc-spinner" />
                    Resolving address…
                  </span>
                ) : (
                  <span className="map-modal-address-text" title={address}>
                    📍 {address}
                  </span>
                )}
              </div>
              <button
                className="map-modal-confirm-btn"
                onClick={handleConfirm}
                disabled={loadingAddress}
              >
                {loadingAddress ? "Loading…" : "Confirm Location"}
              </button>
            </>
          ) : (
            <p className="map-modal-no-pin">
              No pin placed yet — click the map to select a location.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
