import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useAuthStore } from "../store/authStore";
import StatCard from "../components/common/StatCard";
import TripStatusBadge from "../components/trips/TripStatusBadge";
import {
  TruckIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  BarChartIcon,
} from "../components/common/Icons";
import { getTrips } from "../services/tripService";
import { getVehicles } from "../services/vehicleService";
import { getIncidents } from "../services/incidentService";

const PIE_COLORS = {
  AVAILABLE: "#059669",
  IN_USE: "#0D9488",
  MAINTENANCE: "#3B82F6",
  DECOMMISSIONED: "#6B7280",
};

const AVATAR_PALETTE = [
  "#1B3A6B",
  "#0D9488",
  "#7C3AED",
  "#B45309",
  "#047857",
  "#1D4ED8",
];

function avatarColor(id) {
  return AVATAR_PALETTE[Number(id) % AVATAR_PALETTE.length];
}

function timeAgo(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
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

// Deterministic 7-day delivery mock (seeded on calendar day so it's stable per day)
function buildDeliveryData() {
  const out = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const seed = d.getDate() + d.getMonth() * 31;
    out.push({ date: label, onTime: 5 + (seed % 7), late: 1 + (seed % 3) });
  }
  return out;
}

function AreaTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        padding: "10px 14px",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 12, color: "var(--color-text-3)", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: "#0D9488", marginBottom: 2 }}>
        On-time: {payload[0]?.value}
      </div>
      <div style={{ fontSize: 13, color: "#D97706" }}>Late: {payload[1]?.value}</div>
    </div>
  );
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        padding: "8px 12px",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600 }}>
        {payload[0].name}: {payload[0].value}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { role } = useAuthStore();
  const navigate = useNavigate();

  const [trips, setTrips] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  const deliveryData = useMemo(() => buildDeliveryData(), []);

  useEffect(() => {
    // `alive` prevents state updates from a request that resolves after the
    // component unmounts (avoids React warnings and wasted renders on navigate-away).
    let alive = true;

    const load = () =>
      Promise.allSettled([getTrips(), getVehicles(), getIncidents()]).then(
        ([tR, vR, iR]) => {
          if (!alive) return;
          if (tR.status === "fulfilled" && Array.isArray(tR.value)) setTrips(tR.value);
          if (vR.status === "fulfilled" && Array.isArray(vR.value)) setVehicles(vR.value);
          if (iR.status === "fulfilled" && Array.isArray(iR.value)) setIncidents(iR.value);
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

  const activeTrips = trips.filter((t) =>
    ["ASSIGNED", "STARTED", "EN_ROUTE", "ARRIVED"].includes(t.status)
  ).length;
  const deliveriesToday = trips.filter((t) => t.status === "DELIVERED").length;
  const openIncidents = incidents.filter((i) => i.status === "OPEN").length;
  const closedTrips = trips.filter((t) => ["DELIVERED", "CANCELLED"].includes(t.status)).length;
  const onTimeRate =
    closedTrips > 0 ? `${Math.round((deliveriesToday / closedTrips) * 100)}%` : "—";

  const vehicleBreakdown = useMemo(() => {
    const counts = {};
    vehicles.forEach((v) => {
      counts[v.status] = (counts[v.status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [vehicles]);

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

  const recentTrips = useMemo(() => trips.slice(0, 5), [trips]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="page-enter">
      {/* Page header */}
      <div className="dashboard-page-header">
        <div>
          <h1 className="dashboard-greeting">
            {greeting()},{" "}
            <span style={{ color: "var(--color-teal)" }}>
              {role ? role.charAt(0) + role.slice(1).toLowerCase().replace("_", " ") : "Admin"}
            </span>
          </h1>
          <p className="dashboard-date">{today}</p>
        </div>
      </div>

      {/* 4 stat cards */}
      <div className="stats-row stats-row-4">
        <StatCard
          className="stagger-child"
          title="Active Trips"
          value={loading ? "—" : activeTrips}
          subtitle="Currently en route"
          icon={TruckIcon}
          color="var(--color-navy)"
        />
        <StatCard
          className="stagger-child"
          title="Deliveries"
          value={loading ? "—" : deliveriesToday}
          subtitle="Total completed"
          icon={CheckCircleIcon}
          color="var(--color-success)"
        />
        <StatCard
          className="stagger-child"
          title="On-Time Rate"
          value={loading ? "—" : onTimeRate}
          subtitle="Fleet performance"
          icon={BarChartIcon}
          color="var(--color-teal)"
        />
        <StatCard
          className="stagger-child"
          title="Open Incidents"
          value={loading ? "—" : openIncidents}
          subtitle={openIncidents > 5 ? "Needs attention" : "Fleet running well"}
          icon={AlertTriangleIcon}
          color={openIncidents > 5 ? "var(--color-danger)" : "var(--color-warning)"}
        />
      </div>

      {/* Charts row — 60/40 */}
      <div className="dashboard-charts-row">
        {/* Delivery Performance */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">Delivery Performance</h3>
              <span className="chart-card-subtitle">Last 7 days</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart
              data={deliveryData}
              margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gradOnTime" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0D9488" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradLate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D97706" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#D97706" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: "#6B7280" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#6B7280" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<AreaTooltip />} />
              <Area
                type="monotone"
                dataKey="onTime"
                stroke="#0D9488"
                strokeWidth={2}
                fill="url(#gradOnTime)"
                isAnimationActive
              />
              <Area
                type="monotone"
                dataKey="late"
                stroke="#D97706"
                strokeWidth={2}
                fill="url(#gradLate)"
                isAnimationActive
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="chart-legend">
            <span className="chart-legend-item">
              <span className="chart-legend-dot" style={{ background: "#0D9488" }} />
              On-time
            </span>
            <span className="chart-legend-item">
              <span className="chart-legend-dot" style={{ background: "#D97706" }} />
              Late
            </span>
          </div>
        </div>

        {/* Fleet Status Donut */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">Fleet Status</h3>
              <span className="chart-card-subtitle">{vehicles.length} vehicles</span>
            </div>
          </div>
          {vehicleBreakdown.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={vehicleBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={70}
                    dataKey="value"
                    isAnimationActive
                  >
                    {vehicleBreakdown.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={PIE_COLORS[entry.name] || "#6B7280"}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pie-legend">
                {vehicleBreakdown.map((entry) => (
                  <div key={entry.name} className="pie-legend-item">
                    <span
                      className="pie-legend-dot"
                      style={{ background: PIE_COLORS[entry.name] || "#6B7280" }}
                    />
                    <span className="pie-legend-label">
                      {entry.name.charAt(0) + entry.name.slice(1).toLowerCase().replace("_", " ")}
                    </span>
                    <span className="pie-legend-count">{entry.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 180,
                color: "var(--color-text-3)",
                fontSize: 14,
              }}
            >
              {loading ? "Loading…" : "No vehicle data"}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row — 50/50 */}
      <div className="dashboard-bottom-row">
        {/* Driver Leaderboard */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">Driver Leaderboard</h3>
              <span className="chart-card-subtitle">By trip count</span>
            </div>
          </div>
          {leaderboard.length > 0 ? (
            <div className="leaderboard-list">
              {leaderboard.map((item, idx) => (
                <div key={item.driverId} className="leaderboard-item">
                  <div className={`leaderboard-rank${idx < 3 ? ` rank-${idx + 1}` : ""}`}>
                    {idx + 1}
                  </div>
                  <div
                    className="driver-avatar"
                    style={{
                      background: avatarColor(item.driverId),
                      width: 32,
                      height: 32,
                      fontSize: 12,
                    }}
                  >
                    #{item.driverId}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--color-text-1)",
                        marginBottom: 4,
                      }}
                    >
                      Driver #{item.driverId}
                    </div>
                    <div className="performance-bar-wrapper">
                      <div className="performance-bar-track">
                        <div
                          className="performance-bar-fill"
                          style={{
                            width: `${Math.round(
                              (item.count / (leaderboard[0]?.count || 1)) * 100
                            )}%`,
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
            <div
              style={{
                padding: "2rem",
                textAlign: "center",
                color: "var(--color-text-3)",
                fontSize: 14,
              }}
            >
              {loading ? "Loading…" : "No trip data yet"}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">Recent Activity</h3>
              <span className="chart-card-subtitle" style={{ fontSize: 11 }}>
                Refreshes every 30s
              </span>
            </div>
          </div>
          {recentTrips.length > 0 ? (
            <div className="recent-activity-list">
              {recentTrips.map((trip) => (
                <div
                  key={trip.id}
                  className="recent-activity-item"
                  onClick={() => navigate(`/trips/${trip.id}`)}
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
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: "2rem",
                textAlign: "center",
                color: "var(--color-text-3)",
                fontSize: 14,
              }}
            >
              {loading ? "Loading…" : "No recent trips"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
