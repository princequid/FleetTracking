import React, { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Dot,
} from "recharts";
import { getTrips } from "../services/tripService";
import { getIncidents } from "../services/incidentService";
import { useToast } from "../components/common/Toast";

function isoToday() {
  return new Date().toISOString().split("T")[0];
}

function isoMinus(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function scoreColor(n) {
  if (n >= 80) return "var(--color-success)";
  if (n >= 60) return "var(--color-warning)";
  return "var(--color-danger)";
}

function SortIcon({ col, active, dir }) {
  return (
    <span
      style={{
        marginLeft: 4,
        fontSize: 10,
        opacity: active ? 1 : 0.35,
        transition: "transform var(--transition-fast)",
        display: "inline-block",
        transform: active && dir === "asc" ? "rotate(180deg)" : "rotate(0deg)",
      }}
    >
      ▼
    </span>
  );
}

function LineTooltip({ active, payload, label }) {
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
        On-time: {payload[0]?.value ?? 0}
      </div>
      <div style={{ fontSize: 13, color: "#D97706" }}>
        Late / Cancelled: {payload[1]?.value ?? 0}
      </div>
    </div>
  );
}

const COLS = [
  { key: "rank",      label: "Rank",           sortKey: null },
  { key: "driverId",  label: "Driver",         sortKey: "driverId" },
  { key: "total",     label: "Total Trips",    sortKey: "total" },
  { key: "delivered", label: "On-Time Trips",  sortKey: "delivered" },
  { key: "incidents", label: "Incidents",      sortKey: "incidents" },
  { key: "score",     label: "Score",          sortKey: "score" },
];

export default function ReportsPage() {
  const showToast = useToast();

  const [startDate, setStartDate] = useState(isoMinus(7));
  const [endDate,   setEndDate]   = useState(isoToday);
  const [trips,     setTrips]     = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [generated, setGenerated] = useState(false);
  const [sortKey,   setSortKey]   = useState("score");
  const [sortDir,   setSortDir]   = useState("desc");

  const handleGenerate = () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    Promise.allSettled([getTrips(), getIncidents()])
      .then(([tR, iR]) => {
        const t = tR.status === "fulfilled" && Array.isArray(tR.value) ? tR.value : [];
        const i = iR.status === "fulfilled" && Array.isArray(iR.value) ? iR.value : [];
        setTrips(t);
        setIncidents(i);
        setGenerated(true);
        if (t.length === 0) showToast("warning", "No data", "No trips found — check the date range.");
      })
      .finally(() => setLoading(false));
  };

  // Filter trips to selected date range
  const filtered = useMemo(() => {
    if (!generated) return [];
    const s = new Date(startDate + "T00:00:00");
    const e = new Date(endDate   + "T23:59:59");
    return trips.filter((t) => {
      if (!t.createdAt) return false;
      const d = new Date(t.createdAt);
      return d >= s && d <= e;
    });
  }, [trips, startDate, endDate, generated]);

  // Build chart data — one entry per day in the range
  const chartData = useMemo(() => {
    const map = {};
    const s = new Date(startDate + "T00:00:00");
    const e = new Date(endDate   + "T23:59:59");
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const label = fmtDate(d.toISOString());
      map[label] = { date: label, onTime: 0, late: 0 };
    }
    filtered.forEach((t) => {
      const label = fmtDate(t.createdAt);
      if (!map[label]) return;
      if (t.status === "DELIVERED") map[label].onTime++;
      else if (t.status === "CANCELLED") map[label].late++;
    });
    return Object.values(map);
  }, [filtered, startDate, endDate]);

  // Summary stats
  const totalDeliveries = filtered.filter((t) => t.status === "DELIVERED").length;
  const totalClosed     = filtered.filter((t) => ["DELIVERED", "CANCELLED"].includes(t.status)).length;
  const avgOnTime       = totalClosed > 0 ? Math.round((totalDeliveries / totalClosed) * 100) : 0;
  const bestDay         = chartData.reduce(
    (best, d) => (d.onTime > (best?.onTime ?? -1) ? d : best),
    null
  );

  // Driver stats from all trips + incidents (not date-filtered — full picture)
  const driverStats = useMemo(() => {
    const map = {};
    trips.forEach((t) => {
      if (!t.driverId) return;
      if (!map[t.driverId]) map[t.driverId] = { driverId: t.driverId, total: 0, delivered: 0, incidents: 0 };
      map[t.driverId].total++;
      if (t.status === "DELIVERED") map[t.driverId].delivered++;
    });
    incidents.forEach((i) => {
      if (!i.driverId) return;
      if (!map[i.driverId]) map[i.driverId] = { driverId: i.driverId, total: 0, delivered: 0, incidents: 0 };
      map[i.driverId].incidents++;
    });
    return Object.values(map).map((d) => ({
      ...d,
      score: d.total > 0
        ? Math.max(0, Math.round((d.delivered / d.total) * 100 - d.incidents * 5))
        : 0,
    }));
  }, [trips, incidents]);

  const sorted = useMemo(() => {
    if (!sortKey) return driverStats;
    return [...driverStats].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [driverStats, sortKey, sortDir]);

  const handleSort = (key) => {
    if (!key) return;
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const exportCsv = () => {
    const headers = ["Rank", "Driver ID", "Total Trips", "On-Time Trips", "Incidents", "Score"];
    const rows = sorted.map((d, i) => [
      i + 1, d.driverId, d.total, d.delivered, d.incidents, d.score,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fleettrack-report-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("success", "Export ready", "CSV download started.");
  };

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="page-header-row">
        <div>
          <h1>Reports &amp; Analytics</h1>
          <p style={{ color: "var(--color-text-3)", fontSize: 14, marginTop: 4 }}>
            Generate delivery and driver performance reports
          </p>
        </div>
        <button
          className="btn-secondary"
          onClick={exportCsv}
          disabled={!generated || sorted.length === 0}
        >
          Export CSV
        </button>
      </div>

      {/* Date range controls */}
      <div className="report-controls">
        <div className="report-date-group">
          <label className="report-date-label">From</label>
          <input
            type="date"
            className="dispatch-input"
            value={startDate}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="report-date-group">
          <label className="report-date-label">To</label>
          <input
            type="date"
            className="dispatch-input"
            value={endDate}
            min={startDate}
            max={isoToday()}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <button
          className="btn-primary"
          onClick={handleGenerate}
          disabled={loading}
          style={{ alignSelf: "flex-end" }}
        >
          {loading ? <span className="login-spinner" /> : "Generate Report"}
        </button>
      </div>

      {generated && (
        <>
          {/* Chart */}
          <div className="chart-card" style={{ marginBottom: "1rem" }}>
            <div className="chart-card-header">
              <div>
                <h3 className="chart-card-title">Delivery Performance</h3>
                <span className="chart-card-subtitle">
                  {fmtDate(startDate)} — {fmtDate(endDate)}
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
              >
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
                  allowDecimals={false}
                />
                <Tooltip content={<LineTooltip />} />
                <Line
                  type="monotone"
                  dataKey="onTime"
                  stroke="#0D9488"
                  strokeWidth={2.5}
                  dot={<Dot r={4} fill="#fff" stroke="#0D9488" strokeWidth={2} />}
                  activeDot={{ r: 5 }}
                  isAnimationActive
                />
                <Line
                  type="monotone"
                  dataKey="late"
                  stroke="#D97706"
                  strokeWidth={2.5}
                  dot={<Dot r={4} fill="#fff" stroke="#D97706" strokeWidth={2} />}
                  activeDot={{ r: 5 }}
                  isAnimationActive
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="chart-legend">
              <span className="chart-legend-item">
                <span className="chart-legend-dot" style={{ background: "#0D9488" }} />
                On-time (Delivered)
              </span>
              <span className="chart-legend-item">
                <span className="chart-legend-dot" style={{ background: "#D97706" }} />
                Late / Cancelled
              </span>
            </div>
          </div>

          {/* Summary stats */}
          <div className="report-summary-row">
            <div className="report-stat-card">
              <div className="report-stat-label">Total Deliveries</div>
              <div className="report-stat-value">{totalDeliveries}</div>
              <div className="report-stat-sub">
                {filtered.length} trips in range
              </div>
            </div>
            <div className="report-stat-card">
              <div className="report-stat-label">Avg On-Time Rate</div>
              <div
                className="report-stat-value"
                style={{ color: avgOnTime >= 80 ? "var(--color-success)" : avgOnTime >= 60 ? "var(--color-warning)" : "var(--color-danger)" }}
              >
                {avgOnTime}%
              </div>
              <div className="report-stat-sub">of completed trips</div>
            </div>
            <div className="report-stat-card">
              <div className="report-stat-label">Best Day</div>
              <div className="report-stat-value" style={{ fontSize: "1.25rem" }}>
                {bestDay && bestDay.onTime > 0 ? bestDay.date : "—"}
              </div>
              <div className="report-stat-sub">
                {bestDay && bestDay.onTime > 0 ? `${bestDay.onTime} deliveries` : "No data"}
              </div>
            </div>
          </div>

          {/* Driver Performance Table */}
          <div className="trips-table-card">
            <div
              style={{
                padding: "1.25rem 1.5rem 1rem",
                borderBottom: "1px solid var(--color-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--color-text-1)" }}>
                Driver Performance
              </h3>
              <span style={{ fontSize: 13, color: "var(--color-text-3)" }}>
                {sorted.length} driver{sorted.length !== 1 ? "s" : ""}
              </span>
            </div>
            <table className="trips-data-table">
              <thead>
                <tr>
                  {COLS.map((c) => (
                    <th
                      key={c.key}
                      onClick={() => handleSort(c.sortKey)}
                      style={{ cursor: c.sortKey ? "pointer" : "default", userSelect: "none" }}
                    >
                      {c.label}
                      {c.sortKey && (
                        <SortIcon col={c.sortKey} active={sortKey === c.sortKey} dir={sortDir} />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="trips-empty-state">
                        <p className="trips-empty-title">No driver data</p>
                        <p className="trips-empty-subtitle">No trips have been assigned yet</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sorted.map((d, idx) => (
                    <tr key={d.driverId}>
                      <td style={{ fontWeight: 700, color: "var(--color-text-3)", width: 48 }}>
                        {idx + 1}
                      </td>
                      <td style={{ fontWeight: 600, color: "var(--color-navy)" }}>
                        Driver #{d.driverId}
                      </td>
                      <td>{d.total}</td>
                      <td>{d.delivered}</td>
                      <td>
                        <span style={{ color: d.incidents > 0 ? "var(--color-danger)" : "var(--color-text-3)" }}>
                          {d.incidents}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: scoreColor(d.score),
                          }}
                        >
                          {d.score}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!generated && !loading && (
        <div className="report-placeholder">
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.25 }}>📊</div>
          <p style={{ fontWeight: 600, fontSize: 16, color: "var(--color-text-2)", marginBottom: 6 }}>
            No report generated yet
          </p>
          <p style={{ fontSize: 14, color: "var(--color-text-3)" }}>
            Select a date range above and click Generate Report
          </p>
        </div>
      )}
    </div>
  );
}
