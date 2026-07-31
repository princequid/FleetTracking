import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import KpiCard from "../components/common/KpiCard";
import ErrorState from "../components/common/ErrorState";
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
  EmptyVehiclesIllustration,
  EmptyDriversIllustration,
  EmptyTruckIllustration,
} from "../components/common/Icons";
import useCssVars from "../hooks/useCssVars";
import PageHeader from "../components/common/PageHeader";
import StatStrip from "../components/common/StatStrip";
import ChartSkeleton from "../components/common/ChartSkeleton";
import EmptyState from "../components/common/EmptyState";

/* Recharts is the largest asset in the build and the dashboard is the landing
   route, so the charts load after the tiles rather than in front of them. */
const DeliveryTrendChart = lazy(() => import("../components/dashboard/DeliveryTrendChart"));
const FleetStatusDonut = lazy(() => import("../components/dashboard/FleetStatusDonut"));
import { getAvatarColor, getAvatarColorById, getInitials } from "../constants/colors";
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

/**
 * Daily incident counts for the same window as the trip trend.
 *
 * Exists so the Open Incidents tile can carry a real sparkline rather than
 * being the one card in the row without one. Derived from the incidents payload
 * the page already fetches — no invented series.
 */
function buildIncidentTrend(incidents, days = 7) {
  const today = startOfDay(new Date());
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    buckets.push({ key: day.getTime(), count: 0 });
  }
  const index = new Map(buckets.map((b) => [b.key, b]));

  incidents.forEach((incident) => {
    if (!incident.createdAt) return;
    const bucket = index.get(startOfDay(new Date(incident.createdAt)).getTime());
    if (bucket) bucket.count++;
  });

  return buckets.map((b) => b.count);
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
  const [failed, setFailed] = useState(false);

  const c = useCssVars(CHART_TOKENS);

  // Hoisted so the retry button and the visibility listener can both call it.
  const load = useCallback(
    (aliveRef) =>
      Promise.allSettled([getTrips(), getVehicles(), getIncidents(), getDrivers()]).then(
        (results) => {
          if (aliveRef && !aliveRef.current) return;
          const [tR, vR, iR, dR] = results;
          if (tR.status === "fulfilled" && Array.isArray(tR.value)) setTrips(tR.value);
          if (vR.status === "fulfilled" && Array.isArray(vR.value)) setVehicles(vR.value);
          if (iR.status === "fulfilled" && Array.isArray(iR.value)) setIncidents(iR.value);
          if (dR.status === "fulfilled" && Array.isArray(dR.value)) setDrivers(dR.value);
          // Every request rejected — the API is unreachable. Surfacing this is
          // essential: without it the page renders "0 open incidents / fleet
          // running well", which asserts the fleet is healthy during an outage.
          setFailed(results.every((r) => r.status === "rejected"));
        }
      ),
    []
  );

  useEffect(() => {
    // `alive` prevents state updates from a request that resolves after the
    // component unmounts (avoids React warnings and wasted renders on navigate-away).
    const alive = { current: true };

    setLoading(true);
    load(alive).finally(() => {
      if (alive.current) setLoading(false);
    });

    // Don't poll a hidden tab — this fired 480 requests/hour per background tab.
    const tick = () => {
      if (!document.hidden) load(alive);
    };
    const interval = setInterval(tick, 30000);
    document.addEventListener("visibilitychange", tick);

    return () => {
      alive.current = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

  const trendData = useMemo(() => buildTrendFromTrips(trips), [trips]);

  const activeTrips = trips.filter((t) => ACTIVE_STATUSES.includes(t.status)).length;
  const delivered = trips.filter((t) => t.status === "DELIVERED").length;
  const closedTrips = trips.filter((t) => CLOSED_STATUSES.includes(t.status)).length;
  const onTimeRate = closedTrips > 0 ? Math.round((delivered / closedTrips) * 100) : 0;
  const openIncidents = incidents.filter((i) => i.status === "OPEN").length;

  const availableVehicles = vehicles.filter((v) => v.status === "AVAILABLE").length;
  const inMaintenance = vehicles.filter((v) => v.status === "MAINTENANCE").length;
  // DriverProfileResponse declares `Boolean isActive`, so Lombok emits
  // getIsActive() and Jackson serialises the key as `isActive`. Reading `d.active`
  // was always undefined, and `undefined !== false` is true — every driver counted
  // as active regardless of status.
  const activeDrivers = drivers.filter((d) => Boolean(d.isActive)).length;

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
  // Daily completion rate, so the On-Time tile gets a real series too. Days with
  // nothing closed contribute 0 rather than being dropped — a gap in the line
  // would imply missing data instead of a quiet day.
  const onTimeSpark = useMemo(
    () =>
      trendData.map((d) => {
        const closed = d.delivered + d.cancelled;
        return closed > 0 ? Math.round((d.delivered / closed) * 100) : 0;
      }),
    [trendData]
  );
  const incidentSpark = useMemo(() => buildIncidentTrend(incidents), [incidents]);

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
    // The page already fetches the driver roster for the "Active Drivers" tile,
    // so rendering "Driver #3" here was throwing away a name we were holding.
    // A leaderboard of opaque ids is not something an operator can act on.
    const byId = new Map(drivers.map((d) => [d.id, d]));
    return Object.entries(counts)
      .map(([id, count]) => ({
        driverId: Number(id),
        count,
        name: byId.get(Number(id))?.fullName || `Driver #${id}`,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [trips, drivers]);

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
    <div>
      {/* Greeting demoted to the supporting line. It was rendering at 30px as
          the largest element on the page — above every KPI — which made the
          most prominent thing on an operations dashboard the time of day. */}
      <PageHeader
        title="Dashboard"
        subtitle={`${greeting()}, ${role ? titleCase(role) : "Admin"} · ${today}`}
        meta={
          <div className="dashboard-live-chip" title="Data refreshes every 30 seconds">
            <span className="dashboard-live-dot" />
            Live · 30s
          </div>
        }
      />

      {failed && (
        <div style={{ marginBottom: "var(--space-6)" }}>
          <ErrorState
            title="Can't reach the fleet API"
            message="The figures below are unavailable, not zero. Nothing here reflects current fleet status."
            onRetry={() => {
              setLoading(true);
              load().finally(() => setLoading(false));
            }}
          />
        </div>
      )}

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
          spark={onTimeSpark}
        />
        <KpiCard
          className="stagger-child"
          label="Open Incidents"
          value={loading ? dash : openIncidents}
          sub={openIncidents > 5 ? "Needs attention" : "Fleet running well"}
          icon={AlertTriangleIcon}
          accent={openIncidents > 5 ? c["danger-500"] : c["warning-500"]}
          spark={incidentSpark}
          onClick={() => navigate("/incidents")}
        />
      </div>

      {/* Level 2. Fleet composition matters, but not as much as the four tiles
          above — so it is a band, not another row of equal-weight cards. The
          previous 4-then-3 grid made these render *wider* than the primary KPIs. */}
      <StatStrip
        label="Fleet availability"
        items={[
          {
            label: "Vehicles available",
            value: loading ? dash : availableVehicles,
            sub: vehicles.length ? `of ${vehicles.length}` : null,
            icon: CarIcon,
            accent: c["success-500"],
            onClick: () => navigate("/vehicles"),
          },
          {
            label: "In maintenance",
            value: loading ? dash : inMaintenance,
            sub: inMaintenance > 0 ? "unavailable" : null,
            icon: ActivityIcon,
            accent: c["warning-500"],
            onClick: () => navigate("/vehicles"),
          },
          {
            label: "Active drivers",
            value: loading ? dash : activeDrivers,
            sub: drivers.length ? `of ${drivers.length}` : null,
            icon: UsersIcon,
            accent: c["color-primary"],
            onClick: () => navigate("/drivers"),
          },
        ]}
      />

      {/* ── Charts row ──────────────────────────────────────────────────── */}
      <div className="dashboard-charts-row">
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">Delivery Performance</h3>
              <span className="chart-card-subtitle">Last 7 days · from trip records</span>
            </div>
          </div>
          <Suspense fallback={<ChartSkeleton height={240} label="Loading delivery trend" />}>
            <DeliveryTrendChart data={trendData} colors={c} />
          </Suspense>
        </div>

        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">Fleet Status</h3>
              <span className="chart-card-subtitle">
                {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          {loading ? (
            <ChartSkeleton height={190} variant="donut" label="Loading fleet status" />
          ) : vehicleBreakdown.length > 0 ? (
            <Suspense fallback={<ChartSkeleton height={190} variant="donut" label="Loading fleet status" />}>
              <FleetStatusDonut breakdown={vehicleBreakdown} total={vehicles.length} />
            </Suspense>
          ) : (
            <EmptyState
              compact
              illustration={EmptyVehiclesIllustration}
              title="No vehicles yet"
              subtitle="Fleet composition appears once vehicles are added."
              action={{ label: "Add a vehicle", onClick: () => navigate("/vehicles") }}
            />
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
                    aria-hidden="true"
                    style={{
                      background: getAvatarColor(item.name),
                      width: 34,
                      height: 34,
                      fontSize: 12,
                    }}
                  >
                    {getInitials(item.name)}
                  </div>
                  <div className="leaderboard-body">
                    <div className="leaderboard-name">{item.name}</div>
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
            <EmptyState
              compact
              illustration={EmptyDriversIllustration}
              title="No driver activity yet"
              subtitle="Drivers appear here once trips are assigned to them."
            />
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
            <EmptyState
              compact
              illustration={EmptyTruckIllustration}
              title="No recent activity"
              subtitle="Trip updates from the field will show up here."
              action={{ label: "Dispatch a trip", onClick: () => navigate("/dispatch") }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
