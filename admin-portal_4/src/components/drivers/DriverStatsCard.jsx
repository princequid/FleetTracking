import React from "react";

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
        <span className="driver-stat-value">{stats.incidentCount ?? 0}</span>
        <span className="driver-stat-label">Incidents</span>
      </div>
      <div className="driver-stat-box">
        <span className="driver-stat-value">{stats.performanceScore ?? 0}%</span>
        <span className="driver-stat-label">Performance Score</span>
      </div>
    </div>
  );
}
