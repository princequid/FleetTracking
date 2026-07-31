import React from "react";
import { AlertTriangleIcon } from "./Icons";

/**
 * Shown when a fetch genuinely failed.
 *
 * The distinction this exists to enforce: a rejected request must never fall
 * through to an empty state. An ops console that renders "0 open incidents"
 * during an API outage is asserting the fleet is healthy when it does not know
 * — worse than showing nothing.
 */
export default function ErrorState({
  title = "Can't reach the server",
  message = "These figures are unavailable, not zero. Check your connection and try again.",
  onRetry,
}) {
  return (
    <div className="state-error" role="alert">
      <AlertTriangleIcon size={28} className="state-error-icon" />
      <p className="state-error-title">{title}</p>
      <p className="state-error-msg">{message}</p>
      {onRetry && (
        <button className="btn btn-secondary btn-sm" type="button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
