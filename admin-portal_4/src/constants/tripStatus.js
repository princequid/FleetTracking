export const FILTER_TABS = ["All", "Assigned", "Started", "En Route", "Rerouted", "Arrived", "Delivered", "Cancelled"];

/**
 * Status → Badge variant.
 *
 * These deliberately map onto the shared badge variants rather than carrying
 * their own hex pairs. The previous inline-style approach hardcoded light
 * pastels (e.g. #F59E0B on #FEF3C7 = 1.93:1) which no stylesheet could override,
 * so badges failed WCAG AA in light mode and stayed pale chips on a near-black
 * card in dark mode. Variants resolve through tokens that are remapped per theme.
 *
 * ARRIVED and DELIVERED intentionally share `success` — both are good terminal-ish
 * states, and the label distinguishes them, so meaning never rests on colour alone.
 */
export const STATUS_VARIANT = {
  ASSIGNED: "info",
  STARTED: "warning",
  EN_ROUTE: "accent",
  REROUTED: "alt",
  ARRIVED: "success",
  DELIVERED: "success",
  CANCELLED: "danger",
};

/** Human labels — the UI previously rendered raw enums like "EN_ROUTE". */
export const STATUS_LABELS = {
  ASSIGNED: "Assigned",
  STARTED: "Started",
  EN_ROUTE: "En route",
  REROUTED: "Rerouted",
  ARRIVED: "Arrived",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

/**
 * Lifecycle order, for sorting a status column.
 *
 * Sorting these strings alphabetically gives "Arrived, Assigned, Cancelled,
 * Delivered, En route…" — an ordering of spellings that tells an operator
 * nothing. Sorting by position in the delivery lifecycle groups the trips that
 * still need attention at one end and the settled ones at the other.
 */
export const TRIP_STATUS_ORDER = [
  "ASSIGNED",
  "STARTED",
  "EN_ROUTE",
  "REROUTED",
  "ARRIVED",
  "DELIVERED",
  "CANCELLED",
];

export function getStatusVariant(status) {
  return STATUS_VARIANT[status] || "default";
}

export function getStatusLabel(status) {
  if (!status) return "Unknown";
  return STATUS_LABELS[status] || status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
}

// Statuses that can no longer be cancelled — a trip is cancellable unless it's
// already reached one of these terminal states. Shared by TripDetailPage and
// TripTable so both surfaces agree on which trips can be cancelled.
export const NON_CANCELLABLE_STATUSES = new Set(["DELIVERED", "CANCELLED"]);

export function isTripCancellable(status) {
  return !!status && !NON_CANCELLABLE_STATUSES.has(status);
}
