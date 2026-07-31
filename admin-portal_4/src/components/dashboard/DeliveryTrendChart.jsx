import React, { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/**
 * Delivery trend, split out of DashboardPage so it can be `React.lazy`-loaded.
 *
 * Recharts (with its d3 dependencies) is the single largest asset in the build
 * — 327 kB raw, 88.6 kB gzipped, larger than the React runtime itself. Because
 * the dashboard is the landing route, that used to sit on the critical path of
 * essentially every session, delaying the KPI row that people actually come
 * here to read.
 *
 * It was not worth *replacing* Recharts: three good charts rebuilt by hand is a
 * lot of surface to get subtly wrong, and the dependency is a settled decision.
 * Deferring it is the cheap win — the tiles paint immediately and the charts
 * stream in behind a skeleton a moment later.
 *
 * The legend doubles as a series toggle, so an operator comparing a quiet
 * cancellation line against a busy delivery line can drop one out of the way.
 */
const SERIES = [
  { key: "delivered", name: "Delivered", token: "success-500", gradient: "gradDelivered" },
  { key: "cancelled", name: "Cancelled", token: "warning-500", gradient: "gradCancelled" },
];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="chart-tooltip-row">
          <span className="chart-tooltip-dot" style={{ background: entry.stroke || entry.fill }} />
          <span className="chart-tooltip-name">{entry.name}</span>
          <span className="chart-tooltip-value">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function DeliveryTrendChart({ data, colors }) {
  const [hidden, setHidden] = useState(() => new Set());

  const toggle = (key) =>
    setHidden((prev) => {
      const next = new Set(prev);
      // Never let the last visible series be switched off — an empty plot area
      // with two greyed legend items looks like a failure, not a filter.
      if (next.has(key)) next.delete(key);
      else if (next.size < SERIES.length - 1) next.add(key);
      return next;
    });

  return (
    <>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
          <defs>
            {SERIES.map((s) => (
              <linearGradient key={s.gradient} id={s.gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors[s.token]} stopOpacity={0.26} />
                <stop offset="100%" stopColor={colors[s.token]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors["color-border"]} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: colors["color-text-3"] }}
            axisLine={false}
            tickLine={false}
            dy={6}
          />
          <YAxis
            tick={{ fontSize: 12, fill: colors["color-text-3"] }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={48}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: colors["color-border-strong"] }}
          />
          {SERIES.filter((s) => !hidden.has(s.key)).map((s) => (
            <Area
              key={s.key}
              type="monotone"
              name={s.name}
              dataKey={s.key}
              stroke={colors[s.token]}
              strokeWidth={2.5}
              fill={`url(#${s.gradient})`}
              isAnimationActive
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>

      <div className="chart-legend">
        {SERIES.map((s) => {
          const off = hidden.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              className={`chart-legend-item chart-legend-toggle${off ? " is-off" : ""}`}
              aria-pressed={!off}
              onClick={() => toggle(s.key)}
            >
              <span className="chart-legend-dot" style={{ background: colors[s.token] }} />
              {s.name}
            </button>
          );
        })}
      </div>
    </>
  );
}
