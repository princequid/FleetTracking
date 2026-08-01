import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { peekIncidents, getIncidents, updateIncidentStatus } from "../services/incidentService";
import Badge from "../components/common/Badge";
import DataTable from "../components/common/DataTable";
import PageHeader from "../components/common/PageHeader";
import FilterBar from "../components/common/FilterBar";
import SeverityMeter from "../components/incidents/SeverityMeter";
import Select from "../components/common/Select";
import { useToast } from "../components/common/Toast";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  EmptyIncidentsIllustration,
  EmptySearchIllustration,
} from "../components/common/Icons";
import { timeAgo, formatFull, formatDateTime } from "../utils/formatDate";
import {
  SEVERITIES,
  STATUSES,
  SEVERITY_LEVEL,
  SEVERITY_LABELS,
  STATUS_BADGE,
  STATUS_LABELS,
  STATUS_RANK,
  incidentTypeLabel,
  needsAttention,
} from "../constants/incidentStatus";

const PAGE_SIZE = 15;

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));

function DetailField({ label, children }) {
  return (
    <div className="incident-detail-field">
      <span className="incident-detail-label">{label}</span>
      <span className="incident-detail-value">{children}</span>
    </div>
  );
}

export default function IncidentsPage() {
  const location = useLocation();
  const showToast = useToast();
  // Seed from the cache synchronously so returning to this page paints the list on the
  // FIRST render instead of flashing a skeleton. Caching the fetch alone wasn't enough:
  // the cached promise resolves a microtask AFTER React has already painted the empty
  // state. `undefined` means a miss; `[]` is a real (empty) cached result.
  const [incidents, setIncidents] = useState(() => peekIncidents() ?? []);
  const [loading, setLoading] = useState(() => peekIncidents() === undefined);
  const [severityFilter, setSeverityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [expandedId, setExpandedId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [successId, setSuccessId] = useState(null);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState({ key: "severity", dir: "desc" });
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    // Only show the skeleton when there is genuinely nothing to show. When cached data
    // is already on screen we revalidate silently in the background
    // (stale-while-revalidate). Flipping this on unconditionally is what still made
    // the page flash on return, even after the initial state was seeded from cache —
    // the mount effect calls this loader, which immediately overwrote that `false`.
    if (peekIncidents() === undefined) setLoading(true);
    setError(null);
    return getIncidents()
      .then((data) => setIncidents(Array.isArray(data) ? data : []))
      // Previously `.catch(() => setIncidents([]))`, which routed a failed fetch
      // straight into the empty state — the page then read "No incidents recorded
      // / Fleet is running smoothly" during an outage. A rejected request must
      // never be presented as an absence of incidents.
      .catch(() =>
        setError({
          title: "Can't load incidents",
          message:
            "This is a connection failure, not an empty incident log — the fleet's actual status is unknown.",
        }),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const incidentIdFilter = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("incidentId");
  }, [location.search]);

  useEffect(() => {
    if (incidentIdFilter) setExpandedId(Number(incidentIdFilter));
  }, [incidentIdFilter]);

  useEffect(() => {
    setPage(1);
  }, [severityFilter, statusFilter]);

  const filtered = useMemo(
    () =>
      incidents.filter((i) => {
        if (incidentIdFilter && String(i.id) !== String(incidentIdFilter)) return false;
        if (severityFilter !== "All" && i.severity !== severityFilter) return false;
        if (statusFilter !== "All" && i.status !== statusFilter) return false;
        return true;
      }),
    [incidents, severityFilter, statusFilter, incidentIdFilter],
  );

  const openCount = useMemo(
    () => incidents.filter((i) => i.status === "OPEN").length,
    [incidents],
  );

  const handleStatusUpdate = async (incident, newStatus) => {
    setUpdatingId(incident.id);
    try {
      await updateIncidentStatus(incident.id, newStatus, incident.resolutionNotes || "");
      setIncidents((prev) =>
        prev.map((i) => (i.id === incident.id ? { ...i, status: newStatus } : i)),
      );
      setSuccessId(incident.id);
      setTimeout(() => setSuccessId(null), 1800);
    } catch {
      // The <select> is controlled by incident.status, so a failure silently
      // snaps it back with no explanation. Tell the user it didn't take.
      showToast(
        "error",
        "Status not updated",
        "The incident status was not changed — please try again.",
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleExpand = (id) => setExpandedId((prev) => (prev === id ? null : id));

  const isFiltered = severityFilter !== "All" || statusFilter !== "All";

  function clearFilters() {
    setSeverityFilter("All");
    setStatusFilter("All");
  }

  const columns = [
    {
      key: "id",
      header: "ID",
      width: 84,
      numeric: true,
      sortable: true,
      render: (incident) => <span className="cell-id">#{incident.id}</span>,
    },
    {
      key: "tripId",
      header: "Trip",
      width: 84,
      numeric: true,
      hideBelow: "md",
      render: (incident) =>
        incident.tripId ? `#${incident.tripId}` : <span className="cell-muted">—</span>,
    },
    {
      key: "driverId",
      header: "Driver",
      width: 90,
      numeric: true,
      hideBelow: "md",
      render: (incident) =>
        incident.driverId ? `#${incident.driverId}` : <span className="cell-muted">—</span>,
    },
    {
      key: "incidentType",
      header: "Type",
      sortable: true,
      render: (incident) => incidentTypeLabel(incident.incidentType),
    },
    {
      key: "severity",
      header: "Severity",
      width: 150,
      sortable: true,
      sortValue: (incident) => SEVERITY_LEVEL[incident.severity] ?? 0,
      render: (incident) => <SeverityMeter severity={incident.severity} />,
    },
    {
      key: "status",
      header: "Status",
      width: 150,
      sortable: true,
      sortValue: (incident) => STATUS_RANK[incident.status] ?? 99,
      render: (incident) => (
        <Badge variant={STATUS_BADGE[incident.status] || "default"} dot>
          {STATUS_LABELS[incident.status] || incident.status || "—"}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Reported",
      width: 120,
      align: "end",
      sortable: true,
      sortValue: (incident) => (incident.createdAt ? new Date(incident.createdAt).getTime() : 0),
      render: (incident) => (
        <span title={formatFull(incident.createdAt)}>{timeAgo(incident.createdAt)}</span>
      ),
    },
    {
      key: "expand",
      header: "Details",
      width: 60,
      align: "end",
      cellClassName: "incident-expand-cell",
      render: (incident) => (
        <button
          type="button"
          className="incident-expand-btn"
          aria-expanded={expandedId === incident.id}
          aria-controls={`incident-detail-${incident.id}`}
          aria-label={`${expandedId === incident.id ? "Hide" : "Show"} details for incident #${incident.id}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleExpand(incident.id);
          }}
        >
          <ChevronDownIcon size={16} />
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Incidents"
        subtitle="Safety and delivery incidents reported from the field"
        meta={
          !loading && incidents.length > 0 ? (
            <span className={`incident-open-pill${openCount > 0 ? " is-open" : ""}`}>
              <strong>{openCount}</strong> open
            </span>
          ) : null
        }
      />

      <FilterBar
        filters={
          <>
            <div className="filter-group">
              <span className="filter-group-label" id="severity-filter-label">
                Severity
              </span>
              <div className="filter-group-chips" role="group" aria-labelledby="severity-filter-label">
                {SEVERITIES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`incident-chip${severityFilter === s ? " incident-chip-active" : ""}`}
                    aria-pressed={severityFilter === s}
                    onClick={() => setSeverityFilter(s)}
                  >
                    {s === "All" ? "All" : SEVERITY_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-group">
              <span className="filter-group-label" id="status-filter-label">
                Status
              </span>
              <div className="filter-group-chips" role="group" aria-labelledby="status-filter-label">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`incident-chip${statusFilter === s ? " incident-chip-active" : ""}`}
                    aria-pressed={statusFilter === s}
                    onClick={() => setStatusFilter(s)}
                  >
                    {s === "All" ? "All" : STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          </>
        }
        activeFilters={[
          ...(severityFilter !== "All"
            ? [
                {
                  key: "sev",
                  label: "Severity",
                  value: SEVERITY_LABELS[severityFilter],
                  onRemove: () => setSeverityFilter("All"),
                },
              ]
            : []),
          ...(statusFilter !== "All"
            ? [
                {
                  key: "status",
                  label: "Status",
                  value: STATUS_LABELS[statusFilter],
                  onRemove: () => setStatusFilter("All"),
                },
              ]
            : []),
        ]}
        onClearAll={isFiltered ? clearFilters : undefined}
        resultCount={loading ? undefined : filtered.length}
        totalCount={incidents.length}
      />

      <DataTable
        label="Incidents"
        caption="Reported incidents with severity, status and the trip they relate to"
        columns={columns}
        rows={filtered}
        rowKey={(incident) => incident.id}
        loading={loading}
        error={error}
        onRetry={load}
        density="compact"
        // Serious *and* unresolved. A red rail on every critical incident would
        // still flag the ones already closed, which is noise, not a signal.
        isRowHighlighted={needsAttention}
        empty={
          isFiltered
            ? {
                illustration: EmptySearchIllustration,
                variant: "filtered",
                title: "No incidents match these filters",
                subtitle: "Try a different severity or status.",
                action: { label: "Clear filters", onClick: clearFilters },
              }
            : {
                illustration: EmptyIncidentsIllustration,
                title: "No incidents recorded",
                subtitle: "Incidents reported by drivers in the field will appear here.",
              }
        }
        onRowActivate={(incident) => toggleExpand(incident.id)}
        expandedKey={expandedId}
        renderExpansion={(incident) => (
          <div className="incident-detail-panel" id={`incident-detail-${incident.id}`}>
            <div className="incident-detail-grid">
              <DetailField label="Description">
                {incident.description || "No description provided."}
              </DetailField>
              {incident.resolutionNotes && (
                <DetailField label="Resolution notes">{incident.resolutionNotes}</DetailField>
              )}
              {incident.resolvedAt && (
                <DetailField label="Resolved at">
                  {formatDateTime(incident.resolvedAt)}
                </DetailField>
              )}
            </div>
            <div className="incident-status-update">
              <label className="incident-status-label" htmlFor={`incident-status-${incident.id}`}>
                Update status
              </label>
              <div className="incident-status-control">
                {/* The wrapper stops a click inside the dropdown bubbling to the
                    row, which would collapse the panel the dropdown lives in. */}
                <div onClick={(e) => e.stopPropagation()}>
                  <Select
                    id={`incident-status-${incident.id}`}
                    value={incident.status}
                    disabled={updatingId === incident.id}
                    onChange={(next) => handleStatusUpdate(incident, next)}
                    options={STATUS_OPTIONS}
                  />
                </div>
                {successId === incident.id && (
                  <span className="incident-status-saved" role="status">
                    <CheckCircleIcon size={15} />
                    Saved
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        sort={sort}
        onSortChange={setSort}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  );
}
