import React, { useEffect, useState } from "react";
import { getAvailableDrivers, getDrivers } from "../../services/driverService";
import { getAvailableVehicles, getVehicles } from "../../services/vehicleService";
import { createTrip } from "../../services/tripService";

export default function AssignTripForm({ onDispatched, onError }) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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

  async function handleSubmit(event) {
    event.preventDefault();
    if (!driverId || !vehicleId) {
      onError("Please select a driver and a vehicle.");
      return;
    }

    setSubmitting(true);
    try {
      const trip = await createTrip({
        driverId: Number(driverId),
        vehicleId: Number(vehicleId),
        origin,
        destination,
      });
      onDispatched(trip);
      setOrigin("");
      setDestination("");
      setDriverId("");
      setVehicleId("");
    } catch (err) {
      onError(
        err.response?.data?.error || err.response?.data?.message || "Failed to dispatch trip."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dispatch-form-card">
      <h2 className="dispatch-form-title">Create New Trip</h2>
      <form className="dispatch-form" onSubmit={handleSubmit}>
        <div className="dispatch-field">
          <label className="dispatch-label" htmlFor="dispatch-origin">
            Origin
          </label>
          <input
            id="dispatch-origin"
            className="dispatch-input"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="Warehouse, depot, or address"
          />
          <a className="dispatch-pin-link" href="#pin-origin" onClick={(e) => e.preventDefault()}>
            Pin on map
          </a>
        </div>

        <div className="dispatch-field">
          <label className="dispatch-label" htmlFor="dispatch-destination">
            Destination
          </label>
          <input
            id="dispatch-destination"
            className="dispatch-input"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Delivery address"
          />
          <a
            className="dispatch-pin-link"
            href="#pin-destination"
            onClick={(e) => e.preventDefault()}
          >
            Pin on map
          </a>
        </div>

        <div className="dispatch-field">
          <label className="dispatch-label" htmlFor="dispatch-driver">
            Driver
          </label>
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
              <option value="" disabled>
                Select a driver
              </option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.fullName} — Lic. {driver.licenceNo}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="dispatch-field">
          <label className="dispatch-label" htmlFor="dispatch-vehicle">
            Vehicle
          </label>
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
              <option value="" disabled>
                Select a vehicle
              </option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.plateNumber} — {vehicle.model} ({String(vehicle.capacity)} cap.)
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
              <span>Dispatching...</span>
            </>
          ) : (
            "Create Trip"
          )}
        </button>
      </form>
    </div>
  );
}
