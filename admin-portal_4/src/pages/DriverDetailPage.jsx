import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getDriverById, getDriverStats } from "../services/driverService";
import { getTrips } from "../services/tripService";
import { getVehicles } from "../services/vehicleService";
import DriverStatsCard from "../components/drivers/DriverStatsCard";
import TripStatusBadge from "../components/trips/TripStatusBadge";
import { ArrowLeftIcon } from "../components/common/Icons";
import { getInitials, getAvatarColor } from "../constants/colors";

export default function DriverDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [driver, setDriver] = useState(null);
  const [stats, setStats] = useState(null);
  const [trips, setTrips] = useState([]);
  const [vehiclesById, setVehiclesById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    Promise.all([getDriverById(id), getDriverStats(id), getTrips(), getVehicles()])
      .then(([driverData, statsData, tripData, vehicleData]) => {
        if (cancelled) return;
        setDriver(driverData);
        setStats(statsData);
        setTrips(tripData.filter((trip) => trip.driverId === Number(id)));
        setVehiclesById(Object.fromEntries(vehicleData.map((vehicle) => [vehicle.id, vehicle])));
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load driver details.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <section className="page-shell">
        <p className="loading-text">Loading driver details…</p>
      </section>
    );
  }

  if (error || !driver) {
    return (
      <section className="page-shell">
        <p className="error-message">{error || "Driver not found."}</p>
      </section>
    );
  }

  return (
    <div>
      <div className="trip-detail-header">
        <button
          className="trip-back-btn"
          type="button"
          onClick={() => navigate("/drivers")}
          aria-label="Back to drivers"
        >
          <ArrowLeftIcon size={18} />
        </button>
        <h1 className="trip-detail-id">{driver.fullName}</h1>
      </div>

      <div className="trip-detail-card driver-info-card">
        <span
          className="driver-avatar driver-avatar-lg"
          style={{ background: getAvatarColor(driver.fullName) }}
        >
          {getInitials(driver.fullName)}
        </span>
        <div className="trip-detail-meta-grid">
          <div className="trip-meta-field">
            <span className="trip-meta-label">Phone</span>
            <span className="trip-meta-value">{driver.phone || "—"}</span>
          </div>
          <div className="trip-meta-field">
            <span className="trip-meta-label">Licence</span>
            <span className="trip-meta-value">{driver.licenceNo || "—"}</span>
          </div>
          <div className="trip-meta-field">
            <span className="trip-meta-label">Status</span>
            <span className="trip-meta-value">{driver.isActive ? "Active" : "Inactive"}</span>
          </div>
        </div>
      </div>

      <DriverStatsCard stats={stats} />

      <div className="trip-detail-card">
        <h2 className="trip-timeline-title">Trip History</h2>
        {trips.length === 0 ? (
          <p className="dispatch-empty-text">No trips yet.</p>
        ) : (
          <table className="trips-data-table">
            <thead>
              <tr>
                <th>Trip ID</th>
                <th>Vehicle</th>
                <th>Destination</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip) => (
                <tr key={trip.id} onClick={() => navigate(`/trips/${trip.id}`)}>
                  <td>#{trip.id}</td>
                  <td>{vehiclesById[trip.vehicleId]?.plateNumber || `Vehicle #${trip.vehicleId}`}</td>
                  <td>{trip.destination || "—"}</td>
                  <td>
                    <TripStatusBadge status={trip.status} />
                  </td>
                  <td>{trip.createdAt ? new Date(trip.createdAt).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
