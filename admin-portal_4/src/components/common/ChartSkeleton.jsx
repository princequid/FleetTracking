import React from "react";

/**
 * Placeholder that occupies a chart's slot while its code and data arrive.
 *
 * Shaped like a chart rather than being a spinner in a box: bars of varying
 * height under an axis line, so the page doesn't visibly reflow when the real
 * chart replaces it and the eye already knows what is coming.
 *
 * `variant="donut"` for the circular slot — a ring placeholder, since a bar
 * skeleton followed by a donut is a jarring swap.
 */
export default function ChartSkeleton({ height = 240, variant = "bars", label = "Loading chart" }) {
  return (
    <div
      className={`chart-skeleton chart-skeleton-${variant}`}
      style={{ height }}
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      {variant === "donut" ? (
        <div className="chart-skeleton-ring" />
      ) : (
        <div className="chart-skeleton-bars">
          {[62, 38, 74, 46, 88, 55, 70].map((h, i) => (
            <span key={i} className="chart-skeleton-bar" style={{ height: `${h}%` }} />
          ))}
        </div>
      )}
    </div>
  );
}
