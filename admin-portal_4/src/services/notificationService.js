import { getIncidents } from "./incidentService";
import { getTrips } from "./tripService";

// ─────────────────────────────────────────────────────────────────────────────
// Admin notification feed — derived by polling data that already works (incidents
// + recent trip state changes), rather than the notification-service pipeline
// (which isn't deployed and has no admin-topic publisher). This gives the bell a
// live, auto-refreshing feed with no backend dependency beyond the running trip/
// incident services. Read state is tracked locally per admin (a "last seen" mark),
// since there's no server-side per-admin notification store to persist it in.
// ─────────────────────────────────────────────────────────────────────────────

const LAST_SEEN_KEY = "ft_admin_notif_lastseen";
const MAX_ITEMS = 40;
// Only surface events from roughly the last 3 days so the feed stays relevant.
const WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

function ts(value) {
  const t = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(t) ? t : null;
}

function incidentToNotification(incident) {
  const created = ts(incident.createdAt) ?? ts(incident.reportedAt);
  if (created == null) return null;
  const critical = String(incident.severity || "").toUpperCase() === "CRITICAL";
  return {
    id: `incident-${incident.id}`,
    type: "incident",
    severity: critical ? "critical" : "warning",
    title: `Incident reported${incident.severity ? ` — ${incident.severity}` : ""}`,
    description: incident.description || incident.type || "An incident was reported.",
    createdAt: new Date(created).toISOString(),
    createdTs: created,
    route: `/incidents${incident.id ? `?incidentId=${incident.id}` : ""}`,
  };
}

// Turn a trip's current state into a single "most recent event" notification,
// using whichever timestamp best matches that state.
function tripToNotification(trip) {
  const route = `${trip.origin || "—"} → ${trip.destination || "—"}`;
  let stamp = null;
  let title = null;
  let severity = "info";

  switch (trip.status) {
    case "DELIVERED":
      stamp = ts(trip.completedAt) ?? ts(trip.updatedAt);
      title = `Trip #${trip.id} completed`;
      severity = "success";
      break;
    case "CANCELLED":
      stamp = ts(trip.cancelledAt) ?? ts(trip.updatedAt);
      title = `Trip #${trip.id} cancelled`;
      severity = "critical";
      break;
    case "ARRIVED":
      stamp = ts(trip.arrivedAt) ?? ts(trip.updatedAt);
      title = `Trip #${trip.id} — driver arrived`;
      break;
    case "STARTED":
    case "EN_ROUTE":
      stamp = ts(trip.startedAt) ?? ts(trip.updatedAt);
      title = `Trip #${trip.id} started`;
      break;
    case "ASSIGNED":
      stamp = ts(trip.createdAt);
      title = `Trip #${trip.id} assigned`;
      break;
    default:
      return null;
  }
  if (stamp == null || title == null) return null;

  return {
    id: `trip-${trip.id}-${trip.status}`,
    type: "trip",
    severity,
    title,
    description: route,
    createdAt: new Date(stamp).toISOString(),
    createdTs: stamp,
    tripId: trip.id,
    route: `/trips/${trip.id}`,
  };
}

// Fetches the current feed. Best-effort: a failing source just contributes nothing.
export async function getDerivedNotifications() {
  const [incidentsRes, tripsRes] = await Promise.allSettled([getIncidents(), getTrips()]);
  const items = [];

  if (incidentsRes.status === "fulfilled" && Array.isArray(incidentsRes.value)) {
    incidentsRes.value.forEach((i) => {
      const n = incidentToNotification(i);
      if (n) items.push(n);
    });
  }
  if (tripsRes.status === "fulfilled" && Array.isArray(tripsRes.value)) {
    tripsRes.value.forEach((t) => {
      const n = tripToNotification(t);
      if (n) items.push(n);
    });
  }

  const cutoff = Date.now() - WINDOW_MS;
  return items
    .filter((n) => n.createdTs >= cutoff)
    .sort((a, b) => b.createdTs - a.createdTs)
    .slice(0, MAX_ITEMS);
}

// ── Local read tracking ───────────────────────────────────────────────────────
export function getLastSeenTs(userId) {
  try {
    const raw = localStorage.getItem(`${LAST_SEEN_KEY}:${userId || "anon"}`);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function markSeen(userId, tsMillis = Date.now()) {
  try {
    localStorage.setItem(`${LAST_SEEN_KEY}:${userId || "anon"}`, String(tsMillis));
  } catch {
    /* localStorage unavailable — read state just won't persist */
  }
}

export function countUnread(items, lastSeenTs) {
  return items.filter((n) => n.createdTs > lastSeenTs).length;
}
