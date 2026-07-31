import React from "react";
import { SEVERITY_LEVEL, SEVERITY_LABELS } from "../../constants/incidentStatus";

/**
 * Severity as a magnitude, not another status pill.
 *
 * Four ticks, filled to the level. That gives the column three independent
 * carriers of the same information — the number of filled ticks, the hue, and
 * the word — so it survives both greyscale and a colour-vision difference, and
 * an operator can compare severity down the column without reading every row.
 *
 * The previous rendering was a tinted pill identical in shape to the Status
 * pill immediately to its right, in the same palette.
 */
export default function SeverityMeter({ severity }) {
  const level = SEVERITY_LEVEL[severity] ?? 0;
  const label = SEVERITY_LABELS[severity] || "Unknown";

  return (
    <span className={`severity severity-${(severity || "unknown").toLowerCase()}`}>
      <span className="severity-ticks" aria-hidden="true">
        {[1, 2, 3, 4].map((tick) => (
          <span key={tick} className={`severity-tick${tick <= level ? " is-filled" : ""}`} />
        ))}
      </span>
      <span className="severity-label">{label}</span>
    </span>
  );
}
