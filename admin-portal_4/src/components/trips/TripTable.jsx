import React from "react";
import { useNavigate } from "react-router-dom";
import TripStatusBadge from "./TripStatusBadge";
import LoadingTable from "../common/LoadingTable";
import { MoreVerticalIcon } from "../common/Icons";

const COLUMNS = ["Trip ID", "Driver", "Vehicle", "Origin", "Destination", "Status", "ETA", "Actions"];

export default function TripTable({ trips, driversById, vehiclesById, loading }) {
  const navigate = useNavigate();

  return (
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
              <td>{driversById[trip.driverId]?.fullName || `Driver #${trip.driverId}`}</td>
              <td>{vehiclesById[trip.vehicleId]?.plateNumber || `Vehicle #${trip.vehicleId}`}</td>
              <td>{trip.origin || "—"}</td>
              <td>{trip.destination || "—"}</td>
              <td>
                <TripStatusBadge status={trip.status} />
              </td>
              <td>{trip.eta ? new Date(trip.eta).toLocaleString() : "—"}</td>
              <td className="trip-actions-cell" onClick={(e) => e.stopPropagation()}>
                <button
                  className="trip-view-btn"
                  type="button"
                  onClick={() => navigate(`/trips/${trip.id}`)}
                >
                  View
                </button>
                <button className="trip-kebab-btn" type="button" aria-label="More options">
                  <MoreVerticalIcon size={16} />
                </button>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
