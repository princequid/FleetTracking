import React from "react";

/**
 * Driver stats, bound strictly to what DriverStatsResponse actually returns:
 * { driverId, totalTrips, onTimeTrips, onTimePercent, rating }.
 *
 * `incidentCount` and `performanceScore` were read here and do not exist on the
 * DTO — `grep -r performanceScore backend` returns nothing — so both tiles
 * rendered a hardcoded 0 that looked like a measurement.
 *
 * Null is also preserved rather than coerced. The backend comments that
 * onTimePercent is "null if the driver has no completed trips yet (no data, not
 * 0%)"; showing 0% for a new driver misrepresents them.
 */
function formatPercent(value) {
  return value == null ? "—" : `${Math.round(value)}%`;
}

export default function DriverStatsCard({ stats }) {
  if (!stats) return null;

  return (
    <div className="trip-detail-card driver-stats-grid">
      <div className="driver-stat-box">
        <span className="driver-stat-value">{stats.totalTrips ?? 0}</span>
        <span className="driver-stat-label">Total Trips</span>
      </div>
      <div className="driver-stat-box">
        <span className="driver-stat-value">{stats.onTimeTrips ?? 0}</span>
        <span className="driver-stat-label">On-Time Trips</span>
      </div>
      <div className="driver-stat-box">
        <span className="driver-stat-value">{formatPercent(stats.onTimePercent)}</span>
        <span className="driver-stat-label">On-Time Rate</span>
      </div>
      <div className="driver-stat-box">
        <span className="driver-stat-value">
          {stats.rating == null ? "—" : Number(stats.rating).toFixed(1)}
        </span>
        <span className="driver-stat-label">Rating</span>
      </div>
    </div>
  );
}
