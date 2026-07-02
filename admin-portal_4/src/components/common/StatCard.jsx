import React from "react";

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "#06B6D4",
  trend,
  style,
  className = "",
}) {
  return (
    <div className={`stat-card ${className}`.trim()} style={style}>
      <div className="stat-card-icon" style={{ background: `${color}29`, color }}>
        {Icon && <Icon size={22} />}
      </div>
      <div className="stat-card-body">
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-title">{title}</div>
        {subtitle && (
          <div className={`stat-card-subtitle stat-card-trend-${trend || "neutral"}`}>{subtitle}</div>
        )}
      </div>
    </div>
  );
}
