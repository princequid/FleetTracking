import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import TripTable from "../components/trips/TripTable";
import FilterTabs from "../components/common/FilterTabs";
import PageHeader from "../components/common/PageHeader";
import FilterBar from "../components/common/FilterBar";
import SearchBar from "../components/common/SearchBar";
import Button from "../components/common/Button";
import { peekTrips, getTrips } from "../services/tripService";
import { getDrivers } from "../services/driverService";
import { getVehicles } from "../services/vehicleService";
import { FILTER_TABS } from "../constants/tripStatus";
import { PlusCircleIcon } from "../components/common/Icons";

const PAGE_SIZE = 12;

const tabToStatus = (tab) => tab.toUpperCase().replace(/\s+/g, "_");

export default function TripsPage() {
  const navigate = useNavigate();
  // Seed from the cache synchronously so returning to this page paints the list on the
  // FIRST render instead of flashing a skeleton. Caching the fetch alone wasn't enough:
  // the cached promise resolves a microtask AFTER React has already painted the empty
  // state. `undefined` means a miss; `[]` is a real (empty) cached result.
  const [trips, setTrips] = useState(() => peekTrips() ?? []);
  const [driversById, setDriversById] = useState({});
  const [vehiclesById, setVehiclesById] = useState({});
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(null);
  const [loading, setLoading] = useState(() => peekTrips() === undefined);
  const [error, setError] = useState(null);

  const loadTrips = useCallback(() => {
    // Only show the skeleton when there is genuinely nothing to show. When cached data
    // is already on screen we revalidate silently in the background
    // (stale-while-revalidate). Flipping this on unconditionally is what still made
    // the page flash on return, even after the initial state was seeded from cache —
    // the mount effect calls this loader, which immediately overwrote that `false`.
    if (peekTrips() === undefined) setLoading(true);
    setError(null);
    Promise.all([getTrips(), getDrivers(), getVehicles()])
      .then(([tripData, driverData, vehicleData]) => {
        setTrips(tripData);
        setDriversById(Object.fromEntries(driverData.map((d) => [d.id, d])));
        setVehiclesById(Object.fromEntries(vehicleData.map((v) => [v.id, v])));
      })
      // An error object rather than a string, so the table can render a real
      // ErrorState instead of a red line of text above an empty table that
      // reads as "there are no trips".
      .catch(() =>
        setError({
          title: "Can't load trips",
          message:
            "The trip list is unavailable — this is a connection problem, not an empty fleet.",
        }),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  const counts = useMemo(() => {
    const base = { All: trips.length };
    trips.forEach((trip) => {
      const label = FILTER_TABS.find((tab) => tab !== "All" && tabToStatus(tab) === trip.status);
      if (label) base[label] = (base[label] || 0) + 1;
    });
    return base;
  }, [trips]);

  const filteredTrips = useMemo(() => {
    let result = filter === "All" ? trips : trips.filter((t) => t.status === tabToStatus(filter));
    const q = search.toLowerCase();
    if (q) {
      result = result.filter((t) => {
        const driver = driversById[t.driverId];
        const vehicle = vehiclesById[t.vehicleId];
        return (
          String(t.id).includes(q) ||
          t.origin?.toLowerCase().includes(q) ||
          t.destination?.toLowerCase().includes(q) ||
          driver?.fullName?.toLowerCase().includes(q) ||
          vehicle?.plateNumber?.toLowerCase().includes(q)
        );
      });
    }
    return result;
  }, [trips, filter, search, driversById, vehiclesById]);

  const isFiltered = filter !== "All" || search !== "";

  const activeFilters = [];
  if (filter !== "All") {
    activeFilters.push({
      key: "status",
      label: "Status",
      value: filter,
      onRemove: () => setFilter("All"),
    });
  }

  function clearFilters() {
    setFilter("All");
    setSearch("");
  }

  return (
    <div>
      <PageHeader
        title="Trips"
        subtitle="Track and manage all active and historical deliveries"
        actions={
          <Button variant="primary" onClick={() => navigate("/dispatch")}>
            <PlusCircleIcon size={16} />
            <span>New trip</span>
          </Button>
        }
      />

      <FilterBar
        search={
          <SearchBar
            label="Search trips"
            placeholder="Trip ID, route, driver, plate…"
            onChange={setSearch}
          />
        }
        filters={
          <FilterTabs tabs={FILTER_TABS} active={filter} counts={counts} onChange={setFilter} />
        }
        activeFilters={search ? [...activeFilters, { key: "q", label: "Search", value: `“${search}”`, onRemove: () => setSearch("") }] : activeFilters}
        onClearAll={isFiltered ? clearFilters : undefined}
        resultCount={loading ? undefined : filteredTrips.length}
        totalCount={trips.length}
      />

      <TripTable
        trips={filteredTrips}
        driversById={driversById}
        vehiclesById={vehiclesById}
        loading={loading}
        error={error}
        onRetry={loadTrips}
        onRefresh={loadTrips}
        onCreate={() => navigate("/dispatch")}
        isFiltered={isFiltered}
        onClearFilters={clearFilters}
        sort={sort}
        onSortChange={setSort}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  );
}
