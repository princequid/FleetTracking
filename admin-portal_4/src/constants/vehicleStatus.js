export const VEHICLE_FILTER_TABS = ["All", "Available", "In Use", "Maintenance", "Decommissioned"];

/**
 * Vehicle status → Badge variant. See the note in tripStatus.js — the previous
 * inline hex pairs failed AA contrast (DECOMMISSIONED was 4.39:1) and, being
 * inline styles, could not be remapped for dark mode.
 */
export const VEHICLE_STATUS_VARIANT = {
  AVAILABLE: "success",
  IN_USE: "warning",
  MAINTENANCE: "info",
  DECOMMISSIONED: "default",
};

export const VEHICLE_STATUS_LABELS = {
  AVAILABLE: "Available",
  IN_USE: "In use",
  MAINTENANCE: "Maintenance",
  DECOMMISSIONED: "Decommissioned",
};

export function getVehicleStatusVariant(status) {
  return VEHICLE_STATUS_VARIANT[status] || "default";
}

export function getVehicleStatusLabel(status) {
  if (!status) return "Unknown";
  return (
    VEHICLE_STATUS_LABELS[status] ||
    status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ")
  );
}
