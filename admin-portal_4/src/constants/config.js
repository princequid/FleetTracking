// Backend origin, sourced from the Vite env var so production builds don't
// silently point at a developer's localhost. Falls back to localhost:8080 for
// local dev when VITE_API_BASE_URL isn't set.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

// Websocket origin — defaults to the API origin's /ws endpoint unless a
// separate websocket host is configured.
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || `${API_BASE_URL}/ws`;

// Page size sent on every list request.
//
// The backend list endpoints are paginated with @PageableDefault(size = 50). No client
// used to send a page/size param, so every list — and every KPI, report and notification
// derived from one — was silently computed over only the first 50 rows, with nothing in
// the response to indicate more existed (the controllers return a bare List, not a Page).
//
// This is deliberately a STOPGAP that restores correct numbers today. The real fix is
// two-part and tracked in docs/AUDIT_REPORT_2026-07-31.md (C-1):
//   1. aggregate endpoints (GET /trips/stats) so dashboards never pull rows to count them
//   2. server-side pagination driven by the existing table UI, for the browsable lists
// Until then this ceiling must stay comfortably above the real row count — revisit it
// well before the fleet approaches it.
export const LIST_PAGE_SIZE = 500;

// OSRM server for road-following route geometry.
//
// Set VITE_OSRM_URL to the self-hosted instance (see .env). The public fallback below is
// a PRIVACY LEAK, not just a convenience default: every route request carries real vehicle
// and trip coordinates to a third-party server that we don't control and have no data
// agreement with. It stays only so a fresh clone with no .env still renders routes.
//
// The warning is deliberately loud and un-silenced — this exact setting was already
// pointed at the public server in production once without anyone noticing, because
// falling back is silent and looks identical on screen.
const PUBLIC_OSRM = "https://router.project-osrm.org";

export const OSRM_BASE_URL = import.meta.env.VITE_OSRM_URL || PUBLIC_OSRM;

if (OSRM_BASE_URL === PUBLIC_OSRM) {
  console.warn(
    "[FleetSync] VITE_OSRM_URL is not set — falling back to the PUBLIC OSRM server. " +
      "Live vehicle coordinates are being sent to a third party. Set VITE_OSRM_URL to " +
      "the self-hosted instance before deploying.",
  );
}
