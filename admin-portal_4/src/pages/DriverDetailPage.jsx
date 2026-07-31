import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getDriverById, getDriverStats } from "../services/driverService";
import { getTrips } from "../services/tripService";
import { getVehicles } from "../services/vehicleService";
import DriverStatsCard from "../components/drivers/DriverStatsCard";
import TripStatusBadge from "../components/trips/TripStatusBadge";
import { ArrowLeftIcon, EmptyTruckIllustration } from "../components/common/Icons";
import DataTable from "../components/common/DataTable";
import { TRIP_STATUS_ORDER } from "../constants/tripStatus";
import { formatDate, formatFull } from "../utils/formatDate";
import { getInitials, getAvatarColor } from "../constants/colors";
import LoadingState from "../components/common/LoadingState";
import ErrorState from "../components/common/ErrorState";

export default function DriverDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [driver, setDriver] = useState(null);
  const [stats, setStats] = useState(null);
  const [trips, setTrips] = useState([]);
  const [vehiclesById, setVehiclesById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState({ key: "createdAt", dir: "desc" });

  const tripColumns = [
    {
      key: "id",
      header: "Trip",
      width: 90,
      numeric: true,
      sortable: true,
      render: (trip) => <span className="cell-id">#{trip.id}</span>,
    },
    {
      key: "vehicle",
      header: "Vehicle",
      width: 140,
      hideBelow: "md",
      render: (trip) => (
        <span className="cell-mono">
          {vehiclesById[trip.vehicleId]?.plateNumber || `#${trip.vehicleId}`}
        </span>
      ),
    },
    {
      key: "destination",
      header: "Destination",
      render: (trip) => trip.destination || <span className="cell-muted">—</span>,
    },
    {
      key: "status",
      header: "Status",
      width: 130,
      sortable: true,
      sortValue: (trip) => TRIP_STATUS_ORDER.indexOf(trip.status),
      render: (trip) => <TripStatusBadge status={trip.status} />,
    },
    {
      key: "createdAt",
      header: "Date",
      width: 120,
      align: "end",
      sortable: true,
      sortValue: (trip) => (trip.createdAt ? new Date(trip.createdAt).getTime() : 0),
      render: (trip) =>
        trip.createdAt ? (
          <span title={formatFull(trip.createdAt)}>{formatDate(trip.createdAt)}</span>
        ) : (
          <span className="cell-muted">—</span>
        ),
    },
  ];

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
        <LoadingState message="Loading driver details…" />
      </section>
    );
  }

  if (error || !driver) {
    return (
      <section className="page-shell">
        <ErrorState
          title={error ? "Can't load this driver" : "Driver not found"}
          message={
            error
              ? "The record is unavailable — this is a connection problem, not a deleted driver."
              : "This driver no longer exists, or you don't have access to it."
          }
          onRetry={error ? () => window.location.reload() : undefined}
        />
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

      <section className="trip-detail-section">
        <h2 className="section-title">Trip history</h2>
        <DataTable
          label="Trip history"
          caption={`Trips assigned to ${driver.fullName}`}
          columns={tripColumns}
          rows={trips}
          rowKey={(trip) => trip.id}
          density="compact"
          sort={sort}
          onSortChange={setSort}
          onRowActivate={(trip) => navigate(`/trips/${trip.id}`)}
          rowLabel={(trip) => `View trip #${trip.id}`}
          empty={{
            illustration: EmptyTruckIllustration,
            title: "No trips yet",
            subtitle: `${driver.fullName} hasn't been assigned a trip.`,
            action: { label: "Dispatch a trip", onClick: () => navigate("/dispatch") },
          }}
        />
      </section>
    </div>
  );
}
