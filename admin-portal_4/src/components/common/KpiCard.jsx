import React, { useEffect, useRef, useState } from "react";
import Sparkline from "./Sparkline";
import { TrendUpIcon, TrendDownIcon } from "./Icons";

/**
 * Counts up to a numeric value on mount. Non-numeric values (an em dash while
 * loading, or a "—" placeholder) are passed straight through untouched.
 */
function useAnimatedNumber(value, duration = 650) {
  const numeric = typeof value === "number" && Number.isFinite(value);
  const [display, setDisplay] = useState(numeric ? 0 : value);
  const frameRef = useRef();
  // Animate from the previous value, not from zero. The dashboard re-polls every
  // 30s; starting at 0 each time made every tile count up from zero again on a
  // refresh that moved a number by one.
  const prevRef = useRef(numeric ? 0 : null);

  useEffect(() => {
    if (!numeric) {
      setDisplay(value);
      return undefined;
    }

    // Respect reduced-motion: land on the final value immediately.
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(value);
      prevRef.current = value;
      return undefined;
    }

    const start = performance.now();
    const from = typeof prevRef.current === "number" ? prevRef.current : 0;

    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      // easeOutCubic — fast start, gentle settle
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
      else prevRef.current = value;
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value, numeric, duration]);

  return display;
}

/**
 * Softens an accent to a background tint.
 *
 * Deliberately not `color-mix()`: when a browser doesn't support it the value
 * is invalid at computed-value time, which resolves to `unset` rather than
 * falling back — the icon chips would render with no background at all. Doing
 * the maths here keeps the tint universal.
 */
function softTint(color, alpha = 0.12) {
  if (typeof color !== "string") return undefined;
  const hex = color.trim();

  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (match) {
    let body = match[1];
    if (body.length === 3) body = body.split("").map((ch) => ch + ch).join("");
    const int = parseInt(body, 16);
    // eslint-disable-next-line no-bitwise
    return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
  }

  // Already a functional colour (rgb()/hsl()) — let the browser handle opacity
  // by layering it at low alpha over the card instead.
  if (/^rgba?\(/i.test(hex)) {
    return hex.replace(/^rgb\(/i, "rgba(").replace(/\)$/, `, ${alpha})`);
  }

  return undefined;
}

/**
 * Premium KPI tile: icon, label, animated value, trend chip and optional
 * sparkline. `accent` drives the icon chip, the top hairline and the spark
 * colour so each card reads as one unit.
 */
export default function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "var(--color-primary)",
  accentSoft,
  trend,           // { direction: "up" | "down" | "flat", value: "12%" }
  spark,           // number[] — optional sparkline series
  onClick,
  style,
  className = "",
}) {
  const animated = useAnimatedNumber(value);

  const TrendIcon =
    trend?.direction === "up" ? TrendUpIcon : trend?.direction === "down" ? TrendDownIcon : null;

  const interactive = typeof onClick === "function";

  return (
    <div
      className={`kpi-card ${className}`.trim()}
      style={{
        "--kpi-accent": accent,
        "--kpi-accent-soft": accentSoft || softTint(accent) || "var(--color-primary-soft)",
        cursor: interactive ? "pointer" : undefined,
        ...style,
      }}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <div className="kpi-head">
        <span className="kpi-label">{label}</span>
        {Icon && (
          <span className="kpi-icon">
            <Icon size={19} />
          </span>
        )}
      </div>

      <div className="kpi-value">{animated}</div>

      <div className="kpi-meta">
        {trend && (
          <span className={`kpi-trend kpi-trend-${trend.direction}`}>
            {TrendIcon && <TrendIcon size={12} />}
            {trend.value}
          </span>
        )}
        {sub && <span className="kpi-sub">{sub}</span>}
      </div>

      {spark?.length > 1 && (
        <div className="kpi-spark">
          <Sparkline data={spark} color={accent} />
        </div>
      )}
    </div>
  );
}
