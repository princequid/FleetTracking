import React from "react";

// Shown in the content area while a lazily-loaded route chunk downloads.
// The sidebar/navbar shell stays mounted, so navigation feels continuous.
export default function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-live="polite" aria-busy="true">
      <span className="route-fallback-spinner" />
      <span className="route-fallback-text">Loading…</span>
    </div>
  );
}
