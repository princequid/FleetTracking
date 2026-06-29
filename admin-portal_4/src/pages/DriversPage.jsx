import React, { useEffect, useState } from "react";
import { getAvailableDrivers } from "../services/driverService";

export default function DriversPage() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    getAvailableDrivers()
      .then((data) => setDrivers(data || []))
      .catch(() => setError("Unable to load driver availability."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="page-shell">
      <div className="page-header">
        <h1>Drivers</h1>
        <p>Available driver resources and status.</p>
      </div>

      {loading ? (
        <div className="loading-text">Loading drivers…</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : drivers.length ? (
        <div className="trips-table-wrapper">
          <table className="trips-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Assigned trip</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr key={driver.id}>
                  <td>{driver.name || driver.email || driver.id}</td>
                  <td>{driver.phone || "—"}</td>
                  <td>{driver.status || "Available"}</td>
                  <td>{driver.assignedTripId || "None"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No available drivers found.</p>
      )}
    </section>
  );
}

