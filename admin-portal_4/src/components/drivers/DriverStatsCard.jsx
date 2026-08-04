import React from "react";
import KpiCard from "../common/KpiCard";
import { RouteIcon, CheckCircleIcon, GaugeIcon, ActivityIcon } from "../common/Icons";

/**
 * Driver metrics, bound strictly to what DriverStatsResponse actually returns:
 * { driverId, totalTrips, onTimeTrips, onTimePercent, rating }.
 *
 * `incidentCount` and `performanceScore` were read here once and do not exist on
 * the DTO — `grep -r performanceScore backend` returns nothing — so both tiles
 * rendered a hardcoded 0 that looked like a measurement.
 *
 * Null is also preserved rather than coerced. The backend comments that
 * onTimePercent is "null if the driver has no completed trips yet (no data, not
 * 0%)"; showing 0% for a new driver misrepresents them. Same for rating. KpiCard
 * passes a non-numeric value straight through without running its count-up, so
 * an em-dash renders correctly rather than animating from zero.
 *
 * These were four flat label/value pairs (`.driver-stat-box`) before — no icon,
 * no accent, every tile the same weight. KpiCard is the product's metric tile
 * (see CLAUDE.md), so the driver page now reads like the dashboard and reports.
 */
function formatPercent(value) {
  return value == null ? "—" : `${Math.round(value)}%`;
}

export default function DriverStatsCard({ stats }) {
  if (!stats) return null;

  const onTimePercent = stats.onTimePercent;
  const rating = stats.rating;

  return (
    <div className="driver-metrics">
      <KpiCard
        label="Total trips"
        value={stats.totalTrips ?? 0}
        icon={RouteIcon}
        accent="var(--color-primary)"
        sub="Assigned all-time"
      />
      <KpiCard
        label="On-time trips"
        value={stats.onTimeTrips ?? 0}
        icon={CheckCircleIcon}
        accent="var(--success-500)"
        sub="Delivered within ETA"
      />
      <KpiCard
        label="On-time rate"
        value={formatPercent(onTimePercent)}
        icon={GaugeIcon}
        accent="var(--info-500)"
        // The sub-line does the work an em-dash can't: it says *why* there is no
        // number, so a new driver doesn't look like a failing one.
        sub={onTimePercent == null ? "No completed trips yet" : "Of completed trips"}
      />
      <KpiCard
        label="Rating"
        value={rating == null ? "—" : Number(rating).toFixed(1)}
        icon={ActivityIcon}
        accent="var(--gold-500)"
        sub={rating == null ? "Not yet rated" : "Out of 5.0"}
      />
    </div>
  );
}
