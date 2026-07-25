import React, { useEffect, useMemo, useState } from "react";
import { getIncidents, updateIncidentStatus } from "../services/incidentService";
import Badge from "../components/common/Badge";
import { AlertTriangleIcon, CheckCircleIcon } from "../components/common/Icons";

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

  const filtered = useMemo(
    () =>
      incidents.filter((i) => {
        if (severityFilter !== "All" && i.severity !== severityFilter) return false;
        if (statusFilter !== "All" && i.status !== statusFilter) return false;
        return true;
      }),
    [incidents, severityFilter, statusFilter]
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
          <p style={{ color: "var(--color-text-3)", fontSize: 14, marginTop: 4 }}>
            Monitor and resolve fleet incidents
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: "var(--color-text-3)",
          }}
        >
          {incidents.length > 0 && (
            <span
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-full)",
                padding: "4px 12px",
                fontWeight: 600,
                color: "var(--color-text-2)",
              }}
            >
              {filtered.length} / {incidents.length}
            </span>
          )}
        </div>
      </div>

      {/* Severity + Status filter chips */}
      <div className="incidents-filters">
        <div className="incidents-filter-group">
          {SEVERITIES.map((s) => (
            <button
              key={s}
              className={`incident-chip${severityFilter === s ? " incident-chip-active" : ""}`}
              onClick={() => setSeverityFilter(s)}
            >
              {s === "All" ? "All Severity" : labelify(s)}
            </button>
          ))}
        </div>
        <div className="incidents-filter-group">
          {STATUSES.map((s) => (
            <button
              key={s}
              className={`incident-chip${statusFilter === s ? " incident-chip-active" : ""}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === "All" ? "All Status" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="trips-table-card">
        <table className="trips-data-table">
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
                    style={{ cursor: "pointer" }}
                    className={expandedId === incident.id ? "expanded-row" : ""}
                  >
                    <td style={{ fontWeight: 600, color: "var(--color-navy)" }}>
                      #{incident.id}
                    </td>
                    <td style={{ color: "var(--color-text-3)" }}>
                      {incident.tripId ? `#${incident.tripId}` : "—"}
                    </td>
                    <td style={{ color: "var(--color-text-3)" }}>
                      {incident.driverId ? `#${incident.driverId}` : "—"}
                    </td>
                    <td style={{ fontSize: 13, color: "var(--color-text-2)" }}>
                      {incident.incidentType
                        ? incident.incidentType.replace(/_/g, " ")
                        : "—"}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
                    <td
                      style={{
                        fontSize: 13,
                        color: "var(--color-text-3)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {timeAgo(incident.createdAt)}
                    </td>
                    <td style={{ textAlign: "center", color: "var(--color-teal)", fontSize: 10 }}>
                      {expandedId === incident.id ? "▲" : "▼"}
                    </td>
                  </tr>

                  {expandedId === incident.id && (
                    <tr className="detail-expansion-row">
                      <td
                        colSpan={8}
                        style={{
                          padding: 0,
                          borderBottom: "1px solid var(--color-border)",
                        }}
                      >
                        <div className="incident-detail-panel">
                          <div className="incident-detail-grid">
                            <div>
                              <div
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  letterSpacing: "0.06em",
                                  textTransform: "uppercase",
                                  color: "var(--color-text-3)",
                                  marginBottom: 6,
                                }}
                              >
                                Description
                              </div>
                              <div style={{ fontSize: 14, color: "var(--color-text-2)" }}>
                                {incident.description || "No description provided."}
                              </div>
                            </div>
                            {incident.resolutionNotes && (
                              <div>
                                <div
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    letterSpacing: "0.06em",
                                    textTransform: "uppercase",
                                    color: "var(--color-text-3)",
                                    marginBottom: 6,
                                  }}
                                >
                                  Resolution Notes
                                </div>
                                <div style={{ fontSize: 14, color: "var(--color-text-2)" }}>
                                  {incident.resolutionNotes}
                                </div>
                              </div>
                            )}
                            {incident.resolvedAt && (
                              <div>
                                <div
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    letterSpacing: "0.06em",
                                    textTransform: "uppercase",
                                    color: "var(--color-text-3)",
                                    marginBottom: 6,
                                  }}
                                >
                                  Resolved At
                                </div>
                                <div style={{ fontSize: 14, color: "var(--color-text-2)" }}>
                                  {new Date(incident.resolvedAt).toLocaleString()}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="incident-status-update">
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                                color: "var(--color-text-2)",
                              }}
                            >
                              Update status:
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <select
                                className="dispatch-input"
                                style={{ minWidth: 160, fontSize: 13 }}
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
                                <CheckCircleIcon
                                  size={16}
                                  style={{ color: "var(--color-success)" }}
                                />
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
