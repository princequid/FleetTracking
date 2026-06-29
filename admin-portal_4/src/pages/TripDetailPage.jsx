import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getTripById } from "../services/tripService";

const statusColor = {
  ASSIGNED: "var(--color-blue)",
  STARTED: "var(--color-orange)",
  ARRIVED: "var(--color-yellow)",
  DELIVERED: "var(--color-green)",
  CANCELLED: "var(--color-red)",
};

export default function TripDetailPage() {
  const { id } = useParams();
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getTripById(id)
      .then((data) => setTrip(data))
      .catch(() => setError("Unable to load trip details."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <section className="page-shell">
        <h1>Trip detail</h1>
        <p>Loading trip details…</p>
      </section>
    );
  }

  if (error || !trip) {
    return (
      <section className="page-shell">
        <h1>Trip detail</h1>
        <p className="error-message">{error || "Trip not found."}</p>
      </section>
    );
  }

  return (
    <section className="page-shell">
      <div className="trip-detail-header">
        <h1>Trip {trip.id}</h1>
        <span
          className="status-badge"
          style={{ background: statusColor[trip.status] || "var(--color-muted)" }}
        >
          {trip.status}
        </span>
      </div>
      <div className="trip-detail-grid">
        <div>
          <strong>Origin</strong>
          <p>{trip.origin}</p>
        </div>
        <div>
          <strong>Destination</strong>
          <p>{trip.destination}</p>
        </div>
        <div>
          <strong>Driver</strong>
          <p>{trip.driver?.name || trip.driverId}</p>
        </div>
        <div>
          <strong>Vehicle</strong>
          <p>{trip.vehicle?.plate || trip.vehicleId}</p>
        </div>
        <div>
          <strong>ETA</strong>
          <p>{trip.eta || "—"}</p>
        </div>
      </div>
      <div className="trip-history">
        <h2>Status history</h2>
        {trip.statusHistory?.length ? (
          <ol className="status-timeline">
            {trip.statusHistory.map((item) => (
              <li key={item.timestamp}>
                <span className="status-time">{new Date(item.timestamp).toLocaleString()}</span>
                <span>{item.status}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p>No status history available.</p>
        )}
      </div>
      {trip.hasPOD && trip.podPhotoUrl ? (
        <div className="pod-photo">
          <h2>Proof of Delivery</h2>
          <img src={trip.podPhotoUrl} alt="Proof of delivery" />
        </div>
      ) : null}
    </section>
  );
}

