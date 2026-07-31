import React, { lazy, Suspense, useMemo, useState } from "react";
import { getTrips } from "../services/tripService";
import { getIncidents } from "../services/incidentService";
import { useToast } from "../components/common/Toast";
import ErrorState from "../components/common/ErrorState";
import Button from "../components/common/Button";
import PageHeader from "../components/common/PageHeader";
import DataTable from "../components/common/DataTable";
import EmptyState from "../components/common/EmptyState";
import ChartSkeleton from "../components/common/ChartSkeleton";

/* Same reasoning as the dashboard: Recharts is deferred so the controls and the
   summary figures are usable before the chart code arrives. */
const ReportTrendChart = lazy(() => import("../components/dashboard/ReportTrendChart"));
import useCssVars from "../hooks/useCssVars";
import {
  ChevronDownIcon,
  DownloadIcon,
  BarChartIcon,
  EmptyReportIllustration,
} from "../components/common/Icons";

/* Recharts writes colours as SVG presentation attributes, where var() is not
   reliably honoured — so every colour handed to a chart has to be resolved to a
   concrete value first. This page was the one that still hardcoded #0D9488,
   #D97706, #6B7280 and fill="#fff", which meant its chart kept light-mode
   colours (and white dot centres) on a near-black card. */
const CHART_TOKENS = [
  "--color-teal-text",
  "--color-warning-text",
  "--color-text-3",
  "--color-border",
  "--color-white",
];

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

/* The -text tokens, not the fills. --color-success/warning/danger are tuned to
   sit *under* white in a badge; as coloured numerals on a card face they drop
   below AA, and green in particular is the worst offender. */
function scoreColor(n) {
  if (n >= 80) return "var(--color-success-text)";
  if (n >= 60) return "var(--color-warning-text)";
  return "var(--color-danger-text)";
}

export default function ReportsPage() {
  const showToast = useToast();
  const c = useCssVars(CHART_TOKENS);

  const [startDate, setStartDate] = useState(isoMinus(7));
  const [endDate,   setEndDate]   = useState(isoToday);
  const [trips,     setTrips]     = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [generated, setGenerated] = useState(false);
  const [sort,      setSort]      = useState({ key: "score", dir: "desc" });
  const [failed,    setFailed]    = useState(false);

  const handleGenerate = () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setFailed(false);
    Promise.allSettled([getTrips(), getIncidents()])
      .then(([tR, iR]) => {
        // Distinguish "the server is unreachable" from "your date range matched
        // nothing". Previously both produced a "check the date range" toast,
        // which blamed the user's filter for a backend outage.
        if (tR.status === "rejected" && iR.status === "rejected") {
          setFailed(true);
          setGenerated(false);
          showToast("error", "Report failed", "Couldn't reach the server. No data was loaded.");
          return;
        }
        const t = tR.status === "fulfilled" && Array.isArray(tR.value) ? tR.value : [];
        const i = iR.status === "fulfilled" && Array.isArray(iR.value) ? iR.value : [];
        setTrips(t);
        setIncidents(i);
        setGenerated(true);
        if (tR.status === "rejected") {
          showToast("warning", "Partial data", "Trip data was unavailable — figures are incomplete.");
        } else if (iR.status === "rejected") {
          showToast("warning", "Partial data", "Incident data was unavailable — driver scores exclude incidents.");
        } else if (t.length === 0) {
          showToast("warning", "No data", "No trips found in this date range.");
        }
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

  // Rank is a property of the report, not of the current sort: exporting a CSV
  // whose "Rank" column renumbered itself every time someone clicked a header
  // would produce two files that disagree about who came first.
  const rankedDrivers = useMemo(
    () => [...driverStats].sort((a, b) => b.score - a.score).map((d, i) => ({ ...d, rank: i + 1 })),
    [driverStats],
  );

  const driverColumns = [
    { key: "rank", header: "Rank", width: 70, numeric: true, sortable: true },
    {
      key: "driverId",
      header: "Driver",
      sortable: true,
      render: (d) => <span className="cell-id">Driver #{d.driverId}</span>,
    },
    { key: "total", header: "Total trips", width: 120, numeric: true, sortable: true },
    { key: "delivered", header: "On-time trips", width: 140, numeric: true, sortable: true },
    {
      key: "incidents",
      header: "Incidents",
      width: 110,
      numeric: true,
      sortable: true,
      render: (d) => (
        <span style={{ color: d.incidents > 0 ? "var(--color-danger-text)" : undefined }}>
          {d.incidents}
        </span>
      ),
    },
    {
      key: "score",
      header: "Score",
      width: 100,
      numeric: true,
      sortable: true,
      render: (d) => (
        <span style={{ fontWeight: 700, color: scoreColor(d.score) }}>{d.score}</span>
      ),
    },
  ];

  const exportCsv = () => {
    const headers = ["Rank", "Driver ID", "Total Trips", "On-Time Trips", "Incidents", "Score"];
    const rows = rankedDrivers.map((d, i) => [
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
    <div>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Generate delivery and driver performance reports"
        actions={
          <Button
            variant="secondary"
            onClick={exportCsv}
            disabled={!generated || driverStats.length === 0}
            title={
              !generated || driverStats.length === 0
                ? "Generate a report first"
                : "Download this report as CSV"
            }
          >
            <DownloadIcon size={16} />
            <span>Export CSV</span>
          </Button>
        }
      />

      {/* Date range controls */}
      <div className="report-controls">
        <div className="report-date-group">
          {/* htmlFor/id, not just proximity — without the association these read
              as unlabelled date fields. The visually-hidden suffix gives a screen
              reader the full "From report date" while the eye still sees "From";
              an aria-label would replace the name outright and leave it no longer
              containing the visible text (WCAG 2.5.3). */}
          <label className="report-date-label" htmlFor="report-start-date">
            From<span className="sr-only"> report date</span>
          </label>
          <input
            id="report-start-date"
            type="date"
            className="dispatch-input"
            value={startDate}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="report-date-group">
          <label className="report-date-label" htmlFor="report-end-date">
            To<span className="sr-only"> report date</span>
          </label>
          <input
            id="report-end-date"
            type="date"
            className="dispatch-input"
            value={endDate}
            min={startDate}
            max={isoToday()}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <Button
          variant="primary"
          onClick={handleGenerate}
          loading={loading}
          style={{ alignSelf: "flex-end" }}
        >
          <BarChartIcon size={16} />
          <span>Generate Report</span>
        </Button>
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
            <Suspense fallback={<ChartSkeleton height={220} label="Loading report chart" />}>
              <ReportTrendChart data={chartData} colors={c} />
            </Suspense>
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
                style={{ color: scoreColor(avgOnTime) }}
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

          <DataTable
            label="Driver performance"
            caption="Per-driver trip volume, on-time deliveries, incidents and derived score"
            columns={driverColumns}
            rows={rankedDrivers}
            rowKey={(d) => d.driverId}
            density="compact"
            sort={sort}
            onSortChange={setSort}
            empty={{
              illustration: EmptyReportIllustration,
              title: "No driver data in this report",
              subtitle: "No trips have been assigned in the selected period.",
            }}
          />
        </>
      )}

      {failed && !loading && (
        <ErrorState
          title="Couldn't generate the report"
          message="The server was unreachable, so no figures were loaded. This is not an empty result for your date range."
          onRetry={handleGenerate}
        />
      )}

      {!generated && !loading && !failed && (
        <div className="report-placeholder">
          <EmptyState
            illustration={EmptyReportIllustration}
            title="No report generated yet"
            subtitle="Pick a date range above, then generate the report."
            action={{ label: "Generate report", onClick: handleGenerate, icon: BarChartIcon }}
          />
        </div>
      )}
    </div>
  );
}
