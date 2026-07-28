import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useAuthStore } from "../store/authStore";
import KpiCard from "../components/common/KpiCard";
import TripStatusBadge from "../components/trips/TripStatusBadge";
import {
  TruckIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  GaugeIcon,
  CarIcon,
  UsersIcon,
  ActivityIcon,
  ChevronRightIcon,
} from "../components/common/Icons";
import useCssVars from "../hooks/useCssVars";
import { getTrips } from "../services/tripService";
import { getVehicles } from "../services/vehicleService";
import { getIncidents } from "../services/incidentService";
import { getDrivers } from "../services/driverService";

const ACTIVE_STATUSES = ["ASSIGNED", "STARTED", "EN_ROUTE", "ARRIVED"];
const CLOSED_STATUSES = ["DELIVERED", "CANCELLED"];

/* Tokens the charts need as concrete values — see useCssVars for why. */
const CHART_TOKENS = [
  "--success-500",
  "--warning-500",
  "--danger-500",
  "--color-primary",
  "--teal-500",
  "--color-text-3",
  "--color-border",
  "--color-border-strong",
];

const VEHICLE_STATUS_TOKEN = {
  AVAILABLE: "success-500",
  IN_USE: "color-primary",
  MAINTENANCE: "warning-500",
  DECOMMISSIONED: "color-text-3",
};

const AVATAR_PALETTE = [
  "var(--brand-600)",
  "var(--teal-500)",
  "#7c3aed",
  "var(--gold-600)",
  "var(--success-700)",
  "var(--info-700)",
];

function avatarColor(id) {
  return AVATAR_PALETTE[Number(id) % AVATAR_PALETTE.length];
}

function timeAgo(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function startOfDay(d) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Buckets real trips into one entry per day for the last `days` days.
 * Replaces the previous seeded placeholder series — every point here comes from
 * the trips payload, so an empty fleet correctly renders a flat zero line.
 */
function buildTrendFromTrips(trips, days = 7) {
  const buckets = [];
  const today = startOfDay(new Date());

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    buckets.push({
      key: day.getTime(),
      date: day.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      delivered: 0,
      cancelled: 0,
    });
  }

  const index = new Map(buckets.map((b) => [b.key, b]));

  trips.forEach((trip) => {
    if (!trip.createdAt) return;
    const bucket = index.get(startOfDay(new Date(trip.createdAt)).getTime());
    if (!bucket) return;
    if (trip.status === "DELIVERED") bucket.delivered++;
    else if (trip.status === "CANCELLED") bucket.cancelled++;
  });

  return buckets;
}

/** Percentage change of the last `days` vs the `days` immediately before. */
function periodTrend(trips, predicate, days = 7) {
  const today = startOfDay(new Date());
  const currentStart = new Date(today);
  currentStart.setDate(currentStart.getDate() - (days - 1));
  const priorStart = new Date(currentStart);
  priorStart.setDate(priorStart.getDate() - days);

  let current = 0;
  let prior = 0;

  trips.forEach((trip) => {
    if (!trip.createdAt || !predicate(trip)) return;
    const at = new Date(trip.createdAt);
    if (at >= currentStart) current++;
    else if (at >= priorStart) prior++;
  });

  if (prior === 0) {
    // No baseline to compare against — show movement, not a fake percentage.
    if (current === 0) return { direction: "flat", value: "No change" };
    return { direction: "up", value: `+${current} new` };
  }

  const delta = Math.round(((current - prior) / prior) * 100);
  if (delta === 0) return { direction: "flat", value: "0%" };
  return { direction: delta > 0 ? "up" : "down", value: `${delta > 0 ? "+" : ""}${delta}%` };
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="chart-tooltip-row">
          <span className="chart-tooltip-dot" style={{ background: entry.stroke || entry.fill }} />
          <span className="chart-tooltip-name">{entry.name}</span>
          <span className="chart-tooltip-value">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-row">
        <span className="chart-tooltip-dot" style={{ background: entry.payload.fill }} />
        <span className="chart-tooltip-name">{entry.name}</span>
        <span className="chart-tooltip-value">{entry.value}</span>
      </div>
    </div>
  );
}

function titleCase(value) {
  if (!value) return "";
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");
}

export default function DashboardPage() {
  const { role } = useAuthStore();
  const navigate = useNavigate();

  const [trips, setTrips] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  const c = useCssVars(CHART_TOKENS);

  useEffect(() => {
    // `alive` prevents state updates from a request that resolves after the
    // component unmounts (avoids React warnings and wasted renders on navigate-away).
    let alive = true;

    const load = () =>
      Promise.allSettled([getTrips(), getVehicles(), getIncidents(), getDrivers()]).then(
        ([tR, vR, iR, dR]) => {
          if (!alive) return;
          if (tR.status === "fulfilled" && Array.isArray(tR.value)) setTrips(tR.value);
          if (vR.status === "fulfilled" && Array.isArray(vR.value)) setVehicles(vR.value);
          if (iR.status === "fulfilled" && Array.isArray(iR.value)) setIncidents(iR.value);
          if (dR.status === "fulfilled" && Array.isArray(dR.value)) setDrivers(dR.value);
        }
      );

    setLoading(true);
    load().finally(() => {
      if (alive) setLoading(false);
    });
    const interval = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  const trendData = useMemo(() => buildTrendFromTrips(trips), [trips]);

  const activeTrips = trips.filter((t) => ACTIVE_STATUSES.includes(t.status)).length;
  const delivered = trips.filter((t) => t.status === "DELIVERED").length;
  const closedTrips = trips.filter((t) => CLOSED_STATUSES.includes(t.status)).length;
  const onTimeRate = closedTrips > 0 ? Math.round((delivered / closedTrips) * 100) : 0;
  const openIncidents = incidents.filter((i) => i.status === "OPEN").length;

  const availableVehicles = vehicles.filter((v) => v.status === "AVAILABLE").length;
  const inMaintenance = vehicles.filter((v) => v.status === "MAINTENANCE").length;
  const activeDrivers = drivers.filter((d) => d.active !== false).length;

  const deliveryTrend = useMemo(
    () => periodTrend(trips, (t) => t.status === "DELIVERED"),
    [trips]
  );
  const activeTrend = useMemo(
    () => periodTrend(trips, (t) => ACTIVE_STATUSES.includes(t.status)),
    [trips]
  );

  const deliverySpark = useMemo(() => trendData.map((d) => d.delivered), [trendData]);
  const activeSpark = useMemo(
    () => trendData.map((d) => d.delivered + d.cancelled),
    [trendData]
  );

  const vehicleBreakdown = useMemo(() => {
    const counts = {};
    vehicles.forEach((v) => {
      counts[v.status] = (counts[v.status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      fill: c[VEHICLE_STATUS_TOKEN[name]] || c["color-text-3"],
    }));
  }, [vehicles, c]);

  const leaderboard = useMemo(() => {
    const counts = {};
    trips.forEach((t) => {
      if (t.driverId) counts[t.driverId] = (counts[t.driverId] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([id, count]) => ({ driverId: Number(id), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [trips]);

  const recentTrips = useMemo(
    () =>
      [...trips]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 6),
    [trips]
  );

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const dash = "—";

  return (
    <div className="page-enter">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="dashboard-page-header">
        <div>
          <h1 className="dashboard-greeting">
            {greeting()},{" "}
            <span className="dashboard-greeting-role">
              {role ? titleCase(role) : "Admin"}
            </span>
          </h1>
          <p className="dashboard-date">{today}</p>
        </div>
        <div className="dashboard-live-chip" title="Data refreshes every 30 seconds">
          <span className="dashboard-live-dot" />
          Live · refreshes every 30s
        </div>
      </div>

      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className="stats-row stats-row-4">
        <KpiCard
          className="stagger-child"
          label="Active Trips"
          value={loading ? dash : activeTrips}
          sub="Currently en route"
          icon={TruckIcon}
          accent={c["color-primary"]}
          trend={loading ? undefined : activeTrend}
          spark={activeSpark}
          onClick={() => navigate("/trips")}
        />
        <KpiCard
          className="stagger-child"
          label="Deliveries"
          value={loading ? dash : delivered}
          sub="Completed all-time"
          icon={CheckCircleIcon}
          accent={c["success-500"]}
          trend={loading ? undefined : deliveryTrend}
          spark={deliverySpark}
          onClick={() => navigate("/trips")}
        />
        <KpiCard
          className="stagger-child"
          label="On-Time Rate"
          value={loading ? dash : `${onTimeRate}%`}
          sub={`${closedTrips} closed trips`}
          icon={GaugeIcon}
          accent={c["teal-500"]}
        />
        <KpiCard
          className="stagger-child"
          label="Open Incidents"
          value={loading ? dash : openIncidents}
          sub={openIncidents > 5 ? "Needs attention" : "Fleet running well"}
          icon={AlertTriangleIcon}
          accent={openIncidents > 5 ? c["danger-500"] : c["warning-500"]}
          onClick={() => navigate("/incidents")}
        />
      </div>

      {/* ── Secondary KPI row ───────────────────────────────────────────── */}
      <div className="stats-row stats-row-3">
        <KpiCard
          className="stagger-child"
          label="Vehicles Available"
          value={loading ? dash : availableVehicles}
          sub={`of ${vehicles.length} in fleet`}
          icon={CarIcon}
          accent={c["success-500"]}
          onClick={() => navigate("/vehicles")}
        />
        <KpiCard
          className="stagger-child"
          label="In Maintenance"
          value={loading ? dash : inMaintenance}
          sub={inMaintenance > 0 ? "Unavailable for dispatch" : "Nothing in the shop"}
          icon={ActivityIcon}
          accent={c["warning-500"]}
          onClick={() => navigate("/vehicles")}
        />
        <KpiCard
          className="stagger-child"
          label="Active Drivers"
          value={loading ? dash : activeDrivers}
          sub={`of ${drivers.length} registered`}
          icon={UsersIcon}
          accent={c["color-primary"]}
          onClick={() => navigate("/drivers")}
        />
      </div>

      {/* ── Charts row ──────────────────────────────────────────────────── */}
      <div className="dashboard-charts-row">
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">Delivery Performance</h3>
              <span className="chart-card-subtitle">Last 7 days · from trip records</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="gradDelivered" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c["success-500"]} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={c["success-500"]} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradCancelled" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c["warning-500"]} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={c["warning-500"]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c["color-border"]} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: c["color-text-3"] }}
                axisLine={false}
                tickLine={false}
                dy={6}
              />
              <YAxis
                tick={{ fontSize: 12, fill: c["color-text-3"] }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={48}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: c["color-border-strong"] }} />
              <Area
                type="monotone"
                name="Delivered"
                dataKey="delivered"
                stroke={c["success-500"]}
                strokeWidth={2.5}
                fill="url(#gradDelivered)"
                isAnimationActive
              />
              <Area
                type="monotone"
                name="Cancelled"
                dataKey="cancelled"
                stroke={c["warning-500"]}
                strokeWidth={2.5}
                fill="url(#gradCancelled)"
                isAnimationActive
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="chart-legend">
            <span className="chart-legend-item">
              <span className="chart-legend-dot" style={{ background: c["success-500"] }} />
              Delivered
            </span>
            <span className="chart-legend-item">
              <span className="chart-legend-dot" style={{ background: c["warning-500"] }} />
              Cancelled
            </span>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">Fleet Status</h3>
              <span className="chart-card-subtitle">{vehicles.length} vehicles</span>
            </div>
          </div>
          {vehicleBreakdown.length > 0 ? (
            <>
              <div className="donut-wrap">
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie
                      data={vehicleBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={84}
                      paddingAngle={2}
                      cornerRadius={4}
                      dataKey="value"
                      stroke="none"
                      isAnimationActive
                    >
                      {vehicleBreakdown.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <span className="donut-center-value">{vehicles.length}</span>
                  <span className="donut-center-label">Vehicles</span>
                </div>
              </div>
              <div className="pie-legend">
                {vehicleBreakdown.map((entry) => (
                  <div key={entry.name} className="pie-legend-item">
                    <span className="pie-legend-dot" style={{ background: entry.fill }} />
                    <span className="pie-legend-label">{titleCase(entry.name)}</span>
                    <span className="pie-legend-count">{entry.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="chart-empty">{loading ? "Loading…" : "No vehicle data"}</div>
          )}
        </div>
      </div>

      {/* ── Bottom row ──────────────────────────────────────────────────── */}
      <div className="dashboard-bottom-row">
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">Driver Leaderboard</h3>
              <span className="chart-card-subtitle">By total trips assigned</span>
            </div>
            <button
              className="chart-card-link"
              type="button"
              onClick={() => navigate("/drivers")}
              aria-label="View all drivers"
            >
              View all
              <ChevronRightIcon size={14} />
            </button>
          </div>
          {leaderboard.length > 0 ? (
            <div className="leaderboard-list">
              {leaderboard.map((item, idx) => (
                <div
                  key={item.driverId}
                  className="leaderboard-item"
                  onClick={() => navigate(`/drivers/${item.driverId}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") navigate(`/drivers/${item.driverId}`);
                  }}
                >
                  <div className={`leaderboard-rank${idx < 3 ? ` rank-${idx + 1}` : ""}`}>
                    {idx + 1}
                  </div>
                  <div
                    className="driver-avatar"
                    style={{ background: avatarColor(item.driverId), width: 34, height: 34, fontSize: 12 }}
                  >
                    #{item.driverId}
                  </div>
                  <div className="leaderboard-body">
                    <div className="leaderboard-name">Driver #{item.driverId}</div>
                    <div className="performance-bar-wrapper">
                      <div className="performance-bar-track">
                        <div
                          className="performance-bar-fill"
                          style={{
                            width: `${Math.round((item.count / (leaderboard[0]?.count || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="performance-bar-label">{item.count} trips</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="chart-empty">{loading ? "Loading…" : "No trip data yet"}</div>
          )}
        </div>

        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">Live Activity</h3>
              <span className="chart-card-subtitle">Most recent trip updates</span>
            </div>
            <button
              className="chart-card-link"
              type="button"
              onClick={() => navigate("/trips")}
              aria-label="View all trips"
            >
              View all
              <ChevronRightIcon size={14} />
            </button>
          </div>
          {recentTrips.length > 0 ? (
            <div className="recent-activity-list">
              {recentTrips.map((trip) => (
                <div
                  key={trip.id}
                  className="recent-activity-item"
                  onClick={() => navigate(`/trips/${trip.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") navigate(`/trips/${trip.id}`);
                  }}
                >
                  <div className="recent-activity-body">
                    <div className="recent-activity-top">
                      <TripStatusBadge status={trip.status} />
                      <span className="recent-activity-time">{timeAgo(trip.createdAt)}</span>
                    </div>
                    <div className="recent-activity-dest">
                      {trip.destination || `Trip #${trip.id}`}
                    </div>
                  </div>
                  <ChevronRightIcon size={16} className="recent-activity-chevron" />
                </div>
              ))}
            </div>
          ) : (
            <div className="chart-empty">{loading ? "Loading…" : "No recent trips"}</div>
          )}
        </div>
      </div>
    </div>
  );
}
