export const VEHICLE_FILTER_TABS = ["All", "Available", "In Use", "Maintenance", "Decommissioned"];

export const VEHICLE_STATUS_STYLES = {
  AVAILABLE: { background: "#D1FAE5", color: "#10B981" },
  IN_USE: { background: "#FEF3C7", color: "#F59E0B" },
  MAINTENANCE: { background: "#DBEAFE", color: "#2563EB" },
  DECOMMISSIONED: { background: "#F3F4F6", color: "#6B7280" },
};

export function getVehicleStatusStyle(status) {
  return VEHICLE_STATUS_STYLES[status] || { background: "#F3F4F6", color: "#374151" };
}
