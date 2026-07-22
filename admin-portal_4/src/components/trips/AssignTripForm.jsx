import { useEffect, useRef, useState } from "react";
import { getAvailableDrivers, getDrivers } from "../../services/driverService";
import { getAvailableVehicles, getVehicles } from "../../services/vehicleService";
import { createTrip } from "../../services/tripService";
import LocationAutocomplete from "./LocationAutocomplete";
import MapPickerModal from "../map/MapPickerModal";

const MAX_STOPS  = 7;
const DRAFT_KEY  = "fleet-dispatch-draft";

let _sid = 0;
const newStopId = () => `stop-${++_sid}`;

function getBrowserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
      ()    => resolve(null),
      { timeout: 6000 },
    );
  });
}

export default function AssignTripForm({ onDispatched, onError }) {
  const [origin,      setOrigin]      = useState({ name: "", lat: null, lng: null });
  const [destination, setDestination] = useState({ name: "", lat: null, lng: null });
  const [stops,       setStops]       = useState([]);
  const [description, setDescription] = useState("");

  const [driverId,       setDriverId]       = useState("");
  const [vehicleId,      setVehicleId]      = useState("");
  const [drivers,        setDrivers]        = useState([]);
  const [vehicles,       setVehicles]       = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting,     setSubmitting]     = useState(false);
  const [draftRestored,  setDraftRestored]  = useState(false);

  // { field: "origin"|"destination"|"stop", stopId?: string, center: [lat,lng]|null }
  const [mapPicker, setMapPicker] = useState(null);

  // Skip the first save effect so we don't immediately overwrite the draft we just loaded
  const skipSaveRef = useRef(true);

  useEffect(() => {
    setLoadingOptions(true);
    Promise.all([
      getAvailableDrivers().catch(() => getDrivers()),
      getAvailableVehicles().catch(() => getVehicles()),
    ])
      .then(([driverData, vehicleData]) => {
        setDrivers(Array.isArray(driverData) ? driverData : []);
        setVehicles(Array.isArray(vehicleData) ? vehicleData : []);
      })
      .catch(() => onError("Unable to load drivers or vehicles."))
      .finally(() => setLoadingOptions(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Restore draft on mount ───────────────────────────────────────────────────
  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) { skipSaveRef.current = false; return; }
    try {
      const d = JSON.parse(raw);
      if (d.origin)      setOrigin(d.origin);
      if (d.destination) setDestination(d.destination);
      if (Array.isArray(d.stops) && d.stops.length > 0) {
        // Re-assign fresh IDs so the counter stays consistent
        setStops(d.stops.map((s) => ({ ...s, id: newStopId() })));
      }
      if (d.driverId)    setDriverId(d.driverId);
      if (d.vehicleId)   setVehicleId(d.vehicleId);
      if (d.description) setDescription(d.description);
      setDraftRestored(true);
    } catch { /* corrupted draft — ignore */ }
    // Allow save effect to run on subsequent changes only
    skipSaveRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist draft on every change ───────────────────────────────────────────
  useEffect(() => {
    if (skipSaveRef.current) return;
    const isEmpty =
      !origin.name && !destination.name &&
      stops.length === 0 && !driverId && !vehicleId && !description;
    if (isEmpty) {
      localStorage.removeItem(DRAFT_KEY);
      setDraftRestored(false);
    } else {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ origin, destination, stops, driverId, vehicleId, description }));
    }
  }, [origin, destination, stops, driverId, vehicleId, description]);

  // ── Origin ───────────────────────────────────────────────────────────────────
  function handleOriginChange(text) {
    setOrigin({ name: text, lat: null, lng: null });
  }
  function handleOriginSelect({ name, lat, lng }) {
    setOrigin({ name, lat, lng });
  }
  async function openOriginMap() {
    // If an origin is already chosen (typed via autocomplete or a previous pin),
    // center on THAT — not the browser's current location, which used to override
    // it even when reopening the picker just to review/adjust an existing origin.
    const center = origin.lat != null ? [origin.lat, origin.lng] : await getBrowserLocation();
    const initialPin = origin.lat != null ? { lat: origin.lat, lng: origin.lng } : null;
    setMapPicker({ field: "origin", center, initialPin, initialAddress: origin.name });
  }

  // ── Destination ──────────────────────────────────────────────────────────────
  function handleDestinationChange(text) {
    setDestination({ name: text, lat: null, lng: null });
  }
  function handleDestinationSelect({ name, lat, lng }) {
    setDestination({ name, lat, lng });
  }
  function openDestinationMap() {
    const center = destination.lat != null ? [destination.lat, destination.lng] : null;
    const initialPin = destination.lat != null ? { lat: destination.lat, lng: destination.lng } : null;
    setMapPicker({ field: "destination", center, initialPin, initialAddress: destination.name });
  }

  // ── Stops ────────────────────────────────────────────────────────────────────
  function addStop() {
    if (stops.length >= MAX_STOPS) return;
    setStops((prev) => [...prev, { id: newStopId(), name: "", lat: null, lng: null, description: "" }]);
  }

  function removeStop(id) {
    setStops((prev) => prev.filter((s) => s.id !== id));
  }

  function handleStopChange(id, text) {
    setStops((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name: text, lat: null, lng: null } : s)),
    );
  }

  function handleStopSelect(id, { name, lat, lng }) {
    setStops((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name, lat, lng } : s)),
    );
  }

  function handleStopDescChange(id, text) {
    setStops((prev) =>
      prev.map((s) => (s.id === id ? { ...s, description: text } : s)),
    );
  }

  function openStopMap(id) {
    const stop = stops.find((s) => s.id === id);
    const center = stop?.lat != null ? [stop.lat, stop.lng] : null;
    const initialPin = stop?.lat != null ? { lat: stop.lat, lng: stop.lng } : null;
    setMapPicker({ field: "stop", stopId: id, center, initialPin, initialAddress: stop?.name });
  }

  // ── Map confirm ──────────────────────────────────────────────────────────────
  function handleMapConfirm({ name, lat, lng }) {
    if (mapPicker?.field === "origin") {
      setOrigin({ name, lat, lng });
    } else if (mapPicker?.field === "destination") {
      setDestination({ name, lat, lng });
    } else if (mapPicker?.field === "stop") {
      setStops((prev) =>
        prev.map((s) => (s.id === mapPicker.stopId ? { ...s, name, lat, lng } : s)),
      );
    }
    setMapPicker(null);
  }

  function discardDraft() {
    localStorage.removeItem(DRAFT_KEY);
    setOrigin({ name: "", lat: null, lng: null });
    setDestination({ name: "", lat: null, lng: null });
    setStops([]);
    setDriverId("");
    setVehicleId("");
    setDescription("");
    setDraftRestored(false);
  }

  function getModalTitle() {
    if (mapPicker?.field === "origin") return "Pin Origin Location";
    if (mapPicker?.field === "destination") return "Pin Destination Location";
    const idx = stops.findIndex((s) => s.id === mapPicker?.stopId);
    return `Pin Stop ${idx + 1} Location`;
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSubmit(event) {
    event.preventDefault();
    if (!driverId || !vehicleId) {
      onError("Please select a driver and a vehicle.");
      return;
    }
    if (!origin.name.trim()) {
      onError("Please enter or pin an origin location.");
      return;
    }
    if (!destination.name.trim()) {
      onError("Please enter or pin a destination location.");
      return;
    }

    const filledStops = stops.filter((s) => s.name.trim());

    setSubmitting(true);
    try {
      const trip = await createTrip({
        driverId:    Number(driverId),
        vehicleId:   Number(vehicleId),
        origin:      origin.name,
        destination: destination.name,
        ...(description.trim() && { description: description.trim() }),
        ...(origin.lat      != null && { originLat: origin.lat,      originLng: origin.lng }),
        ...(destination.lat != null && { destLat:   destination.lat, destLng:   destination.lng }),
        ...(filledStops.length > 0 && {
          stops: filledStops.map((s) => ({
            name: s.name,
            ...(s.description?.trim() && { description: s.description.trim() }),
            ...(s.lat != null && { lat: s.lat, lng: s.lng }),
          })),
        }),
      });
      localStorage.removeItem(DRAFT_KEY);
      onDispatched(trip);
      setOrigin({ name: "", lat: null, lng: null });
      setDestination({ name: "", lat: null, lng: null });
      setStops([]);
      setDriverId("");
      setVehicleId("");
      setDescription("");
      setDraftRestored(false);
    } catch (err) {
      onError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Failed to dispatch trip.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="dispatch-form-card">
        <h2 className="dispatch-form-title">Create New Trip</h2>

        {draftRestored && (
          <div className="dispatch-draft-banner">
            <span className="dispatch-draft-icon">💾</span>
            <span className="dispatch-draft-text">Draft restored from your last session.</span>
            <button type="button" className="dispatch-draft-discard" onClick={discardDraft}>
              Discard
            </button>
          </div>
        )}

        <form className="dispatch-form" onSubmit={handleSubmit}>

          {/* Origin */}
          <div className="dispatch-field">
            <label className="dispatch-label" htmlFor="dispatch-origin">
              Origin
            </label>
            <LocationAutocomplete
              id="dispatch-origin"
              value={origin.name}
              onChange={handleOriginChange}
              onSelect={handleOriginSelect}
              placeholder="Warehouse, depot, or address"
            />
            {origin.lat != null && (
              <span className="dispatch-coord-badge">
                📍 {origin.lat.toFixed(4)}, {origin.lng.toFixed(4)}
              </span>
            )}
            <button type="button" className="dispatch-pin-btn" onClick={openOriginMap}>
              <PinIcon />
              Pin on map (use my location)
            </button>
          </div>

          {/* Stops */}
          <div className="dispatch-stops-section">
            <div className="dispatch-stops-header">
              <span className="dispatch-stops-label">
                Stops
                <span className="dispatch-stops-optional">optional</span>
                {stops.length > 0 && (
                  <span className="dispatch-stops-count">
                    {stops.length} / {MAX_STOPS}
                  </span>
                )}
              </span>
              {stops.length < MAX_STOPS && (
                <button type="button" className="dispatch-add-stop-btn" onClick={addStop}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Add Stop
                </button>
              )}
            </div>

            {stops.length === 0 ? (
              <p className="dispatch-stops-empty">
                No stops added. Trip goes directly from origin to destination.
              </p>
            ) : (
              <ol className="dispatch-stop-list">
                {stops.map((stop, idx) => (
                  <li key={stop.id} className="dispatch-stop-row">
                    {/* Connector line (decorative, not on last item) */}
                    {idx < stops.length - 1 && (
                      <span className="dispatch-stop-connector" aria-hidden="true" />
                    )}

                    {/* Number badge */}
                    <span className="dispatch-stop-number">{idx + 1}</span>

                    {/* Input area */}
                    <div className="dispatch-stop-body">
                      <LocationAutocomplete
                        id={`dispatch-stop-${stop.id}`}
                        value={stop.name}
                        onChange={(text) => handleStopChange(stop.id, text)}
                        onSelect={(sel)  => handleStopSelect(stop.id, sel)}
                        placeholder={`Stop ${idx + 1} location`}
                      />
                      {stop.lat != null && (
                        <span className="dispatch-coord-badge">
                          📍 {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}
                        </span>
                      )}
                      <button
                        type="button"
                        className="dispatch-pin-btn"
                        onClick={() => openStopMap(stop.id)}
                      >
                        <PinIcon />
                        Pin on map
                      </button>
                      <input
                        type="text"
                        className="dispatch-input dispatch-stop-note"
                        value={stop.description || ""}
                        onChange={(e) => handleStopDescChange(stop.id, e.target.value)}
                        placeholder="Note for driver (optional) — e.g. deliver to gate B"
                      />
                    </div>

                    {/* Remove */}
                    <button
                      type="button"
                      className="dispatch-stop-remove"
                      onClick={() => removeStop(stop.id)}
                      aria-label={`Remove stop ${idx + 1}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ol>
            )}

            {stops.length === MAX_STOPS && (
              <p className="dispatch-stops-max-hint">
                Maximum of {MAX_STOPS} stops reached.
              </p>
            )}
          </div>

          {/* Destination */}
          <div className="dispatch-field">
            <label className="dispatch-label" htmlFor="dispatch-destination">
              Destination
            </label>
            <LocationAutocomplete
              id="dispatch-destination"
              value={destination.name}
              onChange={handleDestinationChange}
              onSelect={handleDestinationSelect}
              placeholder="Delivery address"
            />
            {destination.lat != null && (
              <span className="dispatch-coord-badge">
                📍 {destination.lat.toFixed(4)}, {destination.lng.toFixed(4)}
              </span>
            )}
            <button type="button" className="dispatch-pin-btn" onClick={openDestinationMap}>
              <PinIcon />
              Pin on map (near typed location)
            </button>
          </div>

          {/* Trip instructions / description */}
          <div className="dispatch-field">
            <label className="dispatch-label" htmlFor="dispatch-description">
              Trip instructions
              <span className="dispatch-stops-optional">optional</span>
            </label>
            <textarea
              id="dispatch-description"
              className="dispatch-input dispatch-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Notes for the driver — special handling, contact person, gate code, etc."
            />
          </div>

          {/* Driver */}
          <div className="dispatch-field">
            <label className="dispatch-label" htmlFor="dispatch-driver">Driver</label>
            {loadingOptions ? (
              <div className="dispatch-skeleton" />
            ) : drivers.length === 0 ? (
              <p className="dispatch-empty-text">No drivers available</p>
            ) : (
              <select
                id="dispatch-driver"
                className="dispatch-input"
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                required
              >
                <option value="" disabled>Select a driver</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName} — Lic. {d.licenceNo}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Vehicle */}
          <div className="dispatch-field">
            <label className="dispatch-label" htmlFor="dispatch-vehicle">Vehicle</label>
            {loadingOptions ? (
              <div className="dispatch-skeleton" />
            ) : vehicles.length === 0 ? (
              <p className="dispatch-empty-text">No vehicles available</p>
            ) : (
              <select
                id="dispatch-vehicle"
                className="dispatch-input"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                required
              >
                <option value="" disabled>Select a vehicle</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber} — {v.model} ({String(v.capacity)} cap.)
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            className="dispatch-submit-btn"
            type="submit"
            disabled={submitting || loadingOptions}
          >
            {submitting ? (
              <>
                <span className="btn-spinner" />
                <span>Dispatching…</span>
              </>
            ) : (
              "Create Trip"
            )}
          </button>
        </form>
      </div>

      <MapPickerModal
        isOpen={mapPicker !== null}
        title={getModalTitle()}
        initialCenter={mapPicker?.center}
        initialPin={mapPicker?.initialPin}
        initialAddress={mapPicker?.initialAddress}
        onClose={() => setMapPicker(null)}
        onConfirm={handleMapConfirm}
      />
    </>
  );
}

function PinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  );
}
