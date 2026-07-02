import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getTripById, cancelTrip, getTripHistory } from "../services/tripService";
import { getDrivers } from "../services/driverService";
import { getVehicles } from "../services/vehicleService";
import { getTripPodStatus, getTripPhotos } from "../services/mediaService";
import { useAuthStore } from "../store/authStore";
import TripStatusBadge from "../components/trips/TripStatusBadge";
import TripTimeline from "../components/trips/TripTimeline";
import Modal from "../components/common/Modal";
import Button from "../components/common/Button";
import { ArrowLeftIcon } from "../components/common/Icons";

export default function TripDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.role);

  const [trip, setTrip] = useState(null);
  const [driver, setDriver] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [history, setHistory] = useState([]);
  const [podPhoto, setPodPhoto] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setPodPhoto(null);
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
          const podStatus = await getTripPodStatus(id);
          if (podStatus?.hasPOD) {
            const photos = await getTripPhotos(id);
            const pod = photos.find((p) => p.photoType === "POD");
            if (!cancelled) setPodPhoto(pod || null);
          }
        } catch {
          // POD lookup is best-effort
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
    (role === "ADMIN" || role === "SUPER_ADMIN") &&
    trip.status !== "CANCELLED" &&
    trip.status !== "DELIVERED";

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
              <span className="trip-meta-label">Origin</span>
              <span className="trip-meta-value">{trip.origin || "—"}</span>
            </div>
            <div className="trip-meta-field">
              <span className="trip-meta-label">Destination</span>
              <span className="trip-meta-value">{trip.destination || "—"}</span>
            </div>
            <div className="trip-meta-field">
              <span className="trip-meta-label">ETA</span>
              <span className="trip-meta-value">
                {trip.eta ? new Date(trip.eta).toLocaleString() : "—"}
              </span>
            </div>
            <div className="trip-meta-field">
              <span className="trip-meta-label">Created At</span>
              <span className="trip-meta-value">
                {trip.createdAt ? new Date(trip.createdAt).toLocaleString() : "—"}
              </span>
            </div>
          </div>
        </div>

        {podPhoto && (
          <div className="trip-pod-card">
            <span className="trip-pod-badge">Proof of Delivery</span>
            <img
              src={podPhoto.photoUrl}
              alt="Proof of delivery"
              className="trip-pod-image"
              onClick={() => setLightboxOpen(true)}
            />
          </div>
        )}
      </div>

      <div className="trip-detail-sidebar">
        <h2 className="trip-timeline-title">Status Timeline</h2>
        <TripTimeline history={history} driver={driver} />
      </div>

      {lightboxOpen && podPhoto && (
        <div className="lightbox-overlay" onClick={() => setLightboxOpen(false)}>
          <img src={podPhoto.photoUrl} alt="Proof of delivery enlarged" className="lightbox-image" />
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
