import React, { useEffect, useState } from "react";
import { getAvailableDrivers } from "../services/driverService";
import { getAvailableVehicles } from "../services/vehicleService";
import { createTrip } from "../services/tripService";

export default function DispatchPage() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAvailableDrivers(), getAvailableVehicles()])
      .then(([driverData, vehicleData]) => {
        setDrivers(driverData);
        setVehicles(vehicleData);
        setDriverId(driverData[0]?.id || "");
        setVehicleId(vehicleData[0]?.id || "");
      })
      .catch(() => setError("Unable to load drivers or vehicles"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess(null);

    try {
      const trip = await createTrip({
        origin,
        destination,
        driverId,
        vehicleId,
      });
      setSuccess(`Trip created with ID ${trip.id}`);
      setOrigin("");
      setDestination("");
    } catch (err) {
      setError("Failed to create trip. Please try again.");
    }
  }

  return (
    <section className="page-shell">
      <h1>Dispatch</h1>
      <form className="dispatch-form" onSubmit={handleSubmit}>
        <label>
          Origin
          <input
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="Enter origin"
            required
          />
        </label>
        <label>
          Destination
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Enter destination"
            required
          />
        </label>
        <label>
          Driver
          <select value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Vehicle
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.plate}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="primary-button" disabled={loading}>
          Create Trip
        </button>
      </form>
      {success && <div className="success-message">{success}</div>}
      {error && <div className="error-message">{error}</div>}
    </section>
  );
}
