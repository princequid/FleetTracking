import React, { useEffect, useState } from "react";
import { getAvailableVehicles } from "../services/vehicleService";

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    getAvailableVehicles()
      .then((data) => setVehicles(data || []))
      .catch(() => setError("Unable to load vehicle availability."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="page-shell">
      <div className="page-header">
        <h1>Vehicles</h1>
        <p>Available vehicles and assignment details.</p>
      </div>

      {loading ? (
        <div className="loading-text">Loading vehicles…</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : vehicles.length ? (
        <div className="trips-table-wrapper">
          <table className="trips-table">
            <thead>
              <tr>
                <th>Plate</th>
                <th>Model</th>
                <th>Status</th>
                <th>Assigned trip</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td>{vehicle.plate || vehicle.registration || vehicle.id}</td>
                  <td>{vehicle.model || vehicle.type || "—"}</td>
                  <td>{vehicle.status || "Available"}</td>
                  <td>{vehicle.assignedTripId || "None"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No available vehicles found.</p>
      )}
    </section>
  );
}

