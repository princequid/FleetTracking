import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTrips } from "../services/tripService";

const filterOptions = ["All", "Assigned", "Started", "Arrived", "Delivered", "Cancelled"];

export default function TripsPage() {
  const [trips, setTrips] = useState([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setError("");
    getTrips(filter)
      .then(setTrips)
      .catch(() => setError("Unable to load trips."))
      .finally(() => setLoading(false));
  }, [filter]);

  const rows = useMemo(() => trips, [trips]);

  return (
    <section className="page-shell">
      <h1>Trips</h1>
      <div className="trip-filters">
        {filterOptions.map((option) => (
          <button
            key={option}
            type="button"
            className={`filter-chip ${filter === option ? "active" : ""}`}
            onClick={() => setFilter(option)}
          >
            {option}
          </button>
        ))}
      </div>
      {error && <div className="error-message">{error}</div>}
      <div className="trips-table-wrapper">
        {loading ? (
          <div className="loading-text">Loading trips…</div>
        ) : (
          <table className="trips-table">
            <thead>
              <tr>
                <th>Trip ID</th>
                <th>Driver</th>
                <th>Vehicle</th>
                <th>Origin</th>
                <th>Destination</th>
                <th>Status</th>
                <th>ETA</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((trip) => (
                <tr key={trip.id} onClick={() => navigate(`/trips/${trip.id}`)}>
                  <td>{trip.id}</td>
                  <td>{trip.driver?.name || trip.driverId}</td>
                  <td>{trip.vehicle?.plate || trip.vehicleId}</td>
                  <td>{trip.origin}</td>
                  <td>{trip.destination}</td>
                  <td>{trip.status}</td>
                  <td>{trip.eta || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

