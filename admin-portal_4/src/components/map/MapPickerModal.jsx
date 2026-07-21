import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleMap, MarkerF, useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_MAPS_API_KEY } from "../../constants/config";
import { LIGHT_MAP_STYLE } from "./googleMapStyle";

const MAP_CONTAINER_STYLE = { height: "100%", width: "100%" };

// Nominatim reverse-geocode a {lat, lng} into a human-readable address string
async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
  const res  = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("reverse failed");
  const data = await res.json();
  return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export default function MapPickerModal({
  isOpen, onClose, onConfirm, initialCenter, initialPin, initialAddress, title,
}) {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const [pin,            setPin]            = useState(null);
  const [address,        setAddress]        = useState("");
  const [loadingAddress, setLoadingAddress] = useState(false);
  const mapRef = useRef(null);

  // Seed from the field's already-confirmed location (if any) each time the modal
  // opens, so re-opening the picker to review/adjust an existing origin, stop, or
  // destination shows that location pinned immediately — not a blank map that looks
  // like nothing was ever selected. A fresh field (no prior pin) still opens empty,
  // exactly as before.
  useEffect(() => {
    if (isOpen) {
      setPin(initialPin ?? null);
      setAddress(initialPin ? (initialAddress || `${initialPin.lat.toFixed(5)}, ${initialPin.lng.toFixed(5)}`) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Accra, Ghana as global fallback
  const center = initialCenter
    ? { lat: initialCenter[0], lng: initialCenter[1] }
    : { lat: 5.6037, lng: -0.187 };

  const handleMapLoad = useCallback((map) => {
    mapRef.current = map;
    // Google sizes the map from its container at load time — the modal animates in
    // after that, so force a resize + recenter once the animation settles (the same
    // fix the old Leaflet invalidateSize() call handled).
    const t = setTimeout(() => {
      window.google.maps.event.trigger(map, "resize");
      map.setCenter(center);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function handleMapClick(e) {
    const latlng = { lat: e.latLng.lat(), lng: e.latLng.lng() };
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
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              center={center}
              zoom={14}
              onLoad={handleMapLoad}
              onClick={handleMapClick}
              options={{
                styles: LIGHT_MAP_STYLE,
                disableDefaultUI: true,
                zoomControl: true,
                clickableIcons: false,
              }}
            >
              {pin && <MarkerF position={pin} />}
            </GoogleMap>
          ) : (
            <div className="trip-route-map trip-route-map--loading">
              <span className="loc-spinner" />
              <span>Loading map…</span>
            </div>
          )}
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
