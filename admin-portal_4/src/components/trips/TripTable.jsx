import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import TripStatusBadge from "./TripStatusBadge";
import LoadingTable from "../common/LoadingTable";
import { MoreVerticalIcon } from "../common/Icons";
import { cancelTrip } from "../../services/tripService";
import { isTripCancellable } from "../../constants/tripStatus";

const COLUMNS = ["Trip ID", "Driver", "Vehicle", "Origin", "Destination", "Status", "ETA", "Actions"];

function shortLocation(location) {
  if (!location) return "—";
  const words = location.trim().split(/\s+/);
  if (words.length <= 3) return location;
  return words.slice(0, 3).join(" ") + "…";
}

export default function TripTable({ trips, driversById, vehiclesById, loading, onRefresh }) {
  const navigate   = useNavigate();
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos,    setMenuPos]    = useState(null); // { top, right } in viewport px
  const [cancelling, setCancelling] = useState(null);
  const menuRef = useRef(null);

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
    function onScroll() { setOpenMenuId(null); }
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
    setMenuPos({
      top:   rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
    setOpenMenuId(tripId);
  }

  async function handleCancel(tripId, e) {
    e.stopPropagation();
    if (cancelling) return;
    setCancelling(tripId);
    try {
      await cancelTrip(tripId);
      setOpenMenuId(null);
      onRefresh?.();
    } catch {
      // leave menu open so user can retry
    } finally {
      setCancelling(null);
    }
  }

  return (
    <>
      <table className="trips-data-table">
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <LoadingTable columns={COLUMNS.length} rows={5} />
          ) : (
            trips.map((trip) => (
              <tr key={trip.id} onClick={() => navigate(`/trips/${trip.id}`)}>
                <td>#{trip.id}</td>
                <td>{driversById[trip.driverId]?.fullName     || `Driver #${trip.driverId}`}</td>
                <td>{vehiclesById[trip.vehicleId]?.plateNumber || `Vehicle #${trip.vehicleId}`}</td>
                <td title={trip.origin      || undefined}>{shortLocation(trip.origin)}</td>
                <td>
                  <span className="trip-table-dest-cell" title={trip.destination || undefined}>
                    {shortLocation(trip.destination)}
                    {trip.stops?.length > 0 && (
                      <span className="trip-table-stops-badge">
                        {trip.stops.length} stop{trip.stops.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </span>
                </td>
                <td><TripStatusBadge status={trip.status} /></td>
                <td>{trip.eta ? new Date(trip.eta).toLocaleString() : "—"}</td>

                <td className="trip-actions-td" onClick={(e) => e.stopPropagation()}>
                  <div className="trip-actions-cell">
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
                      aria-label="More options"
                      aria-expanded={openMenuId === trip.id}
                      onClick={(e) => toggleMenu(trip.id, e)}
                    >
                      <MoreVerticalIcon size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Dropdown rendered via portal to escape overflow:hidden on the card */}
      {openMenuId !== null && menuPos && createPortal(
        <div
          ref={menuRef}
          className="trip-kebab-menu"
          style={{ position: "fixed", top: menuPos.top, right: menuPos.right }}
          role="menu"
        >
          <button
            className="trip-kebab-item"
            role="menuitem"
            onClick={(e) => { e.stopPropagation(); navigate(`/trips/${openMenuId}`); }}
          >
            View Details
          </button>
          {isTripCancellable(trips.find((t) => t.id === openMenuId)?.status) && (
            <button
              className="trip-kebab-item trip-kebab-item-danger"
              role="menuitem"
              disabled={cancelling === openMenuId}
              onClick={(e) => handleCancel(openMenuId, e)}
            >
              {cancelling === openMenuId ? "Cancelling…" : "Cancel Trip"}
            </button>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
