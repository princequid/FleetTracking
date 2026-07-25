import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import TripTable from "../components/trips/TripTable";
import FilterTabs from "../components/common/FilterTabs";
import { getTrips } from "../services/tripService";
import { getDrivers } from "../services/driverService";
import { getVehicles } from "../services/vehicleService";
import { FILTER_TABS } from "../constants/tripStatus";
import { EmptyTruckIllustration, SearchIcon } from "../components/common/Icons";

const PAGE_SIZE = 10;

export default function TripsPage() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [driversById, setDriversById] = useState({});
  const [vehiclesById, setVehiclesById] = useState({});
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  function loadTrips() {
    setLoading(true);
    setError("");
    Promise.all([getTrips(), getDrivers(), getVehicles()])
      .then(([tripData, driverData, vehicleData]) => {
        setTrips(tripData);
        setDriversById(Object.fromEntries(driverData.map((d) => [d.id, d])));
        setVehiclesById(Object.fromEntries(vehicleData.map((v) => [v.id, v])));
      })
      .catch(() => setError("Unable to load trips."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadTrips(); }, []);

  useEffect(() => {
    setPage(1);
  }, [filter, debouncedSearch]);

  const counts = useMemo(() => {
    const base = { All: trips.length };
    trips.forEach((trip) => {
      const label = FILTER_TABS.find((tab) => tab !== "All" && tab.toUpperCase() === trip.status);
      if (label) base[label] = (base[label] || 0) + 1;
    });
    return base;
  }, [trips]);

  const filteredTrips = useMemo(() => {
    let result = filter === "All" ? trips : trips.filter((t) => t.status === filter.toUpperCase());
    const q = debouncedSearch.trim().toLowerCase();
    if (q) {
      result = result.filter((t) => {
        const driver = driversById[t.driverId];
        return (
          String(t.id).includes(q) ||
          t.origin?.toLowerCase().includes(q) ||
          t.destination?.toLowerCase().includes(q) ||
          driver?.fullName?.toLowerCase().includes(q)
        );
      });
    }
    return result;
  }, [trips, filter, debouncedSearch, driversById]);

  const totalPages = Math.max(1, Math.ceil(filteredTrips.length / PAGE_SIZE));
  const pagedTrips = filteredTrips.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const isEmpty = !loading && trips.length === 0;

  return (
    <div>
      <div className="trips-header">
        <h1>Manage Trips</h1>
        <p className="trips-subtitle">Track and manage all active and historical deliveries</p>
      </div>

      <FilterTabs tabs={FILTER_TABS} active={filter} counts={counts} onChange={setFilter} />

      <div className="search-bar-wrapper">
        <SearchIcon size={16} className="search-bar-icon" />
        <input
          className="search-bar-input"
          placeholder="Search by trip ID, origin, destination, driver..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="trips-table-card">
        {isEmpty ? (
          <div className="trips-empty-state">
            <EmptyTruckIllustration className="trips-empty-icon" />
            <h2 className="trips-empty-title">No trips found</h2>
            <p className="trips-empty-subtitle">Create your first dispatch to get started</p>
            <button
              className="trips-empty-cta"
              type="button"
              onClick={() => navigate("/dispatch")}
            >
              Create Trip
            </button>
          </div>
        ) : (
          <>
            <TripTable
              trips={pagedTrips}
              driversById={driversById}
              vehiclesById={vehiclesById}
              loading={loading}
              onRefresh={loadTrips}
            />
            {!loading && (
              <div className="trips-pagination">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
