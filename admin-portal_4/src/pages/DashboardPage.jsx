import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTrips } from "../services/tripService";
import { getAvailableDrivers } from "../services/driverService";
import { getAvailableVehicles } from "../services/vehicleService";

const statusLabels = {
  ASSIGNED: "Assigned",
  STARTED: "Started",
  ARRIVED: "Arrived",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export default function DashboardPage() {
  const [trips, setTrips] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setError("");

    Promise.allSettled([getTrips(), getAvailableDrivers(), getAvailableVehicles()]).then(
      ([tripsResult, driversResult, vehiclesResult]) => {
        const safeTrips =
          tripsResult.status === "fulfilled" && Array.isArray(tripsResult.value)
            ? tripsResult.value
            : [];
        const safeDrivers =
          driversResult.status === "fulfilled" && Array.isArray(driversResult.value)
            ? driversResult.value
            : [];
        const safeVehicles =
          vehiclesResult.status === "fulfilled" && Array.isArray(vehiclesResult.value)
            ? vehiclesResult.value
            : [];

        setTrips(safeTrips);
        setDrivers(safeDrivers);
        setVehicles(safeVehicles);

        if (
          tripsResult.status === "rejected" ||
          driversResult.status === "rejected" ||
          vehiclesResult.status === "rejected"
        ) {
          setError("Some dashboard data could not be loaded.");
        }
      }
    ).finally(() => setLoading(false));
  }, []);

  const safeTrips = Array.isArray(trips) ? trips : [];
  const statusCounts = useMemo(
    () =>
      safeTrips.reduce((acc, trip) => {
        const status = trip.status || "UNKNOWN";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {}),
    [safeTrips]
  );

  const recentTrips = useMemo(() => trips.slice(0, 5), [trips]);

  return (
    <section className="page-shell dashboard-shell">
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p>Track active trips, available drivers, and vehicle readiness from one place.</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-text">Loading dashboard…</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <>
          <div className="dashboard-grid">
            <div className="dashboard-card">
              <p className="card-label">Active trips</p>
              <p className="card-value">{trips.length}</p>
            </div>
            <div className="dashboard-card">
              <p className="card-label">Available drivers</p>
              <p className="card-value">{drivers.length}</p>
            </div>
            <div className="dashboard-card">
              <p className="card-label">Available vehicles</p>
              <p className="card-value">{vehicles.length}</p>
            </div>
          </div>

          <div className="dashboard-summary">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} className="dashboard-pill">
                <span>{statusLabels[status] || status}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>

          <div className="recent-section">
            <h2>Recent trips</h2>
            {recentTrips.length ? (
              <div className="trips-table-wrapper">
                <table className="trips-table">
                  <thead>
                    <tr>
                      <th>Trip</th>
                      <th>Driver</th>
                      <th>Vehicle</th>
                      <th>Status</th>
                      <th>Destination</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTrips.map((trip) => (
                      <tr key={trip.id} onClick={() => navigate(`/trips/${trip.id}`)}>
                        <td>{trip.id}</td>
                        <td>{trip.driver?.name || trip.driverId || "—"}</td>
                        <td>{trip.vehicle?.plate || trip.vehicleId || "—"}</td>
                        <td>{trip.status || "—"}</td>
                        <td>{trip.destination || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No recent trips available.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

