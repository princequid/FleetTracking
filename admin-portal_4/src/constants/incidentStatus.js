/**
 * Incidents carry two independent scales in adjacent columns: how bad it is
 * (severity) and how far along we are with it (status). Both were rendered as
 * the same kind of tinted pill from the same palette, so an amber "High"
 * severity and an amber "Under review" status were indistinguishable at a
 * glance — two different questions answered in one colour language.
 *
 * The split:
 *
 *   Severity  → a *scale*. Rendered as a graded chip with a filled level
 *               indicator, so it reads as a magnitude and can be compared down
 *               the column. Colour rises Low → Critical.
 *
 *   Status    → a *state*. Rendered as the portal's standard outline Badge,
 *               the same shape used for trip and vehicle status everywhere
 *               else, so the whole product means one thing by "a status pill".
 *
 * Neither depends on colour alone: severity also has its level dots and its
 * label, status also has its dot and its label.
 */

export const SEVERITIES = ["All", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
export const STATUSES = ["All", "OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED"];

/** 1–4, used for both the level indicator and for sorting the column. */
export const SEVERITY_LEVEL = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export const SEVERITY_LABELS = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const STATUS_BADGE = {
  OPEN: "danger",
  UNDER_REVIEW: "warning",
  RESOLVED: "success",
  DISMISSED: "default",
};

export const STATUS_LABELS = {
  OPEN: "Open",
  UNDER_REVIEW: "Under review",
  RESOLVED: "Resolved",
  DISMISSED: "Dismissed",
};

/** Ordered so the incidents that still need someone come first. */
export const STATUS_RANK = {
  OPEN: 0,
  UNDER_REVIEW: 1,
  RESOLVED: 2,
  DISMISSED: 3,
};

export const INCIDENT_TYPE_LABELS = {
  VEHICLE_BREAKDOWN: "Vehicle breakdown",
  ROAD_ACCIDENT: "Road accident",
  CARGO_DAMAGE: "Cargo damage",
};

export function incidentTypeLabel(type) {
  if (!type) return "—";
  return (
    INCIDENT_TYPE_LABELS[type] ||
    type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, " ")
  );
}

/** An incident that is both serious and unresolved — the row worth flagging. */
export function needsAttention(incident) {
  return (
    (incident.severity === "CRITICAL" || incident.severity === "HIGH") &&
    (incident.status === "OPEN" || incident.status === "UNDER_REVIEW")
  );
}
