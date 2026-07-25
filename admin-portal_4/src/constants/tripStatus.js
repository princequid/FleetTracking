export const FILTER_TABS = ["All", "Assigned", "Started", "Arrived", "Delivered", "Cancelled"];

export const STATUS_STYLES = {
  ASSIGNED: { background: "#DBEAFE", color: "#2563EB" },
  STARTED: { background: "#FEF3C7", color: "#F59E0B" },
  EN_ROUTE: { background: "#EDE9FE", color: "#8B5CF6" },
  REROUTED: { background: "#FCE7F3", color: "#EC4899" },
  ARRIVED: { background: "#DCFCE7", color: "#22C55E" },
  DELIVERED: { background: "#D1FAE5", color: "#10B981" },
  CANCELLED: { background: "#FEE2E2", color: "#EF4444" },
};

export function getStatusStyle(status) {
  return STATUS_STYLES[status] || { background: "#F3F4F6", color: "#374151" };
}
