import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getDriverById, getDriverStats } from "../services/driverService";
import { getTrips } from "../services/tripService";
import { getVehicles } from "../services/vehicleService";
import DriverStatsCard from "../components/drivers/DriverStatsCard";
import TripStatusBadge from "../components/trips/TripStatusBadge";
import {
  ArrowLeftIcon,
  EmptyTruckIllustration,
  ShieldIcon,
  UsersIcon,
} from "../components/common/Icons";
import DataTable from "../components/common/DataTable";
import PageHeader from "../components/common/PageHeader";
import Badge from "../components/common/Badge";
import Button from "../components/common/Button";
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
      card: "title",
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
      card: "wide",
      render: (trip) => trip.destination || <span className="cell-muted">—</span>,
    },
    {
      key: "status",
      header: "Status",
      width: 130,
      sortable: true,
      card: "meta",
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
      <PageHeader
        title={driver.fullName}
        subtitle="Driver profile, performance and assigned trips"
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate("/drivers")}>
            <ArrowLeftIcon size={16} />
            Back to drivers
          </Button>
        }
      />

      {/* Identity band — avatar, name, status and contact in ONE block. These
          used to be split across a page header and a separate card, so nothing
          tied the initials to the person. */}
      <section className="driver-profile" aria-label="Driver profile">
        <div className="driver-profile-identity">
          <span
            className="driver-profile-avatar"
            style={{ background: getAvatarColor(driver.fullName) }}
            aria-hidden="true"
          >
            {getInitials(driver.fullName)}
          </span>
          <div className="driver-profile-headings">
            <h2 className="driver-profile-name" title={driver.fullName}>
              {driver.fullName}
            </h2>
            <div className="driver-profile-sub">
              <span className="driver-profile-id">Driver #{driver.id ?? id}</span>
              {/* `dot` so status is carried by shape as well as hue — the chip
                  must not depend on colour alone (CLAUDE.md, Accessibility). */}
              <Badge variant={driver.isActive ? "success" : "default"} dot>
                {driver.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="driver-profile-fields">
          <div className="driver-profile-field">
            <span className="driver-profile-field-icon">
              <UsersIcon size={16} />
            </span>
            <span className="driver-profile-field-text">
              <span className="driver-profile-field-label">Phone</span>
              <span className="driver-profile-field-value">{driver.phone || "—"}</span>
            </span>
          </div>
          <div className="driver-profile-field">
            <span className="driver-profile-field-icon">
              <ShieldIcon size={16} />
            </span>
            <span className="driver-profile-field-text">
              <span className="driver-profile-field-label">Licence</span>
              <span className="driver-profile-field-value">{driver.licenceNo || "—"}</span>
            </span>
          </div>
        </div>
        {/* Deliberately only contact facts here. A "Trips assigned" field sat in
            this strip briefly and had to go: it counts the client-filtered trip
            list, while the "Total trips" KPI below comes from the stats endpoint.
            They agree in normal use but can diverge (the list is capped at
            LIST_PAGE_SIZE, and stats can lag), and two similarly-named numbers
            disagreeing a few centimetres apart is worse than a sparser strip.
            Metrics belong in the KPI row; identity belongs here. */}
      </section>

      <DriverStatsCard stats={stats} />

      <section className="trip-detail-section">
        <div className="driver-section-head">
          <h2 className="driver-section-title">Trip history</h2>
          {trips.length > 0 && (
            <span className="driver-section-count">
              {trips.length} {trips.length === 1 ? "trip" : "trips"}
            </span>
          )}
        </div>
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
