import React, { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Dot } from "recharts";

/**
 * Report trend line. Lazy-loaded — see DeliveryTrendChart for why Recharts is
 * kept off the initial render path.
 *
 * Every colour here is resolved from a token by the caller. This chart is the
 * one that used to hardcode #0D9488 / #D97706 / #6B7280 and `fill="#fff"` on
 * its dots, so in dark mode it kept light-mode line colours and punched white
 * holes in itself. Recharts writes these as SVG presentation attributes, where
 * `var()` is not reliably honoured, which is why they have to arrive resolved.
 */
const SERIES = [
  { key: "onTime", name: "On-time (delivered)", token: "color-teal-text" },
  { key: "late", name: "Cancelled", token: "color-warning-text" },
];

function LineTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="chart-tooltip-row">
          <span className="chart-tooltip-dot" style={{ background: entry.stroke || entry.fill }} />
          <span className="chart-tooltip-name">{entry.name}</span>
          <span className="chart-tooltip-value">{entry.value ?? 0}</span>
        </div>
      ))}
    </div>
  );
}

export default function ReportTrendChart({ data, colors }) {
  const [hidden, setHidden] = useState(() => new Set());

  const toggle = (key) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (next.size < SERIES.length - 1) next.add(key);
      return next;
    });

  return (
    <>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: colors["color-text-3"] }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: colors["color-text-3"] }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<LineTooltip />} />
          {SERIES.filter((s) => !hidden.has(s.key)).map((s) => (
            <Line
              key={s.key}
              type="monotone"
              name={s.name}
              dataKey={s.key}
              stroke={colors[s.token]}
              strokeWidth={2.5}
              // The dot's centre is the card face, so it must come from the
              // surface token — a literal white punched a hole in the dark card.
              dot={<Dot r={4} fill={colors["color-white"]} stroke={colors[s.token]} strokeWidth={2} />}
              activeDot={{ r: 5 }}
              isAnimationActive
            />
          ))}
        </LineChart>
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
