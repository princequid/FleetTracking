import React, { useId } from "react";

/**
 * Dependency-free sparkline. Recharts is already bundled, but a full
 * ResponsiveContainer per KPI card is heavy for a 44px strip — this renders a
 * single stretched SVG path instead.
 *
 * The viewBox is fixed and `preserveAspectRatio="none"` lets it stretch to the
 * card width, so no measurement or resize observer is needed.
 */
export default function Sparkline({
  data = [],
  color = "var(--color-primary)",
  height = 44,
  strokeWidth = 2,
  fill = true,
}) {
  const gradientId = useId();

  if (!data.length) return null;

  const W = 100;
  const H = 32;
  const PAD = strokeWidth; // keeps the stroke from clipping at the extremes

  const max = Math.max(...data);
  const min = Math.min(...data);
  // A flat series would divide by zero — pin it to the vertical centre instead.
  const span = max - min || 1;
  const stepX = data.length > 1 ? W / (data.length - 1) : 0;

  const points = data.map((value, i) => {
    const x = data.length === 1 ? W / 2 : i * stepX;
    const y = PAD + (H - PAD * 2) * (1 - (value - min) / span);
    return [x, y];
  });

  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradientId})`} stroke="none" />
        </>
      )}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
