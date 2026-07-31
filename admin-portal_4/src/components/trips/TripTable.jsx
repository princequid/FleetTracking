import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import TripStatusBadge from "./TripStatusBadge";
import DataTable from "../common/DataTable";
import Modal from "../common/Modal";
import Button from "../common/Button";
import BulkActionBar from "../common/BulkActionBar";
import { MoreVerticalIcon, ArrowRightIcon, XIcon, EmptyTruckIllustration } from "../common/Icons";
import { useToast } from "../common/Toast";
import { cancelTrip } from "../../services/tripService";
import { isTripCancellable, TRIP_STATUS_ORDER, getStatusLabel } from "../../constants/tripStatus";
import { formatDateTime, formatFull, timeUntil } from "../../utils/formatDate";
import { runBulk, describeBulkResult } from "../../utils/runBulk";

/**
 * Origin → destination on a single line.
 *
 * The list is for scanning, not for reading addresses: "Tema Harbour Industrial
 * Area → East Legon Warehouse Complex" wrapped to two lines and pushed every
 * row to ~78px, so a 900px viewport showed seven trips. Truncation is CSS
 * ellipsis rather than the old three-word JS chop, which cut names even when
 * the column had room to spare.
 *
 * The untruncated names are one hover away via `title`, and in full on the trip
 * detail page — which is where an operator goes when the address actually
 * matters.
 */
function RouteCell({ trip }) {
  const origin = trip.origin || "—";
  const destination = trip.destination || "—";

  return (
    <div className="route-cell" title={`${origin} → ${destination}`}>
      <span className="route-cell-line">{origin}</span>
      <span className="route-cell-arrow" aria-hidden="true">
        <ArrowRightIcon size={12} />
      </span>
      <span className="route-cell-line route-cell-dest">{destination}</span>
      {trip.stops?.length > 0 && (
        <span className="trip-table-stops-badge">
          {trip.stops.length} stop{trip.stops.length !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

/** ETA reads as a moment plus a distance from now — "5:09 AM · in 25m". */
function EtaCell({ trip }) {
  if (!trip.eta) return <span className="cell-muted">—</span>;
  const relative = timeUntil(trip.eta);
  const settled = trip.status === "DELIVERED" || trip.status === "CANCELLED";

  return (
    <span className="eta-cell" title={formatFull(trip.eta)}>
      <span className="eta-cell-time">{formatDateTime(trip.eta)}</span>
      {!settled && relative && (
        <span className={`eta-cell-rel${relative.overdue ? " eta-cell-rel-late" : ""}`}>
          {relative.label}
        </span>
      )}
    </span>
  );
}

export default function TripTable({
  trips,
  driversById,
  vehiclesById,
  loading,
  error,
  onRetry,
  onRefresh,
  onCreate,
  isFiltered,
  onClearFilters,
  sort,
  onSortChange,
  page,
  pageSize,
  onPageChange,
}) {
  const navigate = useNavigate();
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState(null); // { top, right } in viewport px
  const [cancelling, setCancelling] = useState(null);
  const [confirmTripId, setConfirmTripId] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null);
  const showToast = useToast();
  const menuRef = useRef(null);

  const tripsById = new Map(trips.map((trip) => [trip.id, trip]));
  const selectedTrips = [...selected].map((id) => tripsById.get(id)).filter(Boolean);

  // Selection must not survive a filter change: a trip selected under "En route"
  // and then filtered out is still in the Set, so the bulk bar would claim more
  // records than the operator can see — and act on them.
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => tripsById.has(id)));
      return next.size === prev.size ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trips]);

  async function handleBulkCancel() {
    setBulkConfirmOpen(false);
    const targets = selectedTrips.filter((trip) => isTripCancellable(trip.status));
    setBulkProgress({ done: 0, total: targets.length, label: "Cancelling" });

    const result = await runBulk(targets, (trip) => cancelTrip(trip.id), {
      onProgress: (done, total) => setBulkProgress({ done, total, label: "Cancelling" }),
    });

    setBulkProgress(null);
    setSelected(new Set());
    onRefresh?.();

    const { type, title, message } = describeBulkResult(result, {
      verb: "cancelled",
      noun: "trip",
      nounPlural: "trips",
    });
    showToast(type, title, message);
  }

  // Close menu on outside click — skips the kebab button itself (handled by toggleMenu)
  useEffect(() => {
    if (openMenuId === null) return;
    function onOutside(e) {
      if (e.target.closest(".trip-kebab-btn")) return;
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [openMenuId]);

  // Recalculate menu position on scroll so it follows the button
  useEffect(() => {
    if (openMenuId === null) return;
    function onScroll() {
      setOpenMenuId(null);
    }
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [openMenuId]);

  function toggleMenu(tripId, e) {
    e.stopPropagation();
    if (openMenuId === tripId) {
      setOpenMenuId(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setOpenMenuId(tripId);
  }

  // Opening the confirm dialog rather than cancelling on first click. The same
  // action on TripDetailPage is already guarded — this path was not, so one
  // mis-click permanently cancelled a live delivery and notified the driver.
  function requestCancel(tripId, e) {
    e.stopPropagation();
    setOpenMenuId(null);
    setConfirmTripId(tripId);
  }

  async function handleCancelConfirmed() {
    const tripId = confirmTripId;
    if (!tripId || cancelling) return;
    setCancelling(tripId);
    try {
      await cancelTrip(tripId);
      setConfirmTripId(null);
      onRefresh?.();
      showToast("success", "Trip cancelled", `Trip #${tripId} was cancelled and the driver notified.`);
    } catch {
      // A swallowed failure looked identical to success — the admin would
      // believe the trip was cancelled when it was not.
      showToast("error", "Cancel failed", "The trip was not cancelled. Please try again.");
    } finally {
      setCancelling(null);
    }
  }

  const columns = [
    {
      key: "id",
      header: "Trip",
      width: 86,
      sortable: true,
      numeric: true,
      render: (trip) => <span className="cell-id">#{trip.id}</span>,
    },
    {
      key: "driver",
      header: "Driver",
      // Declared, so Route becomes the only column absorbing leftover width
      // under `table-layout: fixed`. A name needs far less room than a route.
      width: 150,
      truncate: true,
      sortable: true,
      sortValue: (trip) => driversById[trip.driverId]?.fullName || "",
      render: (trip) => driversById[trip.driverId]?.fullName || `Driver #${trip.driverId}`,
    },
    {
      key: "vehicle",
      header: "Vehicle",
      width: 120,
      truncate: true,
      hideBelow: "lg",
      sortable: true,
      sortValue: (trip) => vehiclesById[trip.vehicleId]?.plateNumber || "",
      render: (trip) => (
        <span className="cell-mono">
          {vehiclesById[trip.vehicleId]?.plateNumber || `#${trip.vehicleId}`}
        </span>
      ),
    },
    {
      key: "route",
      header: "Route",
      truncate: true,
      render: (trip) => <RouteCell trip={trip} />,
    },
    {
      key: "status",
      header: "Status",
      width: 128,
      sortable: true,
      // Sort by lifecycle position, not alphabetically — "Arrived, Assigned,
      // Cancelled, Delivered" is an ordering of spellings, not of trips.
      sortValue: (trip) => TRIP_STATUS_ORDER.indexOf(trip.status),
      render: (trip) => <TripStatusBadge status={trip.status} />,
    },
    {
      key: "eta",
      header: "ETA",
      width: 146,
      align: "end",
      sortable: true,
      sortValue: (trip) => (trip.eta ? new Date(trip.eta).getTime() : 0),
      render: (trip) => <EtaCell trip={trip} />,
    },
    {
      key: "actions",
      header: "Actions",
      width: 100,
      align: "end",
      cellClassName: "trip-actions-td",
      render: (trip) => (
        <div className="cell-actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="trip-view-btn"
            type="button"
            onClick={() => navigate(`/trips/${trip.id}`)}
          >
            View
          </button>
          <button
            className={`trip-kebab-btn${openMenuId === trip.id ? " trip-kebab-btn-active" : ""}`}
            type="button"
            aria-label={`More options for trip #${trip.id}`}
            aria-expanded={openMenuId === trip.id}
            aria-haspopup="menu"
            onClick={(e) => toggleMenu(trip.id, e)}
          >
            <MoreVerticalIcon size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        label="Trips"
        caption="Trips with driver, vehicle, route, status and ETA"
        columns={columns}
        rows={trips}
        rowKey={(trip) => trip.id}
        loading={loading}
        error={error}
        onRetry={onRetry}
        density="compact"
        empty={
          isFiltered
            ? {
                variant: "filtered",
                title: "No trips match these filters",
                subtitle: "Try a different status, or clear the search to see everything.",
                action: onClearFilters
                  ? { label: "Clear filters", onClick: onClearFilters }
                  : undefined,
              }
            : {
                illustration: EmptyTruckIllustration,
                title: "No trips yet",
                subtitle: "Dispatched trips appear here with their driver, route and live status.",
                action: onCreate ? { label: "Create trip", onClick: onCreate } : undefined,
              }
        }
        onRowActivate={(trip) => navigate(`/trips/${trip.id}`)}
        rowLabel={(trip) => `View trip #${trip.id}`}
        sort={sort}
        onSortChange={onSortChange}
        page={page}
        pageSize={pageSize}
        onPageChange={onPageChange}
        selection={{
          selected,
          onChange: setSelected,
          // A delivered or already-cancelled trip cannot be cancelled, so its
          // checkbox is disabled rather than letting the operator select it and
          // then quietly dropping it from the batch.
          isSelectable: (trip) => isTripCancellable(trip.status),
          notSelectableReason: (trip) =>
            `Trip #${trip.id} is ${getStatusLabel(trip.status).toLowerCase()} and can no longer be cancelled`,
          rowLabel: (trip) => `trip #${trip.id}`,
        }}
      />

      <BulkActionBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        progress={bulkProgress}
        actions={[
          {
            label: `Cancel ${selected.size === 1 ? "trip" : "trips"}`,
            variant: "danger",
            icon: XIcon,
            onClick: () => setBulkConfirmOpen(true),
          },
        ]}
      />

      <Modal
        isOpen={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        title={`Cancel ${selected.size} ${selected.size === 1 ? "trip" : "trips"}?`}
        size="sm"
      >
        <p className="confirm-dialog-text">
          {selected.size === 1 ? "This trip" : `All ${selected.size} selected trips`} will be
          cancelled and {selected.size === 1 ? "its driver" : "their drivers"} notified. This cannot
          be undone.
        </p>
        {/* Honest about the mechanism: there is no batch endpoint behind this,
            so a partial failure is a real outcome the operator may have to
            reconcile. Saying so up front beats a surprise "3 of 12 failed". */}
        {selected.size > 1 && (
          <p className="confirm-dialog-note">
            Trips are cancelled one at a time. If any fail, the rest still go through and you'll be
            told which didn't.
          </p>
        )}
        <div className="confirm-dialog-actions">
          <Button variant="secondary" size="sm" onClick={() => setBulkConfirmOpen(false)}>
            Keep {selected.size === 1 ? "trip" : "trips"}
          </Button>
          <Button variant="danger" size="sm" onClick={handleBulkCancel}>
            Cancel {selected.size} {selected.size === 1 ? "trip" : "trips"}
          </Button>
        </div>
      </Modal>

      {/* Dropdown rendered via portal to escape overflow:hidden on the card */}
      {openMenuId !== null &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            className="trip-kebab-menu"
            style={{ position: "fixed", top: menuPos.top, right: menuPos.right }}
            role="menu"
          >
            <button
              className="trip-kebab-item"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/trips/${openMenuId}`);
              }}
            >
              View details
            </button>
            {isTripCancellable(trips.find((t) => t.id === openMenuId)?.status) && (
              <button
                className="trip-kebab-item trip-kebab-item-danger"
                role="menuitem"
                disabled={cancelling === openMenuId}
                onClick={(e) => requestCancel(openMenuId, e)}
              >
                Cancel trip
              </button>
            )}
          </div>,
          document.body,
        )}

      <Modal
        isOpen={confirmTripId !== null}
        onClose={() => setConfirmTripId(null)}
        title="Cancel this trip?"
        size="sm"
      >
        <p className="confirm-dialog-text">
          Trip #{confirmTripId} will be cancelled and the assigned driver will be notified. This
          action cannot be undone.
        </p>
        <div className="confirm-dialog-actions">
          <Button variant="secondary" size="sm" onClick={() => setConfirmTripId(null)} disabled={cancelling !== null}>
            Keep trip
          </Button>
          <Button variant="danger" size="sm" onClick={handleCancelConfirmed} loading={cancelling !== null}>
            Cancel trip
          </Button>
        </div>
      </Modal>
    </>
  );
}
