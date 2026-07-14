// Backend origin, sourced from the Vite env var so production builds don't
// silently point at a developer's localhost. Falls back to localhost:8080 for
// local dev when VITE_API_BASE_URL isn't set.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

// Websocket origin — defaults to the API origin's /ws endpoint unless a
// separate websocket host is configured.
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || `${API_BASE_URL}/ws`;
