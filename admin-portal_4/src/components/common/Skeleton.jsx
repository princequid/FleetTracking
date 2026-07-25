import React from "react";

export default function Skeleton({ width = "100%", height = 14, borderRadius = 6 }) {
  return (
    <div
      className="skeleton-bar"
      style={{ width, height, borderRadius, display: "block" }}
    />
  );
}

export function SkeletonCard({ height = 80 }) {
  return (
    <div
      className="skeleton-bar"
      style={{ height, borderRadius: "var(--radius-lg)", display: "block", width: "100%" }}
    />
  );
}

export function SkeletonRows({ rows = 5, columns = 5 }) {
  return Array.from({ length: rows }, (_, i) => (
    <tr key={i} className="skeleton-row">
      {Array.from({ length: columns }, (_, j) => (
        <td key={j}>
          <div className="skeleton-bar" style={{ height: 14, borderRadius: 6 }} />
        </td>
      ))}
    </tr>
  ));
}
