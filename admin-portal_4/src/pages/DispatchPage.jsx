import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AssignTripForm from "../components/trips/AssignTripForm";
import TripStatusBadge from "../components/trips/TripStatusBadge";
import { useToast } from "../components/common/Toast";
import { getTrips } from "../services/tripService";
import { getDrivers } from "../services/driverService";

export default function DispatchPage() {
  const navigate = useNavigate();
  const showToast = useToast();
  const [recentTrips, setRecentTrips] = useState([]);
  const [driversById, setDriversById] = useState({});

  const loadRecent = useCallback(() => {
    Promise.all([getTrips(), getDrivers()])
      .then(([trips, drivers]) => {
        setDriversById(Object.fromEntries(drivers.map((d) => [d.id, d])));
        const sorted = [...trips].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        setRecentTrips(sorted.slice(0, 5));
      })
      .catch(() => {
        // recent dispatches panel is best-effort
      });
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  function handleDispatched(trip) {
    showToast("success", "Trip Dispatched", `Trip #${trip.id} is on its way.`);
    loadRecent();
  }

  function handleError(message) {
    showToast("error", "Dispatch Failed", message);
  }

  return (
    <div className="dispatch-layout">
      <AssignTripForm onDispatched={handleDispatched} onError={handleError} />

      <div className="dispatch-recent-panel">
        <h2 className="dispatch-recent-title">Recent Dispatches</h2>
        {recentTrips.length === 0 ? (
          <p className="dispatch-empty-text">No dispatches yet.</p>
        ) : (
          <ul className="dispatch-recent-list">
            {recentTrips.map((trip) => (
              <li
                key={trip.id}
                className="dispatch-recent-item stagger-child"
                onClick={() => navigate(`/trips/${trip.id}`)}
              >
                <div className="dispatch-recent-row">
                  <TripStatusBadge status={trip.status} />
                  <span className="dispatch-recent-time">
                    {trip.createdAt ? new Date(trip.createdAt).toLocaleString() : "—"}
                  </span>
                </div>
                <div className="dispatch-recent-driver">
                  {driversById[trip.driverId]?.fullName || `Driver #${trip.driverId}`}
                </div>
                {/* Compact route line */}
                <div className="dispatch-recent-route">
                  <span className="dispatch-recent-origin">{trip.origin || "—"}</span>
                  {trip.stops?.length > 0 ? (
                    <span className="dispatch-recent-stops-pill">
                      {trip.stops.length} stop{trip.stops.length !== 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="dispatch-recent-arrow">→</span>
                  )}
                  <span className="dispatch-recent-destination">{trip.destination || "—"}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  );
}
