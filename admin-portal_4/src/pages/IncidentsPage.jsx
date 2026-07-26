import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { getIncidents, updateIncidentStatus } from "../services/incidentService";
import Badge from "../components/common/Badge";
import StatCard from "../components/common/StatCard";
import { AlertTriangleIcon, CheckCircleIcon, ClockIcon } from "../components/common/Icons";

const SEVERITIES = ["All", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
const STATUSES = ["All", "OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED"];

const SEVERITY_BADGE = {
  LOW: "default",
  MEDIUM: "info",
  HIGH: "warning",
  CRITICAL: "danger",
};

const STATUS_BADGE = {
  OPEN: "danger",
  UNDER_REVIEW: "warning",
  RESOLVED: "success",
  DISMISSED: "default",
};

const STATUS_LABELS = {
  OPEN: "Open",
  UNDER_REVIEW: "Under Review",
  RESOLVED: "Resolved",
  DISMISSED: "Dismissed",
};

function timeAgo(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function labelify(str) {
  if (!str) return "—";
  return str.charAt(0) + str.slice(1).toLowerCase().replace(/_/g, " ");
}

export default function IncidentsPage() {
  const location = useLocation();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [expandedId, setExpandedId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [successId, setSuccessId] = useState(null);

  useEffect(() => {
    setLoading(true);
    getIncidents()
      .then((data) => setIncidents(Array.isArray(data) ? data : []))
      .catch(() => setIncidents([]))
      .finally(() => setLoading(false));
  }, []);

  const incidentIdFilter = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("incidentId");
  }, [location.search]);

  useEffect(() => {
    if (incidentIdFilter) {
      setExpandedId(Number(incidentIdFilter));
    }
  }, [incidentIdFilter]);

  const filtered = useMemo(
    () =>
      incidents.filter((i) => {
        if (incidentIdFilter && String(i.id) !== String(incidentIdFilter)) return false;
        if (severityFilter !== "All" && i.severity !== severityFilter) return false;
        if (statusFilter !== "All" && i.status !== statusFilter) return false;
        return true;
      }),
    [incidents, severityFilter, statusFilter, incidentIdFilter]
  );

  const summary = useMemo(
    () => ({
      open: incidents.filter((i) => i.status === "OPEN").length,
      critical: incidents.filter((i) => i.severity === "CRITICAL" && i.status !== "RESOLVED" && i.status !== "DISMISSED").length,
      underReview: incidents.filter((i) => i.status === "UNDER_REVIEW").length,
      resolved: incidents.filter((i) => i.status === "RESOLVED").length,
    }),
    [incidents]
  );

  const handleStatusUpdate = async (incident, newStatus) => {
    setUpdatingId(incident.id);
    try {
      await updateIncidentStatus(incident.id, newStatus, incident.resolutionNotes || "");
      setIncidents((prev) =>
        prev.map((i) => (i.id === incident.id ? { ...i, status: newStatus } : i))
      );
      setSuccessId(incident.id);
      setTimeout(() => setSuccessId(null), 1800);
    } catch {
      // silent — user can retry
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleExpand = (id) =>
    setExpandedId((prev) => (prev === id ? null : id));

  return (
    <div className="page-enter">
      <div className="page-header-row">
        <div>
          <h1>Incidents</h1>
          <p className="page-subtitle">Track and manage fleet safety incidents</p>
        </div>
        {incidents.length > 0 && (
          <div className="incidents-filter-count">
            <span>{filtered.length}</span> / {incidents.length}
          </div>
        )}
      </div>

      {!loading && incidents.length > 0 && (
        <div className="stats-row stats-row-4">
          <StatCard
            className="stagger-child"
            title="Open"
            value={summary.open}
            icon={AlertTriangleIcon}
            color="var(--color-danger)"
          />
          <StatCard
            className="stagger-child"
            title="Critical"
            value={summary.critical}
            icon={AlertTriangleIcon}
            color="#B91C1C"
          />
          <StatCard
            className="stagger-child"
            title="Under Review"
            value={summary.underReview}
            icon={ClockIcon}
            color="var(--color-warning)"
          />
          <StatCard
            className="stagger-child"
            title="Resolved"
            value={summary.resolved}
            icon={CheckCircleIcon}
            color="var(--color-success)"
          />
        </div>
      )}

      <div className="incidents-filters-bar">
        <div className="incidents-filter-block">
          <span className="incidents-filter-label">Severity</span>
          <div className="incidents-filter-chips">
            {SEVERITIES.map((s) => (
              <button
                key={s}
                type="button"
                className={`incident-chip${severityFilter === s ? " incident-chip-active" : ""}`}
                onClick={() => setSeverityFilter(s)}
              >
                {s === "All" ? "All Severities" : labelify(s)}
              </button>
            ))}
          </div>
        </div>
        <div className="incidents-filter-block">
          <span className="incidents-filter-label">Status</span>
          <div className="incidents-filter-chips">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                className={`incident-chip${statusFilter === s ? " incident-chip-active" : ""}`}
                onClick={() => setStatusFilter(s)}
              >
                {s === "All" ? "All Statuses" : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="trips-table-card incidents-table-card">
        <table className="trips-data-table incidents-data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Trip</th>
              <th>Driver</th>
              <th>Type</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Reported</th>
              <th style={{ width: 32 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[48, 60, 60, 120, 72, 90, 64, 24].map((w, j) => (
                    <td key={j}>
                      <div className="skeleton-bar" style={{ height: 14, width: w }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="trips-empty-state">
                    <AlertTriangleIcon size={48} className="trips-empty-icon" />
                    <p className="trips-empty-title">
                      {incidents.length === 0
                        ? "No incidents recorded"
                        : "No matching incidents"}
                    </p>
                    <p className="trips-empty-subtitle">
                      {incidents.length === 0
                        ? "Fleet is running smoothly"
                        : "Try adjusting the filters above"}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((incident) => (
                <React.Fragment key={incident.id}>
                  <tr
                    onClick={() => toggleExpand(incident.id)}
                    className={`incident-row${expandedId === incident.id ? " expanded-row" : ""}`}
                  >
                    <td className="incident-id-cell">#{incident.id}</td>
                    <td className="incident-muted-cell">
                      {incident.tripId ? `#${incident.tripId}` : "—"}
                    </td>
                    <td className="incident-muted-cell">
                      {incident.driverId ? `#${incident.driverId}` : "—"}
                    </td>
                    <td className="incident-type-cell">
                      {incident.incidentType
                        ? incident.incidentType.replace(/_/g, " ")
                        : "—"}
                    </td>
                    <td>
                      <div className="incident-severity-cell">
                        {incident.severity === "CRITICAL" && (
                          <span className="critical-pulse-dot" />
                        )}
                        <Badge variant={SEVERITY_BADGE[incident.severity] || "default"}>
                          {labelify(incident.severity)}
                        </Badge>
                      </div>
                    </td>
                    <td>
                      <Badge variant={STATUS_BADGE[incident.status] || "default"}>
                        {STATUS_LABELS[incident.status] || incident.status || "—"}
                      </Badge>
                    </td>
                    <td className="incident-time-cell">
                      {timeAgo(incident.createdAt)}
                    </td>
                    <td className="incident-chevron-cell">
                      {expandedId === incident.id ? "▲" : "▼"}
                    </td>
                  </tr>

                  {expandedId === incident.id && (
                    <tr className="detail-expansion-row">
                      <td colSpan={8} className="incident-detail-cell">
                        <div className="incident-detail-panel">
                          <div className="incident-detail-grid">
                            <div className="incident-detail-field">
                              <div className="incident-detail-label">Description</div>
                              <div className="incident-detail-value">
                                {incident.description || "No description provided."}
                              </div>
                            </div>
                            {incident.resolutionNotes && (
                              <div className="incident-detail-field">
                                <div className="incident-detail-label">Resolution Notes</div>
                                <div className="incident-detail-value">
                                  {incident.resolutionNotes}
                                </div>
                              </div>
                            )}
                            {incident.resolvedAt && (
                              <div className="incident-detail-field">
                                <div className="incident-detail-label">Resolved At</div>
                                <div className="incident-detail-value">
                                  {new Date(incident.resolvedAt).toLocaleString()}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="incident-status-update">
                            <span className="incident-status-update-label">Update status:</span>
                            <div className="incident-status-update-control">
                              <select
                                className="dispatch-input"
                                value={incident.status}
                                disabled={updatingId === incident.id}
                                onChange={(e) => handleStatusUpdate(incident, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value="OPEN">Open</option>
                                <option value="UNDER_REVIEW">Under Review</option>
                                <option value="RESOLVED">Resolved</option>
                                <option value="DISMISSED">Dismissed</option>
                              </select>
                              {successId === incident.id && (
                                <CheckCircleIcon size={16} className="incident-status-success-icon" />
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
