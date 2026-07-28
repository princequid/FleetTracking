import React from "react";
import KpiCard from "./KpiCard";

/**
 * Legacy stat tile. Kept as a thin adapter over KpiCard so the two don't drift
 * into two different-looking cards — the props below are the original public
 * API, so existing call sites need no change.
 *
 * Prefer KpiCard directly for anything new; it also supports sparklines and
 * structured trend chips.
 */
export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  color = "var(--color-primary)",
  trend,
  style,
  className = "",
}) {
  // The old API expressed trend as a bare direction string with the copy living
  // in `subtitle`. Promote that to a chip only for a direction that reads as
  // movement — and then drop `sub`, or the same text renders twice.
  const asChip = Boolean(trend && trend !== "neutral" && subtitle);

  return (
    <KpiCard
      className={className}
      label={title}
      value={value}
      sub={asChip ? undefined : subtitle}
      icon={icon}
      accent={color}
      trend={asChip ? { direction: trend, value: subtitle } : undefined}
      style={style}
    />
  );
}
