import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getTripById, cancelTrip, getTripHistory } from "../services/tripService";
import { getDrivers } from "../services/driverService";
import { getVehicles } from "../services/vehicleService";
import { getTripPhotos } from "../services/mediaService";
import { useAuthStore } from "../store/authStore";
import { isTripCancellable } from "../constants/tripStatus";
import TripStatusBadge from "../components/trips/TripStatusBadge";
import TripTimeline from "../components/trips/TripTimeline";
import TripRouteMap from "../components/map/TripRouteMap";
import Modal from "../components/common/Modal";
import Button from "../components/common/Button";
import { ArrowLeftIcon } from "../components/common/Icons";

// Delivery-photo types shown on the trip, in capture order. Incident/profile photos
// are intentionally excluded here — this section is about the delivery proof trail.
const PHOTO_META = {
  PRE_DISPATCH: { order: 1, label: "Pre-dispatch" },
  STOP_POD:     { order: 2, label: "Stop POD" },
  POD:          { order: 3, label: "Proof of delivery" },
};

function labelForPhoto(photo, trip) {
  if (photo.photoType === "STOP_POD") {
    const idx = trip?.stops?.findIndex((s) => s.id === photo.stopId);
    if (idx != null && idx >= 0) {
      const name = trip.stops[idx].name;
      return `Stop ${idx + 1}${name ? ` — ${name}` : ""}`;
    }
    return "Stop delivery";
  }
  return PHOTO_META[photo.photoType]?.label || "Photo";
}

function EtaField({ trip }) {
  const { status, eta } = trip;

  if (status === "ASSIGNED") {
    return (
      <span className="trip-eta-pending">
        Pending — trip not yet started
      </span>
    );
  }

  if (status === "STARTED" || status === "EN_ROUTE") {
    if (!eta) {
      return <span className="trip-eta-calculating">Calculating…</span>;
    }
    const etaDate = new Date(eta);
    const diffMs  = etaDate - Date.now();
    const diffMin = Math.round(diffMs / 60000);
    const timeStr = etaDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const label   = diffMin > 0 ? `in ${diffMin < 60 ? `${diffMin} min` : `${Math.floor(diffMin / 60)}h ${diffMin % 60}m`}` : "arriving now";
    return (
      <span className="trip-eta-live">
        {timeStr}
        <span className="trip-eta-relative">{label}</span>
      </span>
    );
  }

  if (status === "ARRIVED") {
    const when = trip.arrivedAt ? new Date(trip.arrivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
    return (
      <span className="trip-eta-arrived">
        Driver arrived{when ? ` at ${when}` : ""}
      </span>
    );
  }

  if (status === "DELIVERED") {
    const when = trip.completedAt ? new Date(trip.completedAt).toLocaleString() : null;
    return (
      <span className="trip-eta-done">
        Delivered{when ? ` · ${when}` : ""}
      </span>
    );
  }

  if (status === "CANCELLED") {
    return <span className="trip-eta-cancelled">Trip cancelled</span>;
  }

  // Fallback for any other status
  return (
    <span className="trip-meta-value">
      {eta ? new Date(eta).toLocaleString() : "—"}
    </span>
  );
}

function TripRouteNode({ dot, stopNumber, typeLabel, name, showLine }) {
  return (
    <div className="trip-route-node">
      <div className="trip-route-dot-col">
        <div className={`trip-route-dot trip-route-dot--${dot}`}>
          {dot === "stop" && <span>{stopNumber}</span>}
        </div>
        {showLine && <div className="trip-route-line" />}
      </div>
      <div className="trip-route-text">
        <span className="trip-route-type">{typeLabel}</span>
        <span className="trip-route-name">{name || "—"}</span>
      </div>
    </div>
  );
}

export default function TripDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.role);

  const [trip, setTrip] = useState(null);
  const [driver, setDriver] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [history, setHistory] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setPhotos([]);
    setHistory([]);

    getTripById(id)
      .then(async (tripData) => {
        if (cancelled) return;
        setTrip(tripData);

        const [drivers, vehicles] = await Promise.all([getDrivers(), getVehicles()]);
        if (cancelled) return;
        setDriver(drivers.find((d) => d.id === tripData.driverId) || null);
        setVehicle(vehicles.find((v) => v.id === tripData.vehicleId) || null);

        try {
          const historyData = await getTripHistory(id);
          if (!cancelled) setHistory(historyData);
        } catch {
          // history is best-effort
        }

        try {
          const photoData = await getTripPhotos(id);
          if (!cancelled) setPhotos(Array.isArray(photoData) ? photoData : []);
        } catch {
          // photos are best-effort
        }
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load trip details.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Re-pull the photo list whenever this tab regains focus. A dispatcher/admin often
  // keeps a trip's detail page open in one tab while the driver is out on the trip —
  // without this, newly-uploaded photos wouldn't appear until the page is reloaded.
  const refetchPhotos = useCallback(() => {
    getTripPhotos(id)
      .then((photoData) => setPhotos(Array.isArray(photoData) ? photoData : []))
      .catch(() => {
        // photos are best-effort
      });
  }, [id]);

  useEffect(() => {
    window.addEventListener("focus", refetchPhotos);
    return () => window.removeEventListener("focus", refetchPhotos);
  }, [refetchPhotos]);

  async function handleCancel() {
    setCancelConfirmOpen(false);
    setCancelling(true);
    try {
      const updated = await cancelTrip(id);
      setTrip(updated);
      try {
        setHistory(await getTripHistory(id));
      } catch {
        // history refresh is best-effort
      }
    } catch {
      setError("Failed to cancel trip.");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <section className="page-shell">
        <p className="loading-text">Loading trip details…</p>
      </section>
    );
  }

  if (error || !trip) {
    return (
      <section className="page-shell">
        <p className="error-message">{error || "Trip not found."}</p>
      </section>
    );
  }

  const canCancel =
    (role === "ADMIN" || role === "SUPER_ADMIN") && isTripCancellable(trip.status);

  // Delivery photos to show, ordered pre-dispatch → stop PODs → destination POD.
  const displayPhotos = photos
    .filter((p) => PHOTO_META[p.photoType])
    .sort((a, b) => PHOTO_META[a.photoType].order - PHOTO_META[b.photoType].order);


  return (
    <div className="trip-detail-layout">
      <div className="trip-detail-main">
        <div className="trip-detail-header">
          <button
            className="trip-back-btn"
            type="button"
            onClick={() => navigate("/trips")}
            aria-label="Back to trips"
          >
            <ArrowLeftIcon size={18} />
          </button>
          <h1 className="trip-detail-id">Trip #{trip.id}</h1>
          <TripStatusBadge status={trip.status} />
          <div className="trip-detail-header-actions">
            {canCancel && (
              <button
                className="trip-cancel-btn"
                type="button"
                onClick={() => setCancelConfirmOpen(true)}
                disabled={cancelling}
              >
                {cancelling ? "Cancelling..." : "Cancel Trip"}
              </button>
            )}
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="trip-detail-card">
          {/* ── Route ── */}
          <div className="trip-route-section">
            <span className="trip-route-heading">
              Route
              {trip.stops?.length > 0 && (
                <span className="trip-route-stop-count">
                  {trip.stops.length} stop{trip.stops.length !== 1 ? "s" : ""}
                </span>
              )}
            </span>

            <div className="trip-route-track">
              {/* Origin */}
              <TripRouteNode
                dot="origin"
                typeLabel="Origin"
                name={trip.origin}
                showLine
              />

              {/* Stops */}
              {trip.stops?.map((stop, idx) => (
                <TripRouteNode
                  key={idx}
                  dot="stop"
                  stopNumber={idx + 1}
                  typeLabel={`Stop ${idx + 1}`}
                  name={stop.name}
                  showLine
                />
              ))}

              {/* Destination */}
              <TripRouteNode
                dot="dest"
                typeLabel="Destination"
                name={trip.destination}
                showLine={false}
              />
            </div>

            <TripRouteMap trip={trip} />
          </div>

          {/* ── Meta grid (driver / vehicle / ETA / created) ── */}
          <div className="trip-detail-meta-grid">
            <div className="trip-meta-field">
              <span className="trip-meta-label">Driver</span>
              <span className="trip-meta-value">
                {driver?.fullName || `Driver #${trip.driverId}`}
              </span>
            </div>
            <div className="trip-meta-field">
              <span className="trip-meta-label">Vehicle</span>
              <span className="trip-meta-value">
                {vehicle?.plateNumber || `Vehicle #${trip.vehicleId}`}
              </span>
            </div>
            <div className="trip-meta-field">
              <span className="trip-meta-label">ETA</span>
              <EtaField trip={trip} />
            </div>
            <div className="trip-meta-field">
              <span className="trip-meta-label">Created At</span>
              <span className="trip-meta-value">
                {trip.createdAt ? new Date(trip.createdAt).toLocaleString() : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="trip-detail-sidebar">
        <h2 className="trip-timeline-title">Status Timeline</h2>
        <TripTimeline history={history} driver={driver} />

        {displayPhotos.length > 0 && (
          <div className="trip-pod-card">
            <span className="trip-pod-badge">Delivery photos</span>
            <div className="trip-photos-grid">
              {displayPhotos.map((photo) => (
                <figure
                  key={photo.id}
                  className="trip-photo-item"
                  onClick={() => setLightboxPhoto(photo)}
                  title="Click to enlarge"
                >
                  <img
                    src={photo.photoUrl}
                    alt={labelForPhoto(photo, trip)}
                    className="trip-photo-thumb"
                    loading="lazy"
                  />
                  <figcaption className="trip-photo-caption">
                    {labelForPhoto(photo, trip)}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}
      </div>

      {lightboxPhoto && (
        <div className="lightbox-overlay" onClick={() => setLightboxPhoto(null)}>
          <img
            src={lightboxPhoto.photoUrl}
            alt={labelForPhoto(lightboxPhoto, trip)}
            className="lightbox-image"
          />
        </div>
      )}

      <Modal
        isOpen={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        title="Cancel Trip"
        size="sm"
      >
        <p className="confirm-dialog-text">
          Cancel Trip #{trip?.id}? This action cannot be undone and the driver will be notified.
        </p>
        <div className="confirm-dialog-actions">
          <Button variant="ghost" onClick={() => setCancelConfirmOpen(false)}>
            Keep Trip
          </Button>
          <Button variant="danger" onClick={handleCancel}>
            Cancel Trip
          </Button>
        </div>
      </Modal>
    </div>
  );
}
