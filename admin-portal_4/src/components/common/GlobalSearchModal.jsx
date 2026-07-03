import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "./Modal";
import { SearchIcon, TruckIcon, UsersIcon, CarIcon, AlertTriangleIcon } from "./Icons";
import { getTrips } from "../../services/tripService";
import { getDrivers } from "../../services/driverService";
import { getVehicles } from "../../services/vehicleService";
import { getIncidents } from "../../services/incidentService";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function formatStatus(value) {
  if (!value) return "—";
  return String(value).replace(/_/g, " ");
}

function resultKey(result) {
  return `${result.type}-${result.id}`;
}

function SearchResult({ result, onSelect }) {
  const Icon = result.icon;
  return (
    <button className="global-search-result" type="button" onClick={onSelect}>
      <span className="global-search-result-icon">
        <Icon size={16} />
      </span>
      <span className="global-search-result-body">
        <span className="global-search-result-title">{result.title}</span>
        <span className="global-search-result-subtitle">{result.subtitle}</span>
      </span>
      <span className="global-search-result-meta">{result.meta}</span>
    </button>
  );
}

export default function GlobalSearchModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState({ trips: [], drivers: [], vehicles: [], incidents: [] });

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setQuery("");
    setError("");
    setLoading(true);
    requestAnimationFrame(() => inputRef.current?.focus());

    Promise.allSettled([getTrips(), getDrivers(), getVehicles(), getIncidents()])
      .then(([trips, drivers, vehicles, incidents]) => {
        if (cancelled) return;

        setData({
          trips: trips.status === "fulfilled" && Array.isArray(trips.value) ? trips.value : [],
          drivers: drivers.status === "fulfilled" && Array.isArray(drivers.value) ? drivers.value : [],
          vehicles: vehicles.status === "fulfilled" && Array.isArray(vehicles.value) ? vehicles.value : [],
          incidents:
            incidents.status === "fulfilled" && Array.isArray(incidents.value)
              ? incidents.value
              : [],
        });

        const loadedSources = [trips, drivers, vehicles, incidents].some((entry) => entry.status === "fulfilled");
        setError(loadedSources ? "" : "Unable to load search data right now.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const results = useMemo(() => {
    const q = normalize(query);
    if (!q) return [];

    const tripResults = data.trips
      .filter((trip) => {
        const driver = data.drivers.find((item) => item.id === trip.driverId);
        const vehicle = data.vehicles.find((item) => item.id === trip.vehicleId);
        return [
          trip.id,
          trip.origin,
          trip.destination,
          trip.status,
          driver?.fullName,
          vehicle?.plateNumber,
          vehicle?.model,
        ].some((field) => normalize(field).includes(q));
      })
      .map((trip) => {
        const driver = data.drivers.find((item) => item.id === trip.driverId);
        return {
          type: "trip",
          id: trip.id,
          title: `Trip #${trip.id}`,
          subtitle: [trip.origin, trip.destination].filter(Boolean).join(" → ") || "Trip record",
          meta: [formatStatus(trip.status), driver?.fullName && `Driver: ${driver.fullName}`]
            .filter(Boolean)
            .join(" · ") || "Trip record",
          icon: TruckIcon,
          to: `/trips/${trip.id}`,
        };
      });

    const driverResults = data.drivers
      .filter((driver) =>
        [driver.id, driver.fullName, driver.licenceNo, driver.phone, driver.email].some((field) =>
          normalize(field).includes(q)
        )
      )
      .map((driver) => ({
        type: "driver",
        id: driver.id,
        title: driver.fullName || `Driver #${driver.id}`,
        subtitle: [driver.licenceNo && `Licence ${driver.licenceNo}`, driver.phone && driver.phone]
          .filter(Boolean)
          .join(" · ") || "Driver record",
        meta: driver.isActive ? "Active" : "Inactive",
        icon: UsersIcon,
        to: `/drivers/${driver.id}`,
      }));

    const vehicleResults = data.vehicles
      .filter((vehicle) =>
        [vehicle.id, vehicle.plateNumber, vehicle.model, vehicle.status, vehicle.capacity].some((field) =>
          normalize(field).includes(q)
        )
      )
      .map((vehicle) => ({
        type: "vehicle",
        id: vehicle.id,
        title: vehicle.plateNumber || `Vehicle #${vehicle.id}`,
        subtitle: vehicle.model || "Vehicle record",
        meta: [formatStatus(vehicle.status), vehicle.capacity != null ? `${vehicle.capacity} kg` : ""]
          .filter(Boolean)
          .join(" · ") || "Vehicle record",
        icon: CarIcon,
        to: "/vehicles",
      }));

    const incidentResults = data.incidents
      .filter((incident) =>
        [
          incident.id,
          incident.tripId,
          incident.driverId,
          incident.incidentType,
          incident.severity,
          incident.status,
          incident.description,
        ].some((field) => normalize(field).includes(q))
      )
      .map((incident) => ({
        type: "incident",
        id: incident.id,
        title: `Incident #${incident.id}`,
        subtitle: [incident.incidentType && formatStatus(incident.incidentType), incident.description]
          .filter(Boolean)
          .join(" · ") || "Incident record",
        meta: [formatStatus(incident.status), formatStatus(incident.severity)]
          .filter(Boolean)
          .join(" · ") || "Incident record",
        icon: AlertTriangleIcon,
        to: "/incidents",
      }));

    return [...tripResults, ...driverResults, ...vehicleResults, ...incidentResults].slice(0, 20);
  }, [data, query]);

  function handleSelect(result) {
    onClose();
    navigate(result.to);
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Search fleet data" size="lg">
      <div className="global-search">
        <div className="global-search-input-wrap">
          <SearchIcon size={16} className="global-search-input-icon" />
          <input
            ref={inputRef}
            className="global-search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search trips, drivers, vehicles, and incidents"
          />
        </div>

        <div className="global-search-summary">
          {loading
            ? "Loading data from trips, drivers, vehicles, and incidents..."
            : error || "Search uses live fleet data from the admin APIs."}
        </div>

        {query.trim() ? (
          results.length > 0 ? (
            <div className="global-search-results">
              {results.map((result) => (
                <SearchResult
                  key={resultKey(result)}
                  result={result}
                  onSelect={() => handleSelect(result)}
                />
              ))}
            </div>
          ) : (
            <div className="global-search-empty">No records match “{query.trim()}”.</div>
          )
        ) : (
          <div className="global-search-empty">
            Start typing to search real trip, driver, vehicle, and incident records.
          </div>
        )}
      </div>
    </Modal>
  );
}