import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

/**
 * Fleet composition donut. Split out alongside DeliveryTrendChart so both share
 * one lazily-loaded Recharts chunk rather than pulling it into the dashboard's
 * critical path — see that file for the reasoning.
 */
function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-row">
        <span className="chart-tooltip-dot" style={{ background: entry.payload.fill }} />
        <span className="chart-tooltip-name">{entry.name}</span>
        <span className="chart-tooltip-value">{entry.value}</span>
      </div>
    </div>
  );
}

function titleCase(value) {
  if (!value) return "";
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");
}

export default function FleetStatusDonut({ breakdown, total }) {
  return (
    <>
      <div className="donut-wrap">
        <ResponsiveContainer width="100%" height={190}>
          <PieChart>
            <Pie
              data={breakdown}
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={84}
              paddingAngle={2}
              cornerRadius={4}
              dataKey="value"
              stroke="none"
              isAnimationActive
            >
              {breakdown.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <span className="donut-center-value">{total}</span>
          <span className="donut-center-label">Vehicles</span>
        </div>
      </div>

      {/* The legend carries the counts, so the composition is readable without
          hovering every segment — and remains readable if the ring is too small
          to distinguish two similar slices. */}
      <div className="pie-legend">
        {breakdown.map((entry) => (
          <div key={entry.name} className="pie-legend-item">
            <span className="pie-legend-dot" style={{ background: entry.fill }} />
            <span className="pie-legend-label">{titleCase(entry.name)}</span>
            <span className="pie-legend-count">{entry.value}</span>
          </div>
        ))}
      </div>
    </>
  );
}
